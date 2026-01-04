/**
 * Core Primitives Module
 * 
 * Exports base types, interfaces, and utilities for building primitives.
 */

// Types and Interfaces
export type {
  IPrimitive,
  ICpuPrimitive,
  IStaticCpuPrimitive,
  IDynamicCpuPrimitive,
  IGpuPrimitiveLifecycle,
  IGpuInstanceHandle,
  IGpuBatchConfig,
  // Backward compatibility
  StaticPrimitive,
  DynamicPrimitive,
} from "./types";

export {
  isDynamicCpuPrimitive,
  isStaticCpuPrimitive,
  isGpuPrimitive,
} from "./types";

// GPU Primitive Base Utilities
export type {
  GpuSharedResources,
  GpuBatch,
  ShaderCompilationResult,
} from "./BaseGpuPrimitive";

export {
  compileShader,
  compileProgram,
  deleteProgram,
  createStaticBuffer,
  createDynamicBuffer,
  setupVertexAttrib,
  initializeFreeSlots,
  acquireSlot,
  releaseSlot,
  uploadBatchData,
  clearBatch,
  disposeBatch,
  UNIT_QUAD_VERTICES,
  UNIT_QUAD_CENTERED,
  UNIT_QUAD_STRIP,
} from "./BaseGpuPrimitive";

// GPU Batch Renderer Base Class
export type {
  SlotHandle,
  ExtendedGpuBatch,
} from "./GpuBatchRenderer";

export { GpuBatchRenderer } from "./GpuBatchRenderer";
