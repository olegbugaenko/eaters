import {
  petalAuraGpuRenderer,
  type PetalAuraInstance,
  type PetalAuraSlotHandle,
} from "../../../primitives/gpu/PetalAuraGpuRenderer";
import { getParticleEmitterGlContext } from "../../../primitives/utils/gpuContext";
import type { PlayerUnitAuraConfig } from "../../../../../db/player-units-db";

// Глобальний реєстр для зберігання аур юнітів
const auraInstanceMap = new Map<
  string,
  {
    instanceId: string;
    handle: PetalAuraSlotHandle;
    auraConfig: PlayerUnitAuraConfig;
    basePhase: number;
  }[]
>();

// Кеш останньої позиції для уникнення зайвих bufferSubData викликів
const auraLastPositionCache = new Map<string, { x: number; y: number }>();

// Allow external systems (e.g., scene reset) to clear all aura slot tracking
export const clearAllAuraSlots = (): void => {
  auraInstanceMap.forEach((slots) => {
    slots.forEach((slot) => {
      petalAuraGpuRenderer.releaseSlot(slot.handle);
    });
  });
  auraInstanceMap.clear();
  auraLastPositionCache.clear();
};

/**
 * Gets aura instance map (for internal use)
 */
export const getAuraInstanceMap = () => auraInstanceMap;

/**
 * Gets aura last position cache (for internal use)
 */
export const getAuraLastPositionCache = () => auraLastPositionCache;

/**
 * Acquires aura slot (for internal use)
 */
export const acquireAuraSlotForInstance = (
  instanceId: string,
  petalCount: number
): PetalAuraSlotHandle | null => {
  const gl = getParticleEmitterGlContext();
  if (!gl) {
    return null;
  }

  // Set context if not already set
  if (petalAuraGpuRenderer["gl"] !== gl) {
    petalAuraGpuRenderer.setContext(gl);
  }

  return petalAuraGpuRenderer.acquirePetalSlot(petalCount);
};

/**
 * Writes aura instance (for internal use)
 */
export const writeAuraInstance = (
  handle: PetalAuraSlotHandle,
  data: {
    position: { x: number; y: number };
    basePhase: number;
    active: boolean;
    petalCount: number;
    innerRadius: number;
    outerRadius: number;
    petalWidth: number;
    rotationSpeed: number;
    color: [number, number, number];
    alpha: number;
    pointInward: boolean;
  }
): void => {
  const instance: PetalAuraInstance = {
    position: data.position,
    basePhase: data.basePhase,
    active: data.active,
    petalCount: data.petalCount,
    innerRadius: data.innerRadius,
    outerRadius: data.outerRadius,
    petalWidth: data.petalWidth,
    rotationSpeed: data.rotationSpeed,
    color: data.color,
    alpha: data.alpha,
    pointInward: data.pointInward,
  };

  petalAuraGpuRenderer.updateSlot(handle, instance);
};
