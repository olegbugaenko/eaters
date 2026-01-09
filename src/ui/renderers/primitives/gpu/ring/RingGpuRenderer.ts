/**
 * GPU Instanced Ring Renderer
 * Renders animated expanding rings with a single draw call per batch
 * 
 * Unified API: extends GpuBatchRenderer for consistent lifecycle and slot management
 */

import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { RING_VERTEX_SHADER, RING_FRAGMENT_SHADER } from "../../../shaders/ring.glsl";
import { GpuBatchRenderer, type SlotHandle } from "../../core/GpuBatchRenderer";
import { compileProgram } from "../../core/BaseGpuPrimitive";
import type {
  RingInstance,
  RingBatch,
  RingSharedResources,
} from "./ring.types";
import {
  INSTANCE_COMPONENTS,
  INSTANCE_STRIDE,
  DEFAULT_BATCH_CAPACITY,
  CIRCLE_SEGMENTS,
} from "./ring.const";

// ============================================================================
// Helpers
// ============================================================================

const createCircleBuffer = (
  gl: WebGL2RenderingContext,
  segments: number
): { buffer: WebGLBuffer; vertexCount: number } | null => {
  const buffer = gl.createBuffer();
  if (!buffer) return null;

  // Create triangle fan vertices for a unit circle
  const vertices: number[] = [];

  // Center vertex
  vertices.push(0, 0);

  // Perimeter vertices
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(angle), Math.sin(angle));
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return { buffer, vertexCount: segments + 2 };
};

// ============================================================================
// RingGpuRenderer Class
// ============================================================================

/**
 * GPU renderer for animated expanding rings.
 * Uses instanced rendering with a single draw call per batch.
 */
class RingGpuRenderer extends GpuBatchRenderer<RingInstance, RingBatch, void> {
  private circleBuffer: WebGLBuffer | null = null;
  private circleVertexCount = 0;
  private sharedResourcesExtended: RingSharedResources | null = null;

  constructor() {
    super(DEFAULT_BATCH_CAPACITY);
  }

  protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
    const programResult = compileProgram(gl, RING_VERTEX_SHADER, RING_FRAGMENT_SHADER, "[RingGpu]");
    if (!programResult) {
      return null;
    }

    const circleResult = createCircleBuffer(gl, CIRCLE_SEGMENTS);
    if (!circleResult) {
      gl.deleteProgram(programResult.program);
      return null;
    }

    this.circleBuffer = circleResult.buffer;
    this.circleVertexCount = circleResult.vertexCount;

    const uniforms = {
      cameraPosition: gl.getUniformLocation(programResult.program, "u_cameraPosition"),
      viewportSize: gl.getUniformLocation(programResult.program, "u_viewportSize"),
      time: gl.getUniformLocation(programResult.program, "u_time"),
    };

    const attributes = {
      position: gl.getAttribLocation(programResult.program, "a_position"),
      instancePosition: gl.getAttribLocation(programResult.program, "a_instancePosition"),
      instanceCreatedAt: gl.getAttribLocation(programResult.program, "a_instanceCreatedAt"),
      instanceLifetime: gl.getAttribLocation(programResult.program, "a_instanceLifetime"),
      instanceStartRadius: gl.getAttribLocation(programResult.program, "a_instanceStartRadius"),
      instanceEndRadius: gl.getAttribLocation(programResult.program, "a_instanceEndRadius"),
      instanceStartAlpha: gl.getAttribLocation(programResult.program, "a_instanceStartAlpha"),
      instanceEndAlpha: gl.getAttribLocation(programResult.program, "a_instanceEndAlpha"),
      instanceInnerStop: gl.getAttribLocation(programResult.program, "a_instanceInnerStop"),
      instanceOuterStop: gl.getAttribLocation(programResult.program, "a_instanceOuterStop"),
      instanceColor: gl.getAttribLocation(programResult.program, "a_instanceColor"),
      instanceActive: gl.getAttribLocation(programResult.program, "a_instanceActive"),
    };

    const resources: RingSharedResources = {
      program: programResult.program,
      circleBuffer: circleResult.buffer,
      circleVertexCount: circleResult.vertexCount,
      uniforms,
      attributes,
    };

    this.sharedResourcesExtended = resources;
    // Return base type for sharedResources, but keep extended in instance
    return { program: programResult.program };
  }

  protected createBatch(gl: WebGL2RenderingContext, capacity: number): RingBatch | null {
    if (!this.sharedResourcesExtended) {
      return null;
    }

    const instanceBuffer = gl.createBuffer();
    if (!instanceBuffer) {
      return null;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

    const vao = gl.createVertexArray();
    if (!vao) {
      gl.deleteBuffer(instanceBuffer);
      return null;
    }

    gl.bindVertexArray(vao);

    // Setup circle vertices (per-vertex)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sharedResourcesExtended.circleBuffer);
    gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.position);
    gl.vertexAttribPointer(this.sharedResourcesExtended.attributes.position, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.position, 0);

    // Setup instance attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    const attrs = this.sharedResourcesExtended.attributes;
    let offset = 0;

    // instancePosition (vec2)
    gl.enableVertexAttribArray(attrs.instancePosition);
    gl.vertexAttribPointer(attrs.instancePosition, 2, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(attrs.instancePosition, 1);
    offset += 2 * 4;

    // instanceCreatedAt (float)
    gl.enableVertexAttribArray(attrs.instanceCreatedAt);
    gl.vertexAttribPointer(attrs.instanceCreatedAt, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(attrs.instanceCreatedAt, 1);
    offset += 4;

    // instanceLifetime (float)
    gl.enableVertexAttribArray(attrs.instanceLifetime);
    gl.vertexAttribPointer(attrs.instanceLifetime, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(attrs.instanceLifetime, 1);
    offset += 4;

    // instanceStartRadius (float)
    gl.enableVertexAttribArray(attrs.instanceStartRadius);
    gl.vertexAttribPointer(attrs.instanceStartRadius, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(attrs.instanceStartRadius, 1);
    offset += 4;

    // instanceEndRadius (float)
    gl.enableVertexAttribArray(attrs.instanceEndRadius);
    gl.vertexAttribPointer(attrs.instanceEndRadius, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(attrs.instanceEndRadius, 1);
    offset += 4;

    // instanceStartAlpha (float)
    gl.enableVertexAttribArray(attrs.instanceStartAlpha);
    gl.vertexAttribPointer(attrs.instanceStartAlpha, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(attrs.instanceStartAlpha, 1);
    offset += 4;

    // instanceEndAlpha (float)
    gl.enableVertexAttribArray(attrs.instanceEndAlpha);
    gl.vertexAttribPointer(attrs.instanceEndAlpha, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(attrs.instanceEndAlpha, 1);
    offset += 4;

    // instanceInnerStop (float)
    gl.enableVertexAttribArray(attrs.instanceInnerStop);
    gl.vertexAttribPointer(attrs.instanceInnerStop, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(attrs.instanceInnerStop, 1);
    offset += 4;

    // instanceOuterStop (float)
    gl.enableVertexAttribArray(attrs.instanceOuterStop);
    gl.vertexAttribPointer(attrs.instanceOuterStop, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(attrs.instanceOuterStop, 1);
    offset += 4;

    // instanceColor (vec3)
    gl.enableVertexAttribArray(attrs.instanceColor);
    gl.vertexAttribPointer(attrs.instanceColor, 3, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(attrs.instanceColor, 1);
    offset += 3 * 4;

    // instanceActive (float)
    gl.enableVertexAttribArray(attrs.instanceActive);
    gl.vertexAttribPointer(attrs.instanceActive, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(attrs.instanceActive, 1);

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
    return "default"; // Rings don't have configs
  }

  protected writeInstanceData(batch: RingBatch, slotIndex: number, instance: RingInstance): void {
    const offset = slotIndex * INSTANCE_COMPONENTS;
    const data = batch.instanceData;

    data[offset + 0] = instance.position.x;
    data[offset + 1] = instance.position.y;
    data[offset + 2] = instance.createdAt;
    data[offset + 3] = instance.lifetimeMs;
    data[offset + 4] = instance.startRadius;
    data[offset + 5] = instance.endRadius;
    data[offset + 6] = instance.startAlpha;
    data[offset + 7] = instance.endAlpha;
    data[offset + 8] = instance.innerStop;
    data[offset + 9] = instance.outerStop;
    data[offset + 10] = instance.color.r;
    data[offset + 11] = instance.color.g;
    data[offset + 12] = instance.color.b;
    data[offset + 13] = instance.active ? 1 : 0;
  }

  protected setupRenderState(
    gl: WebGL2RenderingContext,
    _batch: RingBatch,
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
    return 13; // active flag is last
  }

  protected getVertexCount(_batch: RingBatch): number {
    return this.circleVertexCount;
  }

  protected getDrawMode(gl: WebGL2RenderingContext): number {
    return gl.TRIANGLE_FAN;
  }

  protected override disposeSharedResources(gl: WebGL2RenderingContext): void {
    if (this.circleBuffer) {
      gl.deleteBuffer(this.circleBuffer);
      this.circleBuffer = null;
    }
    this.sharedResourcesExtended = null;
  }
}

// ============================================================================
// Public API - Single instance with unified interface
// ============================================================================

export const ringGpuRenderer = new RingGpuRenderer();

// Re-export types
export type RingSlotHandle = SlotHandle;
