import { ensureWhirlBatch, getWhirlGlContext } from "../../../primitives/gpu/WhirlGpuRenderer";
import { DEFAULT_BATCH_CAPACITY } from "./constants";

/**
 * Ensures whirl batch is created and returns it
 */
export const ensureBatch = () => {
  const gl = getWhirlGlContext();
  if (!gl) {
    return null;
  }
  return ensureWhirlBatch(gl, DEFAULT_BATCH_CAPACITY);
};

/**
 * Acquires a slot in the batch for an instance
 */
export const acquireSlot = (
  batch: NonNullable<ReturnType<typeof ensureBatch>>,
  instanceId: string,
  instanceSlotMap: Map<string, number>,
  startIndex = 0
): number => {
  // Спочатку шукаємо вільний слот (неактивний і не зареєстрований для іншого instance)
  for (let i = 0; i < batch.capacity; i += 1) {
    const index = (startIndex + i) % batch.capacity;
    const inst = batch.instances[index];
    if (!inst || !inst.active) {
      // Перевіряємо, чи цей слот не зареєстрований для іншого instance
      let slotInUse = false;
      for (const [id, slotIdx] of instanceSlotMap.entries()) {
        if (id !== instanceId && slotIdx === index) {
          slotInUse = true;
          break;
        }
      }
      if (!slotInUse) {
        return index;
      }
    }
  }

  // Якщо всі слоти зайняті, вибираємо останній слот і очищаємо його з map
  // (інший instance доведеться знайти новий слот при наступному update)
  const fallbackIndex = Math.max(0, batch.capacity - 1);
  for (const [id, slotIdx] of instanceSlotMap.entries()) {
    if (id !== instanceId && slotIdx === fallbackIndex) {
      // Видаляємо інший instance з map, оскільки ми перезапишемо його слот
      instanceSlotMap.delete(id);
      break;
    }
  }
  return fallbackIndex;
};
