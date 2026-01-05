/**
 * Base GPU Batch Renderer
 * 
 * Abstract base class for GPU-based instanced batch rendering.
 * Provides unified API and lifecycle for all GPU primitives.
 * 
 * Each GPU primitive extends this class and implements:
 * - createSharedResources() - shaders, shared buffers
 * - createBatch() - VAO, instance buffer setup
 * - writeInstanceData() - serialize instance to Float32Array
 * - setupRenderState() - per-batch uniforms, blend modes
 * 
 * @template TInstance - Instance data type
 * @template TBatch - Batch type (extends GpuBatch<TInstance>)
 * @template TConfig - Configuration type for batch key (void if no config)
 */

import type { SceneSize, SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import type { GpuBatch } from "./BaseGpuPrimitive";
import { disposeBatch } from "./BaseGpuPrimitive";

// ============================================================================
// Types
// ============================================================================

/**
 * Handle to a slot in a GPU batch.
 */
export interface SlotHandle {
  /** Unique batch identifier */
  readonly batchKey: string;
  /** Slot index within the batch */
  readonly slotIndex: number;
}

/**
 * Shared resources for a GPU renderer (shaders, shared buffers).
 */
export interface GpuSharedResources {
  readonly program: WebGLProgram;
}

/**
 * Extended batch interface with instance tracking.
 */
export interface ExtendedGpuBatch<TInstance extends object> extends GpuBatch<TInstance> {
  /** Track instances for potential readback */
  instances: (TInstance | null)[];
}

// ============================================================================
// Base Class
// ============================================================================

/**
 * Base class for GPU batch renderers.
 * Provides unified lifecycle and slot management.
 */
export abstract class GpuBatchRenderer<
  TInstance extends object,
  TBatch extends ExtendedGpuBatch<TInstance>,
  TConfig = void
> {
  protected gl: WebGL2RenderingContext | null = null;
  protected sharedResources: GpuSharedResources | null = null;
  protected readonly batches = new Map<string, TBatch>();
  protected readonly defaultCapacity: number;

  constructor(defaultCapacity = 512) {
    this.defaultCapacity = defaultCapacity;
  }

  // ============================================================================
  // Abstract Methods - Must be implemented by subclasses
  // ============================================================================

  /**
   * Create shared GPU resources (shaders, shared buffers).
   * Called once per WebGL context.
   */
  protected abstract createSharedResources(gl: WebGL2RenderingContext): GpuSharedResources | null;

  /**
   * Create a new batch with the given capacity.
   * Must setup VAO, instance buffer, and attributes.
   */
  protected abstract createBatch(gl: WebGL2RenderingContext, capacity: number): TBatch | null;

  /**
   * Get batch key from config.
   * For renderers without configs, return a constant string.
   */
  protected abstract getBatchKey(config: TConfig): string;

  /**
   * Write instance data to batch.instanceData at the given slot index.
   * Must write to batch.instanceData[slotIndex * instanceFloats + offset].
   */
  protected abstract writeInstanceData(batch: TBatch, slotIndex: number, instance: TInstance): void;

  /**
   * Setup render state before drawing a batch (uniforms, blend mode, etc.).
   * Called once per batch in render().
   */
  protected abstract setupRenderState(
    gl: WebGL2RenderingContext,
    batch: TBatch,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    timestampMs: number
  ): void;

  /**
   * Get number of floats per instance.
   */
  protected abstract getInstanceFloats(): number;

  /**
   * Get index of the "active" flag float (usually last).
   */
  protected abstract getActiveFloatIndex(): number;

  /**
   * Get vertex count for draw call (e.g., 6 for quad, circleVertexCount for circle).
   */
  protected abstract getVertexCount(batch: TBatch): number;

  /**
   * Get draw mode (e.g., gl.TRIANGLES, gl.TRIANGLE_FAN).
   */
  protected abstract getDrawMode(gl: WebGL2RenderingContext): number;

  /**
   * Cleanup shared resources (called in dispose).
   */
  protected disposeSharedResources(gl: WebGL2RenderingContext): void {
    // Override if needed (e.g., delete shared buffers)
  }

  // ============================================================================
  // Public API - Unified interface for all GPU primitives
  // ============================================================================

  /**
   * Set WebGL context. Initializes shared resources.
   * Pass null to dispose all resources.
   */
  public setContext(gl: WebGL2RenderingContext | null): void {
    if (gl === this.gl) {
      return;
    }

    this.dispose();

    this.gl = gl;
    if (!gl) {
      return;
    }

    this.sharedResources = this.createSharedResources(gl);
    if (!this.sharedResources) {
      this.gl = null;
    }
  }

  /**
   * Acquire a slot for a new instance.
   * @param config - Configuration for batch selection (void if no config)
   * @returns Slot handle, or null if no slots available
   */
  public acquireSlot(config: TConfig): SlotHandle | null {
    if (!this.gl || !this.sharedResources) {
      return null;
    }

    const key = this.getBatchKey(config);
    let batch: TBatch | undefined = this.batches.get(key);

    // Create or grow batch if needed
    if (!batch) {
      const newBatch = this.createBatch(this.gl, this.defaultCapacity);
      if (!newBatch) {
        return null;
      }
      batch = newBatch;
      this.batches.set(key, batch);
    } else if (batch.freeSlots.length === 0) {
      // TODO: Could grow batch here
      return null;
    }

    const slotIndex = batch.freeSlots.pop()!;
    batch.activeCount++;
    batch.instances[slotIndex] = null; // Will be set in updateSlot

    // Initialize slot as inactive to prevent rendering stale data
    const instanceFloats = this.getInstanceFloats();
    const activeIndex = this.getActiveFloatIndex();
    batch.instanceData[slotIndex * instanceFloats + activeIndex] = 0;
    batch.needsUpload = true;

    return { batchKey: key, slotIndex };
  }

  /**
   * Update instance data in a slot.
   */
  public updateSlot(handle: SlotHandle, instance: TInstance): void {
    const batch = this.batches.get(handle.batchKey);
    if (!batch || !this.gl) {
      return;
    }

    const { slotIndex } = handle;
    if (slotIndex < 0 || slotIndex >= batch.capacity) {
      return;
    }

    this.writeInstanceData(batch, slotIndex, instance);
    batch.instances[slotIndex] = instance;
    batch.needsUpload = true;
  }

  /**
   * Release a slot back to the pool.
   */
  public releaseSlot(handle: SlotHandle): void {
    const batch = this.batches.get(handle.batchKey);
    if (!batch || !this.gl) {
      return;
    }

    const { slotIndex } = handle;
    if (slotIndex < 0 || slotIndex >= batch.capacity) {
      return;
    }

    const instance = batch.instances[slotIndex];
    if (instance && "active" in instance && (instance as { active: boolean }).active) {
      batch.activeCount = Math.max(0, batch.activeCount - 1);
    }

    batch.instances[slotIndex] = null;
    batch.freeSlots.push(slotIndex);

    // Mark as inactive in GPU data
    const instanceFloats = this.getInstanceFloats();
    const activeIndex = this.getActiveFloatIndex();
    const offset = slotIndex * instanceFloats;
    batch.instanceData[offset + activeIndex] = 0;
    batch.needsUpload = true;
  }

  /**
   * Upload dirty batch data to GPU.
   * Call before render() each frame.
   */
  public beforeRender(gl: WebGL2RenderingContext, _timestampMs: number): void {
    // Skip if gl context doesn't match (stale resources from previous context)
    if (this.gl !== gl) {
      return;
    }
    
    this.batches.forEach((batch) => {
      if (batch.gl !== gl || !batch.needsUpload) {
        return;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, batch.instanceBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.instanceData);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      batch.needsUpload = false;
    });
  }

  /**
   * Render all active batches.
   */
  public render(
    gl: WebGL2RenderingContext,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    timestampMs: number
  ): void {
    // Skip if no resources OR if gl context doesn't match (stale resources from previous context)
    if (!this.sharedResources || this.gl !== gl) {
      return;
    }

    gl.useProgram(this.sharedResources.program);
    const drawMode = this.getDrawMode(gl);

    this.batches.forEach((batch) => {
      if (batch.gl !== gl || batch.activeCount <= 0) {
        return;
      }

      this.setupRenderState(gl, batch, cameraPosition, viewportSize, timestampMs);

      const vertexCount = this.getVertexCount(batch);
      gl.bindVertexArray(batch.vao);
      gl.drawArraysInstanced(drawMode, 0, vertexCount, batch.capacity);
      gl.bindVertexArray(null);
    });
  }

  /**
   * Clear all instances from all batches.
   */
  public clearInstances(): void {
    if (!this.gl) {
      return;
    }

    const instanceFloats = this.getInstanceFloats();
    const activeIndex = this.getActiveFloatIndex();

    this.batches.forEach((batch) => {
      batch.activeCount = 0;
      batch.freeSlots.length = 0;

      for (let i = batch.capacity - 1; i >= 0; i--) {
        batch.instances[i] = null;
        batch.freeSlots.push(i);
        batch.instanceData[i * instanceFloats + activeIndex] = 0;
      }

      batch.needsUpload = true;
    });
  }

  /**
   * Get total active instance count across all batches.
   */
  public getActiveCount(): number {
    let total = 0;
    this.batches.forEach((batch) => {
      total += batch.activeCount;
    });
    return total;
  }

  /**
   * Dispose all resources.
   */
  public dispose(): void {
    // Capture references before nulling to prevent race conditions
    // where render() might check sharedResources between delete and null assignment
    const gl = this.gl;
    const sharedResources = this.sharedResources;
    
    // Null out first to prevent any render calls from using deleted resources
    this.gl = null;
    this.sharedResources = null;

    if (gl && sharedResources) {
      this.disposeSharedResources(gl);
      gl.deleteProgram(sharedResources.program);
    }

    this.batches.forEach((batch) => {
      disposeBatch(batch);
    });
    this.batches.clear();
  }
}
