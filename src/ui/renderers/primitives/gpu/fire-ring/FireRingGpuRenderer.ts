/**
 * GPU Instanced Fire Ring Renderer
 * Renders animated fire rings with age computed on GPU
 * 
 * Unified API: extends GpuBatchRenderer for consistent lifecycle and slot management
 */

import type { SceneSize, SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import { GpuBatchRenderer, type SlotHandle } from "../../core/GpuBatchRenderer";
import { compileProgram, UNIT_QUAD_STRIP } from "../../core/BaseGpuPrimitive";
import type {
  FireRingInstance,
  FireRingBatch,
  FireRingSharedResources,
} from "./fire-ring.types";
import {
  INSTANCE_COMPONENTS,
  INSTANCE_STRIDE,
  DEFAULT_BATCH_CAPACITY,
  FIRE_RING_VERTEX_SHADER,
  FIRE_RING_FRAGMENT_SHADER,
} from "./fire-ring.const";

// ============================================================================
// FireRingGpuRenderer Class
// ============================================================================

/**
 * GPU renderer for animated fire rings.
 * Uses instanced rendering with age computed on GPU.
 */
class FireRingGpuRenderer extends GpuBatchRenderer<FireRingInstance, FireRingBatch, void> {
  private sharedResourcesExtended: FireRingSharedResources | null = null;

  constructor() {
    super(DEFAULT_BATCH_CAPACITY);
  }

  protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
    const programResult = compileProgram(gl, FIRE_RING_VERTEX_SHADER, FIRE_RING_FRAGMENT_SHADER, "[FireRingGpu]");
    if (!programResult) {
      return null;
    }

    const quadBuffer = gl.createBuffer();
    if (!quadBuffer) {
      gl.deleteProgram(programResult.program);
      return null;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_STRIP, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const attributes = {
      unitPosition: gl.getAttribLocation(programResult.program, "a_unitPosition"),
      center: gl.getAttribLocation(programResult.program, "a_center"),
      innerRadius: gl.getAttribLocation(programResult.program, "a_innerRadius"),
      outerRadius: gl.getAttribLocation(programResult.program, "a_outerRadius"),
      birthTimeMs: gl.getAttribLocation(programResult.program, "a_birthTimeMs"),
      lifetime: gl.getAttribLocation(programResult.program, "a_lifetime"),
      intensity: gl.getAttribLocation(programResult.program, "a_intensity"),
      color: gl.getAttribLocation(programResult.program, "a_color"),
      active: gl.getAttribLocation(programResult.program, "a_active"),
    };

    const uniforms = {
      cameraPosition: gl.getUniformLocation(programResult.program, "u_cameraPosition"),
      viewportSize: gl.getUniformLocation(programResult.program, "u_viewportSize"),
      time: gl.getUniformLocation(programResult.program, "u_time"),
    };

    this.sharedResourcesExtended = {
      program: programResult.program,
      quadBuffer,
      uniforms,
      attributes,
    };

    return { program: programResult.program };
  }

  protected createBatch(gl: WebGL2RenderingContext, capacity: number): FireRingBatch | null {
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

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

    gl.bindVertexArray(vao);

    // Quad attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sharedResourcesExtended.quadBuffer);
    if (this.sharedResourcesExtended.attributes.unitPosition >= 0) {
      gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.unitPosition);
      gl.vertexAttribPointer(
        this.sharedResourcesExtended.attributes.unitPosition,
        2,
        gl.FLOAT,
        false,
        0,
        0
      );
      gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.unitPosition, 0);
    }

    // Instance attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    const attrs = this.sharedResourcesExtended.attributes;
    let offset = 0;

    if (attrs.center >= 0) {
      gl.enableVertexAttribArray(attrs.center);
      gl.vertexAttribPointer(attrs.center, 2, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.center, 1);
      offset += 2 * Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.innerRadius >= 0) {
      gl.enableVertexAttribArray(attrs.innerRadius);
      gl.vertexAttribPointer(attrs.innerRadius, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.innerRadius, 1);
      offset += Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.outerRadius >= 0) {
      gl.enableVertexAttribArray(attrs.outerRadius);
      gl.vertexAttribPointer(attrs.outerRadius, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.outerRadius, 1);
      offset += Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.birthTimeMs >= 0) {
      gl.enableVertexAttribArray(attrs.birthTimeMs);
      gl.vertexAttribPointer(attrs.birthTimeMs, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.birthTimeMs, 1);
      offset += Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.lifetime >= 0) {
      gl.enableVertexAttribArray(attrs.lifetime);
      gl.vertexAttribPointer(attrs.lifetime, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.lifetime, 1);
      offset += Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.intensity >= 0) {
      gl.enableVertexAttribArray(attrs.intensity);
      gl.vertexAttribPointer(attrs.intensity, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.intensity, 1);
      offset += Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.color >= 0) {
      gl.enableVertexAttribArray(attrs.color);
      gl.vertexAttribPointer(attrs.color, 3, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.color, 1);
      offset += 3 * Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.active >= 0) {
      gl.enableVertexAttribArray(attrs.active);
      gl.vertexAttribPointer(attrs.active, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.active, 1);
    }

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
    return "default"; // FireRings don't have configs
  }

  protected writeInstanceData(batch: FireRingBatch, slotIndex: number, instance: FireRingInstance): void {
    const offset = slotIndex * INSTANCE_COMPONENTS;
    const data = batch.instanceData;

    data[offset + 0] = instance.center.x;
    data[offset + 1] = instance.center.y;
    data[offset + 2] = instance.innerRadius;
    data[offset + 3] = instance.outerRadius;
    data[offset + 4] = instance.birthTimeMs;
    data[offset + 5] = instance.lifetime;
    data[offset + 6] = instance.intensity;
    data[offset + 7] = instance.color.r ?? 1.0;
    data[offset + 8] = instance.color.g ?? 1.0;
    data[offset + 9] = instance.color.b ?? 1.0;
    data[offset + 10] = instance.active ? 1 : 0;
  }

  protected setupRenderState(
    gl: WebGL2RenderingContext,
    _batch: FireRingBatch,
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
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE); // soft additive
  }

  protected getInstanceFloats(): number {
    return INSTANCE_COMPONENTS;
  }

  protected getActiveFloatIndex(): number {
    return 10; // active flag
  }

  protected getVertexCount(_batch: FireRingBatch): number {
    return 4; // TRIANGLE_STRIP quad
  }

  protected getDrawMode(gl: WebGL2RenderingContext): number {
    return gl.TRIANGLE_STRIP;
  }

  protected override disposeSharedResources(gl: WebGL2RenderingContext): void {
    if (this.sharedResourcesExtended?.quadBuffer) {
      gl.deleteBuffer(this.sharedResourcesExtended.quadBuffer);
    }
    this.sharedResourcesExtended = null;
  }

  /**
   * Override render to restore default blend func after rendering
   */
  public override render(
    gl: WebGL2RenderingContext,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    timestampMs: number
  ): void {
    super.render(gl, cameraPosition, viewportSize, timestampMs);
    
    // Restore default blend func
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );
  }
}

// ============================================================================
// Public API - Single instance with unified interface
// ============================================================================

export const fireRingGpuRenderer = new FireRingGpuRenderer();

// Re-export types
export type FireRingSlotHandle = SlotHandle;

// ============================================================================
// Helper functions for backward compatibility
// ============================================================================

/**
 * Add a fire ring instance (acquires slot automatically)
 */
export const addFireRingInstance = (
  gl: WebGL2RenderingContext,
  instance: FireRingInstance
): void => {
  // Set context if not already set
  if (fireRingGpuRenderer["gl"] !== gl) {
    fireRingGpuRenderer.setContext(gl);
  }

  // Acquire slot and update
  const handle = fireRingGpuRenderer.acquireSlot(undefined);
  if (handle) {
    fireRingGpuRenderer.updateSlot(handle, instance);
  }
};

/**
 * Update fire ring instance (marks as inactive if lifetime expired)
 */
export const updateFireRing = (
  _gl: WebGL2RenderingContext,
  instance: FireRingInstance,
  nowMs: number
): void => {
  if (!instance.active) return;
  if (instance.lifetime > 0) {
    const age = nowMs - instance.birthTimeMs;
    if (age >= instance.lifetime) {
      instance.active = false;
    }
  }
};

/**
 * Render fire rings
 */
export const renderFireRings = (
  gl: WebGL2RenderingContext,
  cameraPosition: SceneVector2,
  viewportSize: { width: number; height: number },
  timeMs: number
): void => {
  fireRingGpuRenderer.beforeRender(gl, timeMs);
  fireRingGpuRenderer.render(gl, cameraPosition, viewportSize, timeMs);
};

/**
 * Dispose fire ring resources
 */
export const disposeFireRing = (gl: WebGL2RenderingContext): void => {
  fireRingGpuRenderer.setContext(null);
};
