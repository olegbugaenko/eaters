import {
  ensurePetalAuraBatch,
  writePetalAuraInstance,
  getPetalAuraGlContext,
} from "../../../primitives/gpu/PetalAuraGpuRenderer";
import type { PlayerUnitAuraConfig } from "../../../../../db/player-units-db";

// Глобальний реєстр для зберігання аур юнітів
const auraInstanceMap = new Map<
  string,
  {
    instanceId: string;
    slotIndex: number;
    auraConfig: PlayerUnitAuraConfig;
    basePhase: number;
  }[]
>();

// Кеш останньої позиції для уникнення зайвих bufferSubData викликів
const auraLastPositionCache = new Map<string, { x: number; y: number }>();

// Allow external systems (e.g., scene reset) to clear all aura slot tracking
export const clearAllAuraSlots = (): void => {
  auraInstanceMap.clear();
  auraLastPositionCache.clear();
};

let currentAuraBatchRef: ReturnType<typeof ensureAuraBatch> | null = null;

const ensureAuraBatch = () => {
  const gl = getPetalAuraGlContext();
  if (!gl) {
    return null;
  }
  return ensurePetalAuraBatch(gl, 512); // Достатньо для багатьох юнітів
};

const acquireAuraSlot = (
  batch: NonNullable<ReturnType<typeof ensureAuraBatch>>,
  instanceId: string,
  petalCount: number,
  startIndex = 0
): number => {
  // Шукаємо вільний блок злотів для всіх пелюсток
  for (let i = 0; i < batch.capacity - petalCount; i += 1) {
    const index = (startIndex + i) % (batch.capacity - petalCount);
    let slotFree = true;
    for (let j = 0; j < petalCount; j += 1) {
      const checkIndex = index + j;
      const inst = batch.instances[checkIndex];
      if (inst && inst.active) {
        slotFree = false;
        break;
      }
      // Перевіряємо, чи не зайнято іншим instance
      for (const [id, slots] of auraInstanceMap.entries()) {
        if (id !== instanceId && slots.some((s) => s.slotIndex === checkIndex)) {
          slotFree = false;
          break;
        }
      }
      if (!slotFree) break;
    }
    if (slotFree) {
      return index;
    }
  }
  // Fallback - повертаємо перший доступний
  return 0;
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
 * Gets current aura batch (for internal use)
 */
export const getCurrentAuraBatch = () => {
  const batch = ensureAuraBatch();
  if (currentAuraBatchRef !== batch) {
    auraInstanceMap.clear();
    currentAuraBatchRef = batch;
  }
  return batch;
};

/**
 * Acquires aura slot (for internal use)
 */
export const acquireAuraSlotForInstance = (
  instanceId: string,
  petalCount: number,
  startIndex = 0
): number | null => {
  const batch = getCurrentAuraBatch();
  if (!batch) {
    return null;
  }
  return acquireAuraSlot(batch, instanceId, petalCount, startIndex);
};

/**
 * Writes aura instance (for internal use)
 */
export const writeAuraInstance = (
  slotIndex: number,
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
  const batch = getCurrentAuraBatch();
  if (!batch) {
    return;
  }
  writePetalAuraInstance(batch, slotIndex, data);
};
