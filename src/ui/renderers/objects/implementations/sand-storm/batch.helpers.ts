import { whirlGpuRenderer, type WhirlSlotHandle } from "../../../primitives/gpu/WhirlGpuRenderer";
import { getParticleEmitterGlContext } from "../../../primitives/utils/gpuContext";
import { DEFAULT_BATCH_CAPACITY } from "./constants";

/**
 * Ensures whirl batch is created and returns context
 */
export const ensureBatch = () => {
  const gl = getParticleEmitterGlContext();
  if (!gl) {
    return null;
  }
  // Set context if not already set
  if (whirlGpuRenderer["gl"] !== gl) {
    whirlGpuRenderer.setContext(gl);
  }
  return gl;
};

/**
 * Acquires a slot in the batch for an instance
 */
export const acquireSlot = (
  _gl: WebGL2RenderingContext | null,
  instanceId: string,
  instanceSlotMap: Map<string, WhirlSlotHandle>,
  _startIndex = 0
): WhirlSlotHandle | null => {
  // Check if instance already has a slot
  const existing = instanceSlotMap.get(instanceId);
  if (existing) {
    return existing;
  }

  // Acquire new slot
  const handle = whirlGpuRenderer.acquireSlot(undefined);
  if (!handle) {
    return null;
  }

  instanceSlotMap.set(instanceId, handle);
  return handle;
};
