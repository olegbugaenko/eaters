/**
 * GPU Instanced Petal Aura Renderer
 * Renders animated petal auras around units
 * 
 * Unified API: extends GpuBatchRenderer for consistent lifecycle and slot management
 * 
 * Note: One PetalAuraInstance can occupy multiple slots (petalCount), so updateSlot
 * writes to multiple consecutive slots starting from the handle's slotIndex.
 */

import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { GpuBatchRenderer, type SlotHandle } from "../../core/GpuBatchRenderer";
import { compileProgram } from "../../core/BaseGpuPrimitive";
import type {
  PetalAuraInstance,
  PetalAuraBatch,
  PetalAuraSharedResources,
} from "./petal-aura.types";
import {
  INSTANCE_COMPONENTS,
  INSTANCE_STRIDE,
  DEFAULT_BATCH_CAPACITY,
  PETAL_VERTICES,
  PETAL_VERTEX_SHADER,
  PETAL_FRAGMENT_SHADER,
} from "./petal-aura.const";

// ============================================================================
// PetalAuraGpuRenderer Class
// ============================================================================

/**
 * GPU renderer for animated petal auras.
 * Uses instanced rendering. One instance can occupy multiple slots (petalCount).
 */
class PetalAuraGpuRenderer extends GpuBatchRenderer<PetalAuraInstance, PetalAuraBatch, void> {
  private sharedResourcesExtended: PetalAuraSharedResources | null = null;

  constructor() {
    super(DEFAULT_BATCH_CAPACITY);
  }

  protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
    const programResult = compileProgram(gl, PETAL_VERTEX_SHADER, PETAL_FRAGMENT_SHADER, "[PetalAuraGpu]");
    if (!programResult) {
      return null;
    }

    const petalBuffer = gl.createBuffer();
    if (!petalBuffer) {
      gl.deleteProgram(programResult.program);
      return null;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, petalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, PETAL_VERTICES, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const attributes = {
      unitPosition: gl.getAttribLocation(programResult.program, "a_unitPosition"),
      center: gl.getAttribLocation(programResult.program, "a_center"),
      basePhase: gl.getAttribLocation(programResult.program, "a_basePhase"),
      petalIndex: gl.getAttribLocation(programResult.program, "a_petalIndex"),
      petalCount: gl.getAttribLocation(programResult.program, "a_petalCount"),
      innerRadius: gl.getAttribLocation(programResult.program, "a_innerRadius"),
      outerRadius: gl.getAttribLocation(programResult.program, "a_outerRadius"),
      petalWidth: gl.getAttribLocation(programResult.program, "a_petalWidth"),
      rotationSpeed: gl.getAttribLocation(programResult.program, "a_rotationSpeed"),
      color: gl.getAttribLocation(programResult.program, "a_color"),
      alpha: gl.getAttribLocation(programResult.program, "a_alpha"),
      active: gl.getAttribLocation(programResult.program, "a_active"),
      pointInward: gl.getAttribLocation(programResult.program, "a_pointInward"),
    };

    const uniforms = {
      cameraPosition: gl.getUniformLocation(programResult.program, "u_cameraPosition"),
      viewportSize: gl.getUniformLocation(programResult.program, "u_viewportSize"),
      time: gl.getUniformLocation(programResult.program, "u_time"),
    };

    this.sharedResourcesExtended = {
      program: programResult.program,
      petalBuffer,
      uniforms,
      attributes,
    };

    return { program: programResult.program };
  }

  protected createBatch(gl: WebGL2RenderingContext, capacity: number): PetalAuraBatch | null {
    if (!this.sharedResourcesExtended) {
      return null;
    }

    const instanceBuffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    if (!instanceBuffer || !vao) {
      if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
      if (vao) gl.deleteVertexArray(vao);
      return null;
    }

    gl.bindVertexArray(vao);

    // Petal vertices attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sharedResourcesExtended.petalBuffer);
    if (this.sharedResourcesExtended.attributes.unitPosition >= 0) {
      gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.unitPosition);
      gl.vertexAttribPointer(
        this.sharedResourcesExtended.attributes.unitPosition,
        2,
        gl.FLOAT,
        false,
        2 * Float32Array.BYTES_PER_ELEMENT,
        0
      );
      gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.unitPosition, 0);
    }

    // Instance buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

    const bindAttribute = (location: number, size: number, offset: number) => {
      if (location < 0) {
        return;
      }
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(location, 1);
    };

    const attrs = this.sharedResourcesExtended.attributes;
    bindAttribute(attrs.center, 2, 0);
    bindAttribute(attrs.basePhase, 1, 2 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.petalIndex, 1, 3 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.petalCount, 1, 4 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.innerRadius, 1, 5 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.outerRadius, 1, 6 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.petalWidth, 1, 7 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.rotationSpeed, 1, 8 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.color, 3, 9 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.alpha, 1, 12 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.active, 1, 13 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.pointInward, 1, 14 * Float32Array.BYTES_PER_ELEMENT);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const freeSlots: number[] = [];
    for (let i = capacity - 1; i >= 0; i--) {
      freeSlots.push(i);
    }

    return {
      gl,
      capacity,
      instanceBuffer,
      vao,
      freeSlots,
      activeCount: 0,
      instances: new Array(capacity).fill(null),
      needsUpload: false,
      instanceData: new Float32Array(capacity * INSTANCE_COMPONENTS),
    };
  }

  protected getBatchKey(_config: void): string {
    return "default"; // PetalAuras don't have configs
  }

  protected writeInstanceData(batch: PetalAuraBatch, slotIndex: number, instance: PetalAuraInstance): void {
    const petalCount = Math.max(1, Math.floor(instance.petalCount));
    const clampedIndex = Math.max(0, Math.min(slotIndex, batch.capacity - petalCount));

    // Get previous active state BEFORE writing new data
    const prevInstance = batch.instances[clampedIndex];
    const prevActive = prevInstance?.active ?? false;

    // Write each petal to consecutive slots
    for (let i = 0; i < petalCount; i += 1) {
      const index = clampedIndex + i;
      if (index >= batch.capacity) {
        break;
      }

      const offset = index * INSTANCE_COMPONENTS;
      const data = batch.instanceData;

      data[offset + 0] = instance.position.x;
      data[offset + 1] = instance.position.y;
      data[offset + 2] = instance.basePhase;
      data[offset + 3] = i; // petalIndex
      data[offset + 4] = petalCount;
      data[offset + 5] = instance.innerRadius;
      data[offset + 6] = instance.outerRadius;
      data[offset + 7] = instance.petalWidth;
      data[offset + 8] = instance.rotationSpeed;
      data[offset + 9] = instance.color[0];
      data[offset + 10] = instance.color[1];
      data[offset + 11] = instance.color[2];
      data[offset + 12] = instance.alpha;
      data[offset + 13] = instance.active ? 1 : 0;
      data[offset + 14] = instance.pointInward ? 1 : 0;

      // Track instance in first slot only (don't update batch.instances here - base class does it)
    }

    // Update activeCount based on active state change
    if (instance.active && !prevActive) {
      // Instance became active - add all petals
      batch.activeCount += petalCount;
    } else if (!instance.active && prevActive) {
      // Instance became inactive - remove all petals
      batch.activeCount = Math.max(0, batch.activeCount - petalCount);
    }
    // If active state didn't change, don't modify activeCount
  }

  protected setupRenderState(
    gl: WebGL2RenderingContext,
    _batch: PetalAuraBatch,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    timestampMs: number
  ): void {
    if (!this.sharedResourcesExtended) {
      return;
    }

    const { uniforms } = this.sharedResourcesExtended;

    if (uniforms.cameraPosition) {
      gl.uniform2f(uniforms.cameraPosition, cameraPosition.x, cameraPosition.y);
    }
    if (uniforms.viewportSize) {
      gl.uniform2f(uniforms.viewportSize, viewportSize.width, viewportSize.height);
    }
    if (uniforms.time) {
      gl.uniform1f(uniforms.time, timestampMs);
    }

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  protected getInstanceFloats(): number {
    return INSTANCE_COMPONENTS;
  }

  protected getActiveFloatIndex(): number {
    return 13; // active flag
  }

  protected getVertexCount(_batch: PetalAuraBatch): number {
    return 3; // TRIANGLES (petal triangle)
  }

  protected getDrawMode(gl: WebGL2RenderingContext): number {
    return gl.TRIANGLES;
  }

  protected override disposeSharedResources(gl: WebGL2RenderingContext): void {
    if (this.sharedResourcesExtended?.petalBuffer) {
      gl.deleteBuffer(this.sharedResourcesExtended.petalBuffer);
    }
    this.sharedResourcesExtended = null;
  }

  /**
   * Override releaseSlot to handle multi-slot instances (petalCount).
   */
  public override releaseSlot(handle: SlotHandle): void {
    const batch = this.batches.get(handle.batchKey);
    if (!batch || !this.gl) {
      return;
    }

    const { slotIndex } = handle;
    if (slotIndex < 0 || slotIndex >= batch.capacity) {
      return;
    }

    // Find the instance to determine petalCount
    const instance = batch.instances[slotIndex];
    const petalCount = instance ? Math.max(1, Math.floor(instance.petalCount)) : 1;
    
    // Get previous active state from first slot only
    const prevActive = instance?.active ?? false;

    // Release all slots for this instance
    for (let i = 0; i < petalCount; i += 1) {
      const index = slotIndex + i;
      if (index >= batch.capacity) {
        break;
      }

      batch.instances[index] = null;
      if (!batch.freeSlots.includes(index)) {
        batch.freeSlots.push(index);
      }

      // Mark as inactive in GPU data
      const instanceFloats = this.getInstanceFloats();
      const activeIndex = this.getActiveFloatIndex();
      const offset = index * instanceFloats;
      batch.instanceData[offset + activeIndex] = 0;
    }
    
    // Update activeCount based on previous state (only once for the whole instance)
    if (prevActive) {
      batch.activeCount = Math.max(0, batch.activeCount - petalCount);
    }

    batch.needsUpload = true;
  }

  /**
   * Acquire multiple consecutive slots for a petal aura instance.
   * @param petalCount - Number of petals (slots) needed
   * @returns Handle to first slot, or null if not enough slots available
   */
  public acquirePetalSlot(petalCount: number): SlotHandle | null {
    if (!this.gl || !this.sharedResources || petalCount <= 0) {
      return null;
    }

    const key = this.getBatchKey(undefined);
    let batch: PetalAuraBatch | undefined = this.batches.get(key);

    if (!batch) {
      const newBatch = this.createBatch(this.gl, this.defaultCapacity);
      if (!newBatch) {
        return null;
      }
      batch = newBatch;
      this.batches.set(key, batch);
    }

    // Find consecutive free slots
    const needed = Math.max(1, Math.floor(petalCount));
    if (batch.freeSlots.length < needed) {
      return null;
    }

    // Find consecutive slots starting from a free slot
    // Sort free slots to find consecutive ranges
    const sortedFreeSlots = [...batch.freeSlots].sort((a, b) => a - b);
    
    for (let startIdx = 0; startIdx <= sortedFreeSlots.length - needed; startIdx++) {
      const startSlot = sortedFreeSlots[startIdx];
      if (startSlot === undefined) {
        continue;
      }
      
      let consecutive = true;
      
      // Check if slots from startSlot to startSlot + needed - 1 are all free
      for (let i = 0; i < needed; i++) {
        const checkSlot = startSlot + i;
        if (checkSlot >= batch.capacity || !batch.freeSlots.includes(checkSlot)) {
          consecutive = false;
          break;
        }
      }
      
      if (consecutive) {
        // Reserve all consecutive slots
        for (let i = 0; i < needed; i++) {
          const slotToReserve = startSlot + i;
          const freeIndex = batch.freeSlots.indexOf(slotToReserve);
          if (freeIndex >= 0) {
            batch.freeSlots.splice(freeIndex, 1);
          }
          batch.instances[slotToReserve] = null;
        }
        
        return { batchKey: key, slotIndex: startSlot };
      }
    }

    // No consecutive slots found
    return null;
  }
}

// ============================================================================
// Public API - Single instance with unified interface
// ============================================================================

export const petalAuraGpuRenderer = new PetalAuraGpuRenderer();

// Re-export types
export type PetalAuraSlotHandle = SlotHandle;
