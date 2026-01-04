/**
 * GPU Instanced Arc Renderer
 * Renders animated arcs with configurable uniforms per batch
 * 
 * Unified API: extends GpuBatchRenderer for consistent lifecycle and slot management
 */

import type { SceneSize, SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import { GpuBatchRenderer, type SlotHandle } from "../../core/GpuBatchRenderer";
import { compileProgram, UNIT_QUAD_STRIP } from "../../core/BaseGpuPrimitive";
import type {
  ArcInstance,
  ArcBatch,
  ArcBatchConfig,
  ArcSharedResources,
} from "./arc.types";
import {
  INSTANCE_COMPONENTS,
  INSTANCE_STRIDE,
  DEFAULT_BATCH_CAPACITY,
  ARC_VERTEX_SHADER,
  ARC_FRAGMENT_SHADER,
} from "./arc.const";

// ============================================================================
// ArcGpuRenderer Class
// ============================================================================

/**
 * GPU renderer for animated arcs.
 * Uses instanced rendering with configurable uniforms per batch.
 */
class ArcGpuRenderer extends GpuBatchRenderer<ArcInstance, ArcBatch, ArcBatchConfig> {
  private sharedResourcesExtended: ArcSharedResources | null = null;

  constructor() {
    super(DEFAULT_BATCH_CAPACITY);
  }

  protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
    const programResult = compileProgram(gl, ARC_VERTEX_SHADER, ARC_FRAGMENT_SHADER, "[ArcGpu]");
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

    const uniforms = {
      cameraPosition: gl.getUniformLocation(programResult.program, "u_cameraPosition"),
      viewportSize: gl.getUniformLocation(programResult.program, "u_viewportSize"),
      coreColor: gl.getUniformLocation(programResult.program, "u_coreColor"),
      blurColor: gl.getUniformLocation(programResult.program, "u_blurColor"),
      coreWidth: gl.getUniformLocation(programResult.program, "u_coreWidth"),
      blurWidth: gl.getUniformLocation(programResult.program, "u_blurWidth"),
      fadeStartMs: gl.getUniformLocation(programResult.program, "u_fadeStartMs"),
      noiseAmplitude: gl.getUniformLocation(programResult.program, "u_noiseAmplitude"),
      noiseDensity: gl.getUniformLocation(programResult.program, "u_noiseDensity"),
      oscAmplitude: gl.getUniformLocation(programResult.program, "u_oscAmplitude"),
      oscAngularSpeed: gl.getUniformLocation(programResult.program, "u_oscAngularSpeed"),
    };

    const attributes = {
      unitPos: gl.getAttribLocation(programResult.program, "a_unitPos"),
      from: gl.getAttribLocation(programResult.program, "a_from"),
      to: gl.getAttribLocation(programResult.program, "a_to"),
      age: gl.getAttribLocation(programResult.program, "a_age"),
      lifetime: gl.getAttribLocation(programResult.program, "a_lifetime"),
    };

    this.sharedResourcesExtended = {
      program: programResult.program,
      quadBuffer,
      uniforms,
      attributes,
    };

    return { program: programResult.program };
  }

  protected createBatch(gl: WebGL2RenderingContext, capacity: number): ArcBatch | null {
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

    // unit quad attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sharedResourcesExtended.quadBuffer);
    gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.unitPos);
    gl.vertexAttribPointer(
      this.sharedResourcesExtended.attributes.unitPos,
      2,
      gl.FLOAT,
      false,
      2 * Float32Array.BYTES_PER_ELEMENT,
      0
    );
    gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.unitPos, 0);

    // instance buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

    const enable = (loc: number, size: number, offsetFloats: number) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, INSTANCE_STRIDE, offsetFloats * Float32Array.BYTES_PER_ELEMENT);
      gl.vertexAttribDivisor(loc, 1);
    };

    enable(this.sharedResourcesExtended.attributes.from, 2, 0);
    enable(this.sharedResourcesExtended.attributes.to, 2, 2);
    enable(this.sharedResourcesExtended.attributes.age, 1, 4);
    enable(this.sharedResourcesExtended.attributes.lifetime, 1, 5);

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
      uniforms: {
        coreColor: new Float32Array([0, 0, 0, 1]),
        blurColor: new Float32Array([0, 0, 0, 1]),
        coreWidth: 0,
        blurWidth: 0,
        fadeStartMs: 0,
        noiseAmplitude: 0,
        noiseDensity: 0,
        oscAmplitude: 0,
        oscAngularSpeed: 0,
      },
    };
  }

  protected getBatchKey(config: ArcBatchConfig): string {
    return config.batchKey;
  }

  protected writeInstanceData(batch: ArcBatch, slotIndex: number, instance: ArcInstance): void {
    const offset = slotIndex * INSTANCE_COMPONENTS;
    const data = batch.instanceData;

    data[offset + 0] = instance.from.x;
    data[offset + 1] = instance.from.y;
    data[offset + 2] = instance.to.x;
    data[offset + 3] = instance.to.y;
    data[offset + 4] = Math.max(0, instance.age);
    data[offset + 5] = Math.max(0, instance.lifetime);
  }

  protected setupRenderState(
    gl: WebGL2RenderingContext,
    batch: ArcBatch,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    _timestampMs: number
  ): void {
    if (!this.sharedResourcesExtended) {
      return;
    }

    const { uniforms: sharedUniforms } = this.sharedResourcesExtended;
    const { uniforms: batchUniforms } = batch;

    // Camera uniforms (shared across batches)
    if (sharedUniforms.cameraPosition) {
      gl.uniform2f(sharedUniforms.cameraPosition, cameraPosition.x, cameraPosition.y);
    }
    if (sharedUniforms.viewportSize) {
      gl.uniform2f(sharedUniforms.viewportSize, viewportSize.width, viewportSize.height);
    }

    // Batch-specific uniforms
    if (sharedUniforms.coreColor) gl.uniform4fv(sharedUniforms.coreColor, batchUniforms.coreColor);
    if (sharedUniforms.blurColor) gl.uniform4fv(sharedUniforms.blurColor, batchUniforms.blurColor);
    if (sharedUniforms.coreWidth) gl.uniform1f(sharedUniforms.coreWidth, batchUniforms.coreWidth);
    if (sharedUniforms.blurWidth) gl.uniform1f(sharedUniforms.blurWidth, batchUniforms.blurWidth);
    if (sharedUniforms.fadeStartMs) gl.uniform1f(sharedUniforms.fadeStartMs, batchUniforms.fadeStartMs);
    if (sharedUniforms.noiseAmplitude) gl.uniform1f(sharedUniforms.noiseAmplitude, batchUniforms.noiseAmplitude);
    if (sharedUniforms.noiseDensity) gl.uniform1f(sharedUniforms.noiseDensity, batchUniforms.noiseDensity);
    if (sharedUniforms.oscAmplitude) gl.uniform1f(sharedUniforms.oscAmplitude, batchUniforms.oscAmplitude);
    if (sharedUniforms.oscAngularSpeed) gl.uniform1f(sharedUniforms.oscAngularSpeed, batchUniforms.oscAngularSpeed);
  }

  protected getInstanceFloats(): number {
    return INSTANCE_COMPONENTS;
  }

  protected getActiveFloatIndex(): number {
    // Arc doesn't have explicit active flag in data, but we track it in instances array
    // Return last index as placeholder
    return INSTANCE_COMPONENTS - 1;
  }

  protected getVertexCount(_batch: ArcBatch): number {
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
   * Override acquireSlot to set batch uniforms from config.
   */
  public override acquireSlot(config: ArcBatchConfig): SlotHandle | null {
    const handle = super.acquireSlot(config);
    if (!handle) {
      return null;
    }

    const batch = this.batches.get(handle.batchKey);
    if (batch) {
      // Copy uniforms from config to batch
      batch.uniforms = {
        coreColor: new Float32Array(config.uniforms.coreColor),
        blurColor: new Float32Array(config.uniforms.blurColor),
        coreWidth: config.uniforms.coreWidth,
        blurWidth: config.uniforms.blurWidth,
        fadeStartMs: config.uniforms.fadeStartMs,
        noiseAmplitude: config.uniforms.noiseAmplitude,
        noiseDensity: config.uniforms.noiseDensity,
        oscAmplitude: config.uniforms.oscAmplitude,
        oscAngularSpeed: config.uniforms.oscAngularSpeed,
      };
    }

    return handle;
  }
}

// ============================================================================
// Public API - Single instance with unified interface
// ============================================================================

export const arcGpuRenderer = new ArcGpuRenderer();

// Re-export types for backward compatibility
export type ArcSlotHandle = SlotHandle;
export type {
  ArcInstance,
  ArcGpuUniforms,
  ArcBatchConfig,
} from "./arc.types";
