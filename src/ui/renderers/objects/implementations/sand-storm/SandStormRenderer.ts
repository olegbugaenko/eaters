import {
  ObjectRenderer,
  ObjectRegistration,
  DynamicPrimitive,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { writeWhirlInstance } from "../../../primitives/gpu/WhirlGpuRenderer";
import { ensureBatch, acquireSlot } from "./batch.helpers";
import { computeInterpolatedState } from "./interpolation.helpers";
import { extractCustomData, createInterpolationData } from "./data.helpers";
import type { InterpolationData } from "./types";
import {
  DEFAULT_COLOR_INNER,
  DEFAULT_COLOR_MID,
  DEFAULT_COLOR_OUTER,
  DEFAULT_ROTATION_SPEED_MULTIPLIER,
  DEFAULT_SPIRAL_ARMS,
  DEFAULT_SPIRAL_ARMS2,
  DEFAULT_SPIRAL_TWIST,
  DEFAULT_SPIRAL_TWIST2,
} from "./constants";

// Глобальний реєстр для зв'язку instance ID з slot index
const instanceSlotMap = new Map<string, number>();

// Глобальний реєстр для зберігання даних інтерполяції для кожного instance
const interpolationDataMap = new Map<string, InterpolationData>();

// Глобальна змінна для відстеження поточного batch
let currentBatchRef: ReturnType<typeof ensureBatch> | null = null;

/**
 * Updates all interpolated whirl positions before rendering
 */
export const updateAllWhirlInterpolations = (): void => {
  const currentBatch = ensureBatch();
  if (!currentBatch) {
    return;
  }

  const currentTime = performance.now();

  // Оновлюємо інтерпольовані позиції для всіх активних instances
  instanceSlotMap.forEach((slotIndex, instanceId) => {
    const interpData = interpolationDataMap.get(instanceId);
    if (!interpData || slotIndex < 0 || slotIndex >= currentBatch.capacity) {
      return;
    }

    const timeSinceUpdate =
      Math.max(0, Math.min(currentTime - interpData.lastUpdateTime, 200)) / 1000;

    // Інтерполяція позиції
    const position = {
      x: interpData.basePosition.x + interpData.velocity.x * timeSinceUpdate,
      y: interpData.basePosition.y + interpData.velocity.y * timeSinceUpdate,
    };

    // Інтерполяція phase (обертання)
    const interpolatedPhase = interpData.phase + interpData.spinSpeed * timeSinceUpdate;

    writeWhirlInstance(currentBatch, slotIndex, {
      position,
      radius: interpData.radius,
      phase: interpolatedPhase,
      intensity: interpData.intensity,
      active: true,
      rotationSpeedMultiplier: interpData.rotationSpeedMultiplier,
      spiralArms: interpData.spiralArms,
      spiralArms2: interpData.spiralArms2,
      spiralTwist: interpData.spiralTwist,
      spiralTwist2: interpData.spiralTwist2,
      colorInner: interpData.colorInner,
      colorMid: interpData.colorMid,
      colorOuter: interpData.colorOuter,
    });
  });
};

const createWhirlPrimitive = (instance: SceneObjectInstance): DynamicPrimitive => {
  const instanceId = instance.id;

  return {
    data: new Float32Array(0),
    update(target) {
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

      // Якщо немає слоту або він невалідний, шукаємо новий
      if (slotIndex === undefined || slotIndex < 0 || slotIndex >= currentBatch.capacity) {
        slotIndex = acquireSlot(currentBatch, instanceId, instanceSlotMap);
        if (slotIndex >= 0 && slotIndex < currentBatch.capacity) {
          instanceSlotMap.set(instanceId, slotIndex);
        } else {
          // Неможливо знайти слот - об'єкт не буде рендеритися
          instanceSlotMap.delete(instanceId);
          return null;
        }
      }

      const {
        intensity,
        phase,
        velocity,
        lastUpdateTime,
        spinSpeed,
        radius,
      } = extractCustomData(target);
      const basePosition = { ...target.data.position };

      // Оновлюємо глобальні дані інтерполяції
      const interpData = createInterpolationData(
        target,
        basePosition,
        velocity,
        lastUpdateTime,
        phase,
        spinSpeed,
        radius,
        intensity
      );
      interpolationDataMap.set(instanceId, interpData);

      // Завжди обчислюємо інтерпольовану позицію та phase
      return computeInterpolatedState(currentBatch, slotIndex, interpData);
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
              rotationSpeedMultiplier: DEFAULT_ROTATION_SPEED_MULTIPLIER,
              spiralArms: DEFAULT_SPIRAL_ARMS,
              spiralArms2: DEFAULT_SPIRAL_ARMS2,
              spiralTwist: DEFAULT_SPIRAL_TWIST,
              spiralTwist2: DEFAULT_SPIRAL_TWIST2,
              colorInner: DEFAULT_COLOR_INNER,
              colorMid: DEFAULT_COLOR_MID,
              colorOuter: DEFAULT_COLOR_OUTER,
            });
          }
        }
        instanceSlotMap.delete(instanceId);
        interpolationDataMap.delete(instanceId);
      }
    },
  };
};

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
