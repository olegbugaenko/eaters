import {
  ObjectRenderer,
  ObjectRegistration,
  DynamicPrimitive,
} from "./ObjectRenderer";
import { SceneObjectInstance, SceneVector2 } from "../../../logic/services/SceneObjectManager";
import { ensureWhirlBatch, writeWhirlInstance } from "../primitives/WhirlGpuRenderer";
import { getWhirlGlContext } from "../primitives/whirlContext";

interface SandStormCustomData {
  intensity?: number;
  phase?: number;
}

const DEFAULT_BATCH_CAPACITY = 128;

// Глобальний реєстр для зв'язку instance ID з slot index
const instanceSlotMap = new Map<string, number>();

export class SandStormRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const dynamicPrimitives: DynamicPrimitive[] = [];

    dynamicPrimitives.push(createWhirlPrimitive(instance));

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}

// Глобальна змінна для відстеження поточного batch
let currentBatchRef: ReturnType<typeof ensureBatch> | null = null;

const createWhirlPrimitive = (instance: SceneObjectInstance): DynamicPrimitive => {
  const instanceId = instance.id;

  return {
    data: new Float32Array(0),
    update(target) {
      const gl = getWhirlGlContext();
      if (!gl) {
        return null;
      }

      // Завжди отримуємо поточний batch
      const currentBatch = ensureBatch();
      if (!currentBatch) {
        instanceSlotMap.delete(instanceId);
        return null;
      }

      // Якщо batch змінився (перестворений), очищаємо всі слоті
      if (currentBatchRef !== currentBatch) {
        instanceSlotMap.clear();
        currentBatchRef = currentBatch;
      }

      // Отримуємо або призначаємо slot для цього instance
      let slotIndex = instanceSlotMap.get(instanceId);
        
      console.log(`InstanceId: ${instanceId}`, slotIndex);
      // Якщо немає слоту або він невалідний, шукаємо новий
      if (slotIndex === undefined || slotIndex < 0 || slotIndex >= currentBatch.capacity) {
        slotIndex = acquireSlot(currentBatch, instanceId);
        if (slotIndex >= 0 && slotIndex < currentBatch.capacity) {
          instanceSlotMap.set(instanceId, slotIndex);
        } else {
          // Неможливо знайти слот - об'єкт не буде рендеритися
          instanceSlotMap.delete(instanceId);
          return null;
        }
      }
      
      // Якщо слот є в map, просто використовуємо його і завжди оновлюємо
      // (незалежно від стану - ми перезапишемо дані нашого instance)

      const size = target.data.size ?? { width: 0, height: 0 };
      const radius = Math.max(0, Math.max(size.width, size.height) / 2);
      const position = { ...target.data.position };
      const custom = (target.data.customData ?? {}) as SandStormCustomData;
      const intensityRaw = typeof custom.intensity === "number" ? custom.intensity : 0;
      const intensity = Math.min(Math.max(intensityRaw, 0), 1);
      const phase = typeof custom.phase === "number" ? custom.phase : 0;

      // Завжди оновлюємо дані - навіть якщо слот тимчасово неактивний, ми його активуємо
      writeWhirlInstance(currentBatch, slotIndex, {
        position,
        radius,
        phase,
        intensity,
        active: true,
      });

      return null;
    },
    dispose() {
      // Вимикаємо слот і видаляємо з реєстру
      const slotIndex = instanceSlotMap.get(instanceId);
      if (slotIndex !== undefined) {
        const currentBatch = ensureBatch();
        if (currentBatch && slotIndex >= 0 && slotIndex < currentBatch.capacity) {
          const slotInstance = currentBatch.instances[slotIndex];
          if (slotInstance && slotInstance.active) {
            writeWhirlInstance(currentBatch, slotIndex, {
              position: { x: 0, y: 0 },
              radius: 0,
              phase: 0,
              intensity: 0,
              active: false,
            });
          }
        }
        instanceSlotMap.delete(instanceId);
      }
    },
  };
};

const ensureBatch = () => {
  const gl = getWhirlGlContext();
  if (!gl) {
    return null;
  }
  return ensureWhirlBatch(gl, DEFAULT_BATCH_CAPACITY);
};

const acquireSlot = (batch: NonNullable<ReturnType<typeof ensureBatch>>, instanceId: string, startIndex = 0): number => {
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
