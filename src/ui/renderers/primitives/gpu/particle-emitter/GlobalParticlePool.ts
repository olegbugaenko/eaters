/**
 * Global Particle Pool - manages a single large buffer for all particle emitters.
 * 
 * Benefits:
 * - Single simulation pass for all particles
 * - Reduced VAO binding overhead
 * - Better GPU utilization
 * 
 * Architecture:
 * - One large GPU buffer holding all particles
 * - Emitters "rent" ranges of slots from the pool
 * - Single transform feedback pass updates all particles
 * - Particles store their visual parameters (color, fade, etc.) in per-particle attributes
 */

import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

// Per-particle state (matches simulation shader layout)
const PARTICLE_STATE_COMPONENTS = 8; // position(2) + velocity(2) + age + lifetime + size + isActive
const PARTICLE_STATE_BYTES = PARTICLE_STATE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;

// Per-particle visual parameters (for rendering)
const PARTICLE_VISUAL_COMPONENTS = 8; // emitterId + fadeStartMs + startAlpha + endAlpha + color(4)
const PARTICLE_VISUAL_BYTES = PARTICLE_VISUAL_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;

// Default pool capacity
const DEFAULT_POOL_CAPACITY = 50000;
const MAX_POOL_CAPACITY = 200000;

export interface ParticleSlotRange {
  startIndex: number;
  count: number;
}

export interface GlobalParticlePoolHandle {
  range: ParticleSlotRange;
  emitterId: number;
}

interface PoolState {
  gl: WebGL2RenderingContext;
  capacity: number;
  
  // Double-buffered state for transform feedback
  stateBuffers: [WebGLBuffer, WebGLBuffer];
  visualBuffer: WebGLBuffer;
  
  // Transform feedback objects
  transformFeedbacks: [WebGLTransformFeedback, WebGLTransformFeedback];
  simulationVaos: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  renderVao: WebGLVertexArrayObject;
  
  currentBufferIndex: 0 | 1;
  
  // Slot allocation
  allocatedRanges: Map<number, ParticleSlotRange>; // emitterId -> range
  nextEmitterId: number;
  freeRanges: ParticleSlotRange[]; // Available ranges for allocation
  
  // Statistics
  totalAllocated: number;
}

let poolState: PoolState | null = null;

/**
 * Initialize the global particle pool
 */
export const initGlobalParticlePool = (
  gl: WebGL2RenderingContext,
  capacity: number = DEFAULT_POOL_CAPACITY
): boolean => {
  if (poolState && poolState.gl === gl) {
    return true; // Already initialized
  }
  
  // Dispose existing pool if context changed
  if (poolState) {
    disposeGlobalParticlePool();
  }
  
  const actualCapacity = Math.min(capacity, MAX_POOL_CAPACITY);
  
  // Create state buffers (double-buffered for transform feedback)
  const stateBufferA = gl.createBuffer();
  const stateBufferB = gl.createBuffer();
  if (!stateBufferA || !stateBufferB) {
    console.error("[GlobalParticlePool] Failed to create state buffers");
    return false;
  }
  
  // Create visual buffer
  const visualBuffer = gl.createBuffer();
  if (!visualBuffer) {
    gl.deleteBuffer(stateBufferA);
    gl.deleteBuffer(stateBufferB);
    console.error("[GlobalParticlePool] Failed to create visual buffer");
    return false;
  }
  
  // Initialize buffers with zeros
  const stateData = new Float32Array(actualCapacity * PARTICLE_STATE_COMPONENTS);
  const visualData = new Float32Array(actualCapacity * PARTICLE_VISUAL_COMPONENTS);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, stateBufferA);
  gl.bufferData(gl.ARRAY_BUFFER, stateData, gl.DYNAMIC_COPY);
  gl.bindBuffer(gl.ARRAY_BUFFER, stateBufferB);
  gl.bufferData(gl.ARRAY_BUFFER, stateData, gl.DYNAMIC_COPY);
  gl.bindBuffer(gl.ARRAY_BUFFER, visualBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, visualData, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  
  // Create transform feedback objects
  const feedbackA = gl.createTransformFeedback();
  const feedbackB = gl.createTransformFeedback();
  if (!feedbackA || !feedbackB) {
    gl.deleteBuffer(stateBufferA);
    gl.deleteBuffer(stateBufferB);
    gl.deleteBuffer(visualBuffer);
    console.error("[GlobalParticlePool] Failed to create transform feedback objects");
    return false;
  }
  
  // Create simulation VAOs (for transform feedback input)
  const simVaoA = gl.createVertexArray();
  const simVaoB = gl.createVertexArray();
  if (!simVaoA || !simVaoB) {
    gl.deleteBuffer(stateBufferA);
    gl.deleteBuffer(stateBufferB);
    gl.deleteBuffer(visualBuffer);
    gl.deleteTransformFeedback(feedbackA);
    gl.deleteTransformFeedback(feedbackB);
    console.error("[GlobalParticlePool] Failed to create simulation VAOs");
    return false;
  }
  
  // Create render VAO
  const renderVao = gl.createVertexArray();
  if (!renderVao) {
    gl.deleteBuffer(stateBufferA);
    gl.deleteBuffer(stateBufferB);
    gl.deleteBuffer(visualBuffer);
    gl.deleteTransformFeedback(feedbackA);
    gl.deleteTransformFeedback(feedbackB);
    gl.deleteVertexArray(simVaoA);
    gl.deleteVertexArray(simVaoB);
    console.error("[GlobalParticlePool] Failed to create render VAO");
    return false;
  }
  
  poolState = {
    gl,
    capacity: actualCapacity,
    stateBuffers: [stateBufferA, stateBufferB],
    visualBuffer,
    transformFeedbacks: [feedbackA, feedbackB],
    simulationVaos: [simVaoA, simVaoB],
    renderVao,
    currentBufferIndex: 0,
    allocatedRanges: new Map(),
    nextEmitterId: 1,
    freeRanges: [{ startIndex: 0, count: actualCapacity }],
    totalAllocated: 0,
  };
  
  // Pool initialized but currently disabled due to transform feedback compatibility issues
  return true;
};

/**
 * Dispose the global particle pool
 */
export const disposeGlobalParticlePool = (): void => {
  if (!poolState) {
    return;
  }
  
  const { gl, stateBuffers, visualBuffer, transformFeedbacks, simulationVaos, renderVao } = poolState;
  
  gl.deleteBuffer(stateBuffers[0]);
  gl.deleteBuffer(stateBuffers[1]);
  gl.deleteBuffer(visualBuffer);
  gl.deleteTransformFeedback(transformFeedbacks[0]);
  gl.deleteTransformFeedback(transformFeedbacks[1]);
  gl.deleteVertexArray(simulationVaos[0]);
  gl.deleteVertexArray(simulationVaos[1]);
  gl.deleteVertexArray(renderVao);
  
  poolState = null;
  console.log("[GlobalParticlePool] Disposed");
};

/**
 * Alignment for transform feedback buffer offset (in bytes).
 * Most GPUs require 4 or 256 byte alignment. We use 256 to be safe.
 */
const TF_BUFFER_ALIGNMENT = 256;
const SLOTS_PER_ALIGNMENT = TF_BUFFER_ALIGNMENT / PARTICLE_STATE_BYTES; // 256/32 = 8 slots

/**
 * Round up to alignment boundary
 */
const alignUp = (value: number, alignment: number): number => {
  return Math.ceil(value / alignment) * alignment;
};

/**
 * Allocate a range of slots for an emitter.
 * startIndex is aligned to TF_BUFFER_ALIGNMENT to satisfy transform feedback requirements.
 */
export const allocateSlots = (count: number): GlobalParticlePoolHandle | null => {
  if (!poolState || count <= 0) {
    return null;
  }
  
  // Round up count to alignment boundary to prevent fragmentation
  const alignedCount = alignUp(count, SLOTS_PER_ALIGNMENT);
  
  // Find a free range that can accommodate the request
  for (let i = 0; i < poolState.freeRanges.length; i++) {
    const range = poolState.freeRanges[i]!;
    
    // Calculate aligned start index within this range
    const alignedStart = alignUp(range.startIndex, SLOTS_PER_ALIGNMENT);
    const wastedSlots = alignedStart - range.startIndex;
    const availableAfterAlign = range.count - wastedSlots;
    
    if (availableAfterAlign >= alignedCount) {
      // Allocate from this range with aligned start
      const allocated: ParticleSlotRange = {
        startIndex: alignedStart,
        count: alignedCount,
      };
      
      const emitterId = poolState.nextEmitterId++;
      poolState.allocatedRanges.set(emitterId, allocated);
      poolState.totalAllocated += alignedCount;
      
      // Update the free range - remove allocated portion
      const endOfAllocation = alignedStart + alignedCount;
      const remainingCount = range.startIndex + range.count - endOfAllocation;
      
      if (remainingCount > 0) {
        range.startIndex = endOfAllocation;
        range.count = remainingCount;
      } else {
        poolState.freeRanges.splice(i, 1);
      }
      
      // If there were wasted slots before aligned start, add them back as free
      if (wastedSlots > 0 && wastedSlots >= SLOTS_PER_ALIGNMENT) {
        // Only worth tracking if it's at least one alignment unit
        poolState.freeRanges.push({
          startIndex: range.startIndex - wastedSlots - alignedCount,
          count: wastedSlots,
        });
      }
      
      return { range: allocated, emitterId };
    }
  }
  
  console.warn(`[GlobalParticlePool] Failed to allocate ${count} (aligned: ${alignedCount}) slots. Total allocated: ${poolState.totalAllocated}/${poolState.capacity}`);
  return null;
};

/**
 * Free allocated slots
 */
export const freeSlots = (handle: GlobalParticlePoolHandle): void => {
  if (!poolState) {
    return;
  }
  
  const range = poolState.allocatedRanges.get(handle.emitterId);
  if (!range) {
    return;
  }
  
  poolState.allocatedRanges.delete(handle.emitterId);
  poolState.totalAllocated -= range.count;
  
  // Add back to free ranges (simple implementation - could be optimized with merging)
  poolState.freeRanges.push(range);
  
  // Sort and merge adjacent free ranges
  poolState.freeRanges.sort((a, b) => a.startIndex - b.startIndex);
  
  const merged: ParticleSlotRange[] = [];
  for (const r of poolState.freeRanges) {
    const last = merged[merged.length - 1];
    if (last && last.startIndex + last.count === r.startIndex) {
      last.count += r.count;
    } else {
      merged.push({ ...r });
    }
  }
  poolState.freeRanges = merged;
};

/**
 * Get pool statistics
 */
export const getPoolStats = (): { capacity: number; allocated: number; emitters: number } => {
  if (!poolState) {
    return { capacity: 0, allocated: 0, emitters: 0 };
  }
  return {
    capacity: poolState.capacity,
    allocated: poolState.totalAllocated,
    emitters: poolState.allocatedRanges.size,
  };
};

/**
 * Get the current state buffer for reading
 */
export const getCurrentStateBuffer = (): WebGLBuffer | null => {
  return poolState?.stateBuffers[poolState.currentBufferIndex] ?? null;
};

/**
 * Get the visual buffer
 */
export const getVisualBuffer = (): WebGLBuffer | null => {
  return poolState?.visualBuffer ?? null;
};

/**
 * Check if pool is initialized
 */
export const isPoolInitialized = (): boolean => {
  return poolState !== null;
};

/**
 * Get pool capacity
 */
export const getPoolCapacity = (): number => {
  return poolState?.capacity ?? 0;
};

/**
 * Get the GL context
 */
export const getPoolGl = (): WebGL2RenderingContext | null => {
  return poolState?.gl ?? null;
};

/**
 * Swap buffers after simulation pass
 */
export const swapBuffers = (): void => {
  if (poolState) {
    poolState.currentBufferIndex = poolState.currentBufferIndex === 0 ? 1 : 0;
  }
};

/**
 * Get simulation resources for transform feedback
 */
export const getSimulationResources = (): {
  inputBuffer: WebGLBuffer;
  outputBuffer: WebGLBuffer;
  transformFeedback: WebGLTransformFeedback;
  inputVao: WebGLVertexArrayObject;
} | null => {
  if (!poolState) {
    return null;
  }
  
  const readIdx = poolState.currentBufferIndex;
  const writeIdx = readIdx === 0 ? 1 : 0;
  
  return {
    inputBuffer: poolState.stateBuffers[readIdx],
    outputBuffer: poolState.stateBuffers[writeIdx],
    transformFeedback: poolState.transformFeedbacks[writeIdx],
    inputVao: poolState.simulationVaos[readIdx],
  };
};

/**
 * Get render VAO
 */
export const getRenderVao = (): WebGLVertexArrayObject | null => {
  return poolState?.renderVao ?? null;
};

/**
 * Write particle data to a specific slot range in the current buffer
 */
export const writeParticleData = (
  handle: GlobalParticlePoolHandle,
  slotIndex: number,
  data: Float32Array
): void => {
  if (!poolState || slotIndex < 0 || slotIndex >= handle.range.count) {
    return;
  }
  
  const gl = poolState.gl;
  const globalIndex = handle.range.startIndex + slotIndex;
  const byteOffset = globalIndex * PARTICLE_STATE_BYTES;
  
  // Write to BOTH buffers to keep them in sync
  for (const buffer of poolState.stateBuffers) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, byteOffset, data);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
};

/**
 * Clear all particles in a slot range (set isActive = 0)
 */
export const clearSlotRange = (handle: GlobalParticlePoolHandle): void => {
  if (!poolState) {
    return;
  }
  
  const gl = poolState.gl;
  const zeroData = new Float32Array(handle.range.count * PARTICLE_STATE_COMPONENTS);
  const byteOffset = handle.range.startIndex * PARTICLE_STATE_BYTES;
  
  for (const buffer of poolState.stateBuffers) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, byteOffset, zeroData);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
};

/**
 * Get buffer info for an emitter to set up its own render VAO
 */
export const getBufferForRange = (handle: GlobalParticlePoolHandle): {
  buffer: WebGLBuffer;
  byteOffset: number;
  stride: number;
} | null => {
  if (!poolState) {
    return null;
  }
  
  return {
    buffer: poolState.stateBuffers[poolState.currentBufferIndex],
    byteOffset: handle.range.startIndex * PARTICLE_STATE_BYTES,
    stride: PARTICLE_STATE_BYTES,
  };
};

/**
 * Get both state buffers for ping-pong rendering
 */
export const getStateBuffers = (): [WebGLBuffer, WebGLBuffer] | null => {
  return poolState?.stateBuffers ?? null;
};

/**
 * Get current buffer index
 */
export const getCurrentBufferIndex = (): 0 | 1 => {
  return poolState?.currentBufferIndex ?? 0;
};

/**
 * Set current buffer index (called after simulation step)
 */
export const setCurrentBufferIndex = (index: 0 | 1): void => {
  if (poolState) {
    poolState.currentBufferIndex = index;
  }
};

/**
 * Export constants for external use
 */
export { PARTICLE_STATE_COMPONENTS, PARTICLE_STATE_BYTES };
