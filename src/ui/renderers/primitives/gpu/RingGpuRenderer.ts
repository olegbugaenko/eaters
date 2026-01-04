/**
 * GPU Instanced Ring Renderer
 * Renders animated expanding rings with a single draw call per batch
 */

import { SceneColor, SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import { RING_VERTEX_SHADER, RING_FRAGMENT_SHADER } from "../../shaders/ring.glsl";

// ============================================================================
// Types
// ============================================================================

export interface RingInstance {
  position: SceneVector2;
  createdAt: number;
  lifetimeMs: number;
  startRadius: number;
  endRadius: number;
  startAlpha: number;
  endAlpha: number;
  innerStop: number;
  outerStop: number;
  color: SceneColor;
  active: boolean;
}

interface RingBatch {
  gl: WebGL2RenderingContext;
  capacity: number;
  instanceBuffer: WebGLBuffer;
  vao: WebGLVertexArrayObject;
  freeSlots: number[];
  activeCount: number;
}

interface RingRendererResources {
  program: WebGLProgram;
  circleBuffer: WebGLBuffer;
  circleVertexCount: number;
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
  };
  attributes: {
    position: number;
    instancePosition: number;
    instanceCreatedAt: number;
    instanceLifetime: number;
    instanceStartRadius: number;
    instanceEndRadius: number;
    instanceStartAlpha: number;
    instanceEndAlpha: number;
    instanceInnerStop: number;
    instanceOuterStop: number;
    instanceColor: number;
    instanceActive: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

// Instance data: x, y, createdAt, lifetime, startR, endR, startA, endA, inner, outer, r, g, b, active
const INSTANCE_COMPONENTS = 14;
const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
const DEFAULT_BATCH_CAPACITY = 512;
const CIRCLE_SEGMENTS = 48;

// ============================================================================
// State
// ============================================================================

let globalGl: WebGL2RenderingContext | null = null;
let globalResources: RingRendererResources | null = null;
let globalBatch: RingBatch | null = null;

// Static scratch buffer for writing instance data
const instanceScratch = new Float32Array(INSTANCE_COMPONENTS);

// ============================================================================
// Helpers
// ============================================================================

const createShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("[RingGpuRenderer] Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const createProgram = (
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null => {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("[RingGpuRenderer] Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

const createCircleBuffer = (gl: WebGL2RenderingContext, segments: number): { buffer: WebGLBuffer; vertexCount: number } | null => {
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

const createResources = (gl: WebGL2RenderingContext): RingRendererResources | null => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, RING_VERTEX_SHADER);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, RING_FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) return null;

  const program = createProgram(gl, vertexShader, fragmentShader);
  if (!program) return null;

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  const circleResult = createCircleBuffer(gl, CIRCLE_SEGMENTS);
  if (!circleResult) return null;

  const uniforms = {
    cameraPosition: gl.getUniformLocation(program, "u_cameraPosition"),
    viewportSize: gl.getUniformLocation(program, "u_viewportSize"),
    time: gl.getUniformLocation(program, "u_time"),
  };

  const attributes = {
    position: gl.getAttribLocation(program, "a_position"),
    instancePosition: gl.getAttribLocation(program, "a_instancePosition"),
    instanceCreatedAt: gl.getAttribLocation(program, "a_instanceCreatedAt"),
    instanceLifetime: gl.getAttribLocation(program, "a_instanceLifetime"),
    instanceStartRadius: gl.getAttribLocation(program, "a_instanceStartRadius"),
    instanceEndRadius: gl.getAttribLocation(program, "a_instanceEndRadius"),
    instanceStartAlpha: gl.getAttribLocation(program, "a_instanceStartAlpha"),
    instanceEndAlpha: gl.getAttribLocation(program, "a_instanceEndAlpha"),
    instanceInnerStop: gl.getAttribLocation(program, "a_instanceInnerStop"),
    instanceOuterStop: gl.getAttribLocation(program, "a_instanceOuterStop"),
    instanceColor: gl.getAttribLocation(program, "a_instanceColor"),
    instanceActive: gl.getAttribLocation(program, "a_instanceActive"),
  };

  return {
    program,
    circleBuffer: circleResult.buffer,
    circleVertexCount: circleResult.vertexCount,
    uniforms,
    attributes,
  };
};

const createBatch = (
  gl: WebGL2RenderingContext,
  resources: RingRendererResources,
  capacity: number
): RingBatch | null => {
  const instanceBuffer = gl.createBuffer();
  if (!instanceBuffer) return null;

  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

  const vao = gl.createVertexArray();
  if (!vao) {
    gl.deleteBuffer(instanceBuffer);
    return null;
  }

  gl.bindVertexArray(vao);

  // Setup circle vertices (per-vertex)
  gl.bindBuffer(gl.ARRAY_BUFFER, resources.circleBuffer);
  gl.enableVertexAttribArray(resources.attributes.position);
  gl.vertexAttribPointer(resources.attributes.position, 2, gl.FLOAT, false, 0, 0);

  // Setup instance attributes
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  const attrs = resources.attributes;
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
  };
};

// ============================================================================
// Public API
// ============================================================================

export interface RingSlotHandle {
  readonly slotIndex: number;
}

export const initRingGpuRenderer = (gl: WebGL2RenderingContext): boolean => {
  if (globalGl === gl && globalResources && globalBatch) {
    return true;
  }

  disposeRingGpuRenderer();

  const resources = createResources(gl);
  if (!resources) return false;

  const batch = createBatch(gl, resources, DEFAULT_BATCH_CAPACITY);
  if (!batch) {
    gl.deleteBuffer(resources.circleBuffer);
    gl.deleteProgram(resources.program);
    return false;
  }

  globalGl = gl;
  globalResources = resources;
  globalBatch = batch;
  return true;
};

export const acquireRingSlot = (): RingSlotHandle | null => {
  if (!globalBatch || globalBatch.freeSlots.length === 0) {
    return null;
  }

  const slotIndex = globalBatch.freeSlots.pop()!;
  globalBatch.activeCount++;

  return { slotIndex };
};

export const updateRingSlot = (handle: RingSlotHandle, instance: RingInstance): void => {
  if (!globalBatch || !globalGl) return;

  const { slotIndex } = handle;
  if (slotIndex < 0 || slotIndex >= globalBatch.capacity) return;

  // Write to scratch buffer
  instanceScratch[0] = instance.position.x;
  instanceScratch[1] = instance.position.y;
  instanceScratch[2] = instance.createdAt;
  instanceScratch[3] = instance.lifetimeMs;
  instanceScratch[4] = instance.startRadius;
  instanceScratch[5] = instance.endRadius;
  instanceScratch[6] = instance.startAlpha;
  instanceScratch[7] = instance.endAlpha;
  instanceScratch[8] = instance.innerStop;
  instanceScratch[9] = instance.outerStop;
  instanceScratch[10] = instance.color.r;
  instanceScratch[11] = instance.color.g;
  instanceScratch[12] = instance.color.b;
  instanceScratch[13] = instance.active ? 1 : 0;

  // Upload to GPU
  globalGl.bindBuffer(globalGl.ARRAY_BUFFER, globalBatch.instanceBuffer);
  globalGl.bufferSubData(globalGl.ARRAY_BUFFER, slotIndex * INSTANCE_STRIDE, instanceScratch);
  globalGl.bindBuffer(globalGl.ARRAY_BUFFER, null);
};

export const releaseRingSlot = (handle: RingSlotHandle): void => {
  if (!globalBatch || !globalGl) return;

  const { slotIndex } = handle;
  if (slotIndex < 0 || slotIndex >= globalBatch.capacity) return;

  // Mark as inactive in GPU buffer
  instanceScratch[13] = 0;
  globalGl.bindBuffer(globalGl.ARRAY_BUFFER, globalBatch.instanceBuffer);
  globalGl.bufferSubData(
    globalGl.ARRAY_BUFFER,
    slotIndex * INSTANCE_STRIDE + 13 * 4,
    instanceScratch.subarray(13, 14)
  );
  globalGl.bindBuffer(globalGl.ARRAY_BUFFER, null);

  globalBatch.freeSlots.push(slotIndex);
  globalBatch.activeCount = Math.max(0, globalBatch.activeCount - 1);
};

export const renderRings = (
  cameraPosition: SceneVector2,
  viewportSize: SceneVector2,
  timeMs: number
): void => {
  if (!globalGl || !globalResources || !globalBatch) return;
  if (globalBatch.activeCount <= 0) return;

  const gl = globalGl;
  const { program, uniforms, circleVertexCount } = globalResources;
  const batch = globalBatch;

  gl.useProgram(program);

  gl.uniform2f(uniforms.cameraPosition, cameraPosition.x, cameraPosition.y);
  gl.uniform2f(uniforms.viewportSize, viewportSize.x, viewportSize.y);
  gl.uniform1f(uniforms.time, timeMs);

  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  gl.bindVertexArray(batch.vao);
  gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, circleVertexCount, batch.capacity);
  gl.bindVertexArray(null);
};

export const clearRingInstances = (): void => {
  if (!globalBatch || !globalGl) return;

  // Reset free slots
  globalBatch.freeSlots.length = 0;
  for (let i = globalBatch.capacity - 1; i >= 0; i--) {
    globalBatch.freeSlots.push(i);
  }
  globalBatch.activeCount = 0;

  // Clear GPU buffer
  globalGl.bindBuffer(globalGl.ARRAY_BUFFER, globalBatch.instanceBuffer);
  globalGl.bufferData(globalGl.ARRAY_BUFFER, globalBatch.capacity * INSTANCE_STRIDE, globalGl.DYNAMIC_DRAW);
  globalGl.bindBuffer(globalGl.ARRAY_BUFFER, null);
};

export const disposeRingGpuRenderer = (): void => {
  if (globalGl && globalBatch) {
    globalGl.deleteBuffer(globalBatch.instanceBuffer);
    globalGl.deleteVertexArray(globalBatch.vao);
  }
  if (globalGl && globalResources) {
    globalGl.deleteBuffer(globalResources.circleBuffer);
    globalGl.deleteProgram(globalResources.program);
  }
  globalGl = null;
  globalResources = null;
  globalBatch = null;
};

export const getRingActiveCount = (): number => globalBatch?.activeCount ?? 0;

