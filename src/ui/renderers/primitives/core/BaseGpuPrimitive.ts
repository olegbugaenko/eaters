/**
 * Base GPU Primitive
 * 
 * Abstract base class for GPU-based instanced primitives.
 * Provides common functionality for:
 * - WebGL context management
 * - Shader program compilation
 * - Buffer and VAO management
 * - Batch lifecycle
 */

import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { IGpuPrimitiveLifecycle, IGpuBatchConfig, IGpuInstanceHandle } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Base interface for GPU resources shared across all instances.
 */
export interface GpuSharedResources {
  readonly program: WebGLProgram;
}

/**
 * Base interface for a batch of GPU instances.
 * @template TInstance - The instance type, must be an object
 */
export interface GpuBatch<TInstance extends object> {
  readonly gl: WebGL2RenderingContext;
  readonly vao: WebGLVertexArrayObject;
  readonly instanceBuffer: WebGLBuffer;
  readonly capacity: number;
  instances: (TInstance | null)[];
  freeSlots: number[];
  activeCount: number;
  needsUpload: boolean;
  instanceData: Float32Array;
}

/**
 * Result of shader compilation.
 */
export interface ShaderCompilationResult {
  readonly program: WebGLProgram;
  readonly vertexShader: WebGLShader;
  readonly fragmentShader: WebGLShader;
}

// ============================================================================
// Shader Utilities
// ============================================================================

/**
 * Compile a WebGL shader.
 * @returns The compiled shader, or null if compilation failed.
 */
export const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
  logPrefix = "[GpuPrimitive]"
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error(`${logPrefix} Failed to create shader`);
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const typeStr = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
    console.error(`${logPrefix} ${typeStr} shader compile error:`, gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

/**
 * Compile and link a shader program.
 * @returns The compilation result, or null if failed.
 */
export const compileProgram = (
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  logPrefix = "[GpuPrimitive]"
): ShaderCompilationResult | null => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource, logPrefix);
  if (!vertexShader) {
    return null;
  }

  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, logPrefix);
  if (!fragmentShader) {
    gl.deleteShader(vertexShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    console.error(`${logPrefix} Failed to create program`);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(`${logPrefix} Program link error:`, gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  return { program, vertexShader, fragmentShader };
};

/**
 * Delete shader program and associated shaders.
 */
export const deleteProgram = (
  gl: WebGL2RenderingContext,
  result: ShaderCompilationResult
): void => {
  gl.deleteProgram(result.program);
  gl.deleteShader(result.vertexShader);
  gl.deleteShader(result.fragmentShader);
};

// ============================================================================
// Buffer Utilities
// ============================================================================

/**
 * Create a static vertex buffer with the given data.
 */
export const createStaticBuffer = (
  gl: WebGL2RenderingContext,
  data: Float32Array
): WebGLBuffer | null => {
  const buffer = gl.createBuffer();
  if (!buffer) {
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return buffer;
};

/**
 * Create a dynamic instance buffer with the given capacity.
 */
export const createDynamicBuffer = (
  gl: WebGL2RenderingContext,
  capacityBytes: number
): WebGLBuffer | null => {
  const buffer = gl.createBuffer();
  if (!buffer) {
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, capacityBytes, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return buffer;
};

// ============================================================================
// VAO Utilities
// ============================================================================

/**
 * Setup a vertex attribute pointer.
 */
export const setupVertexAttrib = (
  gl: WebGL2RenderingContext,
  location: number,
  size: number,
  stride: number,
  offset: number,
  divisor = 0
): void => {
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
  if (divisor > 0) {
    gl.vertexAttribDivisor(location, divisor);
  }
};

// ============================================================================
// Batch Management Utilities
// ============================================================================

/**
 * Initialize free slots array for a batch.
 * @param capacity - The batch capacity
 * @returns Array of free slot indices (in reverse order for efficient pop)
 */
export const initializeFreeSlots = (capacity: number): number[] => {
  const freeSlots: number[] = [];
  for (let i = capacity - 1; i >= 0; i -= 1) {
    freeSlots.push(i);
  }
  return freeSlots;
};

/**
 * Acquire a slot from a batch.
 * @returns The slot index, or -1 if no slots available.
 */
export const acquireSlot = <TInstance extends object>(
  batch: GpuBatch<TInstance>,
  createInstance: () => TInstance
): number => {
  if (batch.freeSlots.length === 0) {
    return -1;
  }

  const slotIndex = batch.freeSlots.pop()!;
  batch.instances[slotIndex] = createInstance();
  return slotIndex;
};

/**
 * Release a slot back to a batch.
 */
export const releaseSlot = <TInstance extends object>(
  batch: GpuBatch<TInstance>,
  slotIndex: number,
  instanceFloats: number
): void => {
  const instance = batch.instances[slotIndex];
  if (instance && "active" in instance && (instance as { active: boolean }).active) {
    batch.activeCount = Math.max(0, batch.activeCount - 1);
  }

  batch.instances[slotIndex] = null;
  batch.freeSlots.push(slotIndex);

  // Mark slot as inactive in GPU data (assuming last float is "active" flag)
  const offset = slotIndex * instanceFloats;
  batch.instanceData[offset + instanceFloats - 1] = 0;
  batch.needsUpload = true;
};

/**
 * Upload dirty batch data to GPU.
 */
export const uploadBatchData = <TInstance extends object>(
  batch: GpuBatch<TInstance>
): void => {
  if (!batch.needsUpload) {
    return;
  }

  const gl = batch.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, batch.instanceBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.instanceData);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  batch.needsUpload = false;
};

/**
 * Clear all instances in a batch.
 */
export const clearBatch = <TInstance extends object>(
  batch: GpuBatch<TInstance>,
  instanceFloats: number,
  activeFloatIndex: number
): void => {
  batch.activeCount = 0;
  batch.freeSlots.length = 0;

  for (let i = batch.capacity - 1; i >= 0; i -= 1) {
    batch.instances[i] = null;
    batch.freeSlots.push(i);
    batch.instanceData[i * instanceFloats + activeFloatIndex] = 0;
  }

  batch.needsUpload = true;
};

/**
 * Dispose a batch and its GPU resources.
 */
export const disposeBatch = <TInstance extends object>(batch: GpuBatch<TInstance>): void => {
  const gl = batch.gl;
  gl.deleteVertexArray(batch.vao);
  gl.deleteBuffer(batch.instanceBuffer);
};

// ============================================================================
// Common Quad Geometry
// ============================================================================

/**
 * Unit quad vertices for instanced rendering.
 * Covers [-1, 1] range, scaled by instance data in vertex shader.
 */
export const UNIT_QUAD_VERTICES = new Float32Array([
  -1, -1,
   1, -1,
   1,  1,
  -1, -1,
   1,  1,
  -1,  1,
]);

/**
 * Unit quad with center at origin, size 1x1.
 * Used when instance data provides position and size.
 */
export const UNIT_QUAD_CENTERED = new Float32Array([
  -0.5, -0.5,
   0.5, -0.5,
   0.5,  0.5,
  -0.5, -0.5,
   0.5,  0.5,
  -0.5,  0.5,
]);

/**
 * Triangle strip quad (4 vertices instead of 6).
 */
export const UNIT_QUAD_STRIP = new Float32Array([
  -0.5, -0.5,
   0.5, -0.5,
  -0.5,  0.5,
   0.5,  0.5,
]);
