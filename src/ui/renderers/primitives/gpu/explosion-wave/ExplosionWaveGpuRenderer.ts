/**
 * GPU Instanced Explosion Wave Renderer
 * Renders animated explosion wave effects
 * 
 * Unified API: extends GpuBatchRenderer for consistent lifecycle and slot management
 * Uses shared resources from ParticleEmitterGpuRenderer
 */

import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { GpuBatchRenderer, type SlotHandle } from "../../core/GpuBatchRenderer";
import {
  getParticleRenderResources,
  uploadEmitterUniformsPublic,
} from "../particle-emitter";
import type { ParticleEmitterGpuRenderUniforms } from "../particle-emitter";
import type {
  WaveInstance,
  WaveBatch,
  WaveUniformConfig,
  WaveSharedResources,
} from "./explosion-wave.types";
import {
  INSTANCE_COMPONENTS,
  INSTANCE_STRIDE,
  DEFAULT_BATCH_CAPACITY,
  serializeWaveConfig,
} from "./explosion-wave.const";

// ============================================================================
// ExplosionWaveGpuRenderer Class
// ============================================================================

/**
 * GPU renderer for animated explosion wave effects.
 * Uses instanced rendering with shared resources from ParticleEmitterGpuRenderer.
 */
class ExplosionWaveGpuRenderer extends GpuBatchRenderer<WaveInstance, WaveBatch, WaveUniformConfig> {
  private sharedResourcesExtended: WaveSharedResources | null = null;

  constructor() {
    super(DEFAULT_BATCH_CAPACITY);
  }

  protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
    const resources = getParticleRenderResources(gl);
    if (!resources) {
      return null;
    }

    this.sharedResourcesExtended = {
      program: resources.program.program,
      quadBuffer: resources.quadBuffer,
      attributes: {
        unitPosition: resources.program.attributes.unitPosition,
        position: resources.program.attributes.position,
        size: resources.program.attributes.size,
        startAlpha: resources.program.attributes.startAlpha,
        endAlpha: resources.program.attributes.endAlpha,
        age: resources.program.attributes.age,
        lifetime: resources.program.attributes.lifetime,
        isActive: resources.program.attributes.isActive,
      },
    };

    return { program: resources.program.program };
  }

  protected createBatch(gl: WebGL2RenderingContext, capacity: number): WaveBatch | null {
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

    // Quad positions from shared buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sharedResourcesExtended.quadBuffer);
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
    bindAttribute(attrs.position, 2, 0);
    bindAttribute(attrs.size, 1, 2 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.age, 1, 3 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.lifetime, 1, 4 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.isActive, 1, 5 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.startAlpha, 1, 6 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.endAlpha, 1, 7 * Float32Array.BYTES_PER_ELEMENT);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const freeSlots: number[] = [];
    for (let i = capacity - 1; i >= 0; i--) {
      freeSlots.push(i);
    }

    // Create default uniforms (will be set in setupRenderState)
    const defaultUniforms: ParticleEmitterGpuRenderUniforms = {
      fillType: 0,
      stopCount: 0,
      stopOffsets: new Float32Array(5),
      stopColor0: new Float32Array(4),
      stopColor1: new Float32Array(4),
      stopColor2: new Float32Array(4),
      stopColor3: new Float32Array(4),
      stopColor4: new Float32Array(4),
      noiseColorAmplitude: 0,
      noiseAlphaAmplitude: 0,
      noiseScale: 1,
      noiseDensity: 1,
      filamentColorContrast: 0,
      filamentAlphaContrast: 0,
      filamentWidth: 0,
      filamentDensity: 0,
      filamentEdgeBlur: 0,
      hasLinearStart: false,
      linearStart: { x: 0, y: 0 },
      hasLinearEnd: false,
      linearEnd: { x: 0, y: 0 },
      hasRadialOffset: false,
      radialOffset: { x: 0, y: 0 },
      hasExplicitRadius: false,
      explicitRadius: 0,
      fadeStartMs: 0,
      defaultLifetimeMs: 1000,
      shape: 1, // circle
      minParticleSize: 0.0001,
      lengthMultiplier: 1,
      alignToVelocity: false,
      alignToVelocityFlip: false,
      sizeGrowthRate: 1.0,
    };

    const batch: WaveBatch = {
      gl,
      capacity,
      instanceBuffer,
      vao,
      freeSlots,
      activeCount: 0,
      instances: new Array(capacity).fill(null),
      needsUpload: false,
      instanceData: new Float32Array(capacity * INSTANCE_COMPONENTS),
      uniforms: defaultUniforms,
    };

    return batch;
  }

  protected getBatchKey(config: WaveUniformConfig): string {
    return serializeWaveConfig(config);
  }

  protected writeInstanceData(batch: WaveBatch, slotIndex: number, instance: WaveInstance): void {
    if (slotIndex < 0 || slotIndex >= batch.capacity) {
      return;
    }

    // Get previous active state BEFORE writing new data
    const prevInstance = batch.instances[slotIndex];
    const prevActive = prevInstance?.active ?? false;

    const offset = slotIndex * INSTANCE_COMPONENTS;
    const data = batch.instanceData;

    data[offset + 0] = instance.position.x;
    data[offset + 1] = instance.position.y;
    data[offset + 2] = Math.max(0, instance.size);
    data[offset + 3] = Math.max(0, instance.age);
    data[offset + 4] = Math.max(0, instance.lifetime);
    data[offset + 5] = instance.active ? 1 : 0;
    data[offset + 6] = Math.max(0, Math.min(1, instance.startAlpha));
    data[offset + 7] = Math.max(0, Math.min(1, instance.endAlpha));

    // Update activeCount based on active state change
    if (instance.active && !prevActive) {
      batch.activeCount++;
    } else if (!instance.active && prevActive) {
      batch.activeCount = Math.max(0, batch.activeCount - 1);
    }
  }

  protected setupRenderState(
    gl: WebGL2RenderingContext,
    batch: WaveBatch,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    _timestampMs: number
  ): void {
    if (!this.sharedResourcesExtended) {
      return;
    }
    // Upload uniforms for this batch
    uploadEmitterUniformsPublic(gl, batch.uniforms, cameraPosition, viewportSize);
  }

  protected getInstanceFloats(): number {
    return INSTANCE_COMPONENTS;
  }

  protected getActiveFloatIndex(): number {
    return 5; // isActive flag
  }

  protected getVertexCount(_batch: WaveBatch): number {
    return 4; // TRIANGLE_STRIP quad
  }

  protected getDrawMode(gl: WebGL2RenderingContext): number {
    return gl.TRIANGLE_STRIP;
  }

  protected override disposeSharedResources(_gl: WebGL2RenderingContext): void {
    // Shared resources are managed by ParticleEmitterGpuRenderer
    this.sharedResourcesExtended = null;
  }

  /**
   * Override acquireSlot to set uniforms from config.
   * Does NOT increment activeCount - that's done in writeInstanceData based on instance.active.
   */
  public override acquireSlot(config: WaveUniformConfig): SlotHandle | null {
    if (!this.gl || !this.sharedResources) {
      return null;
    }

    const key = this.getBatchKey(config);
    let batch = this.batches.get(key);
    let isNewBatch = false;

    if (!batch) {
      const newBatch = this.createBatch(this.gl, this.defaultCapacity);
      if (!newBatch) {
        return null;
      }
      batch = newBatch;
      this.batches.set(key, batch);
      isNewBatch = true;
    } else if (batch.freeSlots.length === 0) {
      return null;
    }

    const slotIndex = batch.freeSlots.pop()!;
    // DON'T increment batch.activeCount here - writeInstanceData handles it based on instance.active
    batch.instances[slotIndex] = null;

    // Only set uniforms for new batches or empty batches (no active instances)
    // This prevents flickering when multiple explosions share a batch
    if (isNewBatch || batch.activeCount === 0) {
      const uniforms = this.convertConfigToUniforms(config);
      batch.uniforms = uniforms;
    }

    return { batchKey: key, slotIndex };
  }

  /**
   * Override releaseSlot to properly update handle.activeCount
   * Note: We don't delete empty batches here - they will be reused for subsequent explosions
   * of the same type. Cleanup happens in clearInstances() on map reset.
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

    // Check if instance was active before releasing
    const instance = batch.instances[slotIndex];
    const wasActive = instance?.active ?? false;

    // Release the slot
    batch.instances[slotIndex] = null;
    batch.freeSlots.push(slotIndex);

    // Mark as inactive in GPU data
    const offset = slotIndex * INSTANCE_COMPONENTS;
    batch.instanceData[offset + 5] = 0; // isActive = 0

    // Update activeCount if instance was active
    if (wasActive) {
      batch.activeCount = Math.max(0, batch.activeCount - 1);
    }

    batch.needsUpload = true;
  }

  /**
   * Override clearInstances to clear batches completely.
   * This ensures clean state after map restart.
   */
  public override clearInstances(): void {
    // Clear all batches (they'll be recreated on demand)
    this.batches.forEach((batch) => {
      if (batch.vao) batch.gl.deleteVertexArray(batch.vao);
      if (batch.instanceBuffer) batch.gl.deleteBuffer(batch.instanceBuffer);
    });
    this.batches.clear();
  }

  private convertConfigToUniforms(config: WaveUniformConfig): ParticleEmitterGpuRenderUniforms {
    return {
      fillType: config.fillType,
      stopCount: config.stopCount,
      stopOffsets: config.stopOffsets,
      stopColor0: config.stopColor0,
      stopColor1: config.stopColor1,
      stopColor2: config.stopColor2,
      stopColor3: config.stopColor3,
      stopColor4: config.stopColor4,
      noiseColorAmplitude: config.noiseColorAmplitude,
      noiseAlphaAmplitude: config.noiseAlphaAmplitude,
      noiseScale: config.noiseScale,
      noiseDensity: config.noiseDensity ?? 1,
      filamentColorContrast: config.filamentColorContrast ?? 0,
      filamentAlphaContrast: config.filamentAlphaContrast ?? 0,
      filamentWidth: config.filamentWidth ?? 0,
      filamentDensity: config.filamentDensity ?? 0,
      filamentEdgeBlur: config.filamentEdgeBlur ?? 0,
      hasLinearStart: config.hasLinearStart ?? false,
      linearStart: config.linearStart ?? { x: 0, y: 0 },
      hasLinearEnd: config.hasLinearEnd ?? false,
      linearEnd: config.linearEnd ?? { x: 0, y: 0 },
      hasRadialOffset: config.hasRadialOffset ?? false,
      radialOffset: config.radialOffset ?? { x: 0, y: 0 },
      hasExplicitRadius: config.hasExplicitRadius ?? false,
      explicitRadius: config.explicitRadius ?? 0,
      fadeStartMs: config.fadeStartMs,
      defaultLifetimeMs: config.defaultLifetimeMs,
      shape: 1, // circle
      minParticleSize: 0.0001,
      lengthMultiplier: 1,
      alignToVelocity: false,
      alignToVelocityFlip: false,
      sizeGrowthRate: 1.0,
    };
  }
}

// ============================================================================
// Public API - Single instance with unified interface
// ============================================================================

export const explosionWaveGpuRenderer = new ExplosionWaveGpuRenderer();

// Re-export types
export type WaveSlotHandle = SlotHandle;
