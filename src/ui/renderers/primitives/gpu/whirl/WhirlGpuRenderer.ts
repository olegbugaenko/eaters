/**
 * GPU Instanced Whirl Renderer
 * Renders animated spiral whirl effects
 * 
 * Unified API: extends GpuBatchRenderer for consistent lifecycle and slot management
 */

import type { SceneSize, SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import { GpuBatchRenderer, type SlotHandle } from "../../core/GpuBatchRenderer";
import { compileProgram, UNIT_QUAD_STRIP } from "../../core/BaseGpuPrimitive";
import type {
  WhirlInstance,
  WhirlBatch,
  WhirlSharedResources,
} from "./whirl.types";
import {
  INSTANCE_COMPONENTS,
  INSTANCE_STRIDE,
  DEFAULT_BATCH_CAPACITY,
  WHIRL_VERTEX_SHADER,
  WHIRL_FRAGMENT_SHADER,
} from "./whirl.const";

// ============================================================================
// WhirlGpuRenderer Class
// ============================================================================

/**
 * GPU renderer for animated spiral whirl effects.
 * Uses instanced rendering with a single draw call per batch.
 */
class WhirlGpuRenderer extends GpuBatchRenderer<WhirlInstance, WhirlBatch, void> {
  private sharedResourcesExtended: WhirlSharedResources | null = null;

  constructor() {
    super(DEFAULT_BATCH_CAPACITY);
  }

  protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
    const programResult = compileProgram(gl, WHIRL_VERTEX_SHADER, WHIRL_FRAGMENT_SHADER, "[WhirlGpu]");
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
      radius: gl.getAttribLocation(programResult.program, "a_radius"),
      phase: gl.getAttribLocation(programResult.program, "a_phase"),
      intensity: gl.getAttribLocation(programResult.program, "a_intensity"),
      active: gl.getAttribLocation(programResult.program, "a_active"),
      rotationSpeedMultiplier: gl.getAttribLocation(programResult.program, "a_rotationSpeedMultiplier"),
      spiralArms: gl.getAttribLocation(programResult.program, "a_spiralArms"),
      spiralArms2: gl.getAttribLocation(programResult.program, "a_spiralArms2"),
      spiralTwist: gl.getAttribLocation(programResult.program, "a_spiralTwist"),
      spiralTwist2: gl.getAttribLocation(programResult.program, "a_spiralTwist2"),
      colorInner: gl.getAttribLocation(programResult.program, "a_colorInner"),
      colorMid: gl.getAttribLocation(programResult.program, "a_colorMid"),
      colorOuter: gl.getAttribLocation(programResult.program, "a_colorOuter"),
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

  protected createBatch(gl: WebGL2RenderingContext, capacity: number): WhirlBatch | null {
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

    // Unit quad attribute
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
    bindAttribute(attrs.center, 2, 0);
    bindAttribute(attrs.radius, 1, 2 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.phase, 1, 3 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.intensity, 1, 4 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.active, 1, 5 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.rotationSpeedMultiplier, 1, 6 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.spiralArms, 1, 7 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.spiralArms2, 1, 8 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.spiralTwist, 1, 9 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.spiralTwist2, 1, 10 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.colorInner, 3, 11 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.colorMid, 3, 14 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.colorOuter, 3, 17 * Float32Array.BYTES_PER_ELEMENT);

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
    return "default"; // Whirls don't have configs
  }

  protected writeInstanceData(batch: WhirlBatch, slotIndex: number, instance: WhirlInstance): void {
    const offset = slotIndex * INSTANCE_COMPONENTS;
    const data = batch.instanceData;

    data[offset + 0] = instance.position.x;
    data[offset + 1] = instance.position.y;
    data[offset + 2] = instance.radius;
    data[offset + 3] = instance.phase;
    data[offset + 4] = instance.intensity;
    data[offset + 5] = instance.active ? 1 : 0;
    data[offset + 6] = instance.rotationSpeedMultiplier;
    data[offset + 7] = instance.spiralArms;
    data[offset + 8] = instance.spiralArms2;
    data[offset + 9] = instance.spiralTwist;
    data[offset + 10] = instance.spiralTwist2;
    data[offset + 11] = instance.colorInner[0];
    data[offset + 12] = instance.colorInner[1];
    data[offset + 13] = instance.colorInner[2];
    data[offset + 14] = instance.colorMid[0];
    data[offset + 15] = instance.colorMid[1];
    data[offset + 16] = instance.colorMid[2];
    data[offset + 17] = instance.colorOuter[0];
    data[offset + 18] = instance.colorOuter[1];
    data[offset + 19] = instance.colorOuter[2];
  }

  protected setupRenderState(
    gl: WebGL2RenderingContext,
    _batch: WhirlBatch,
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
  }

  protected getInstanceFloats(): number {
    return INSTANCE_COMPONENTS;
  }

  protected getActiveFloatIndex(): number {
    return 5; // active flag
  }

  protected getVertexCount(_batch: WhirlBatch): number {
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
}

// ============================================================================
// Public API - Single instance with unified interface
// ============================================================================

export const whirlGpuRenderer = new WhirlGpuRenderer();

// Re-export types
export type WhirlSlotHandle = SlotHandle;
