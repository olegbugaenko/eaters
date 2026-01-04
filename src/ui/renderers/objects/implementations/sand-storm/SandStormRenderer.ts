import {
  ObjectRenderer,
  ObjectRegistration,
  DynamicPrimitive,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { whirlGpuRenderer, type WhirlInstance, type WhirlSlotHandle } from "../../../primitives/gpu/whirl";
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

// Глобальний реєстр для зв'язку instance ID з slot handle
const instanceSlotMap = new Map<string, WhirlSlotHandle>();

// Глобальний реєстр для зберігання даних інтерполяції для кожного instance
const interpolationDataMap = new Map<string, InterpolationData>();

/**
 * Updates all interpolated whirl positions before rendering
 */
export const updateAllWhirlInterpolations = (): void => {
  const gl = ensureBatch();
  if (!gl) {
    return;
  }

  const currentTime = performance.now();

  // Оновлюємо інтерпольовані позиції для всіх активних instances
  instanceSlotMap.forEach((handle, instanceId) => {
    const interpData = interpolationDataMap.get(instanceId);
    if (!interpData) {
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

    const instance: WhirlInstance = {
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
    };

    whirlGpuRenderer.updateSlot(handle, instance);
  });
};

const createWhirlPrimitive = (instance: SceneObjectInstance): DynamicPrimitive => {
  const instanceId = instance.id;

  return {
    data: new Float32Array(0),
    update(target) {
      const gl = ensureBatch();
      if (!gl) {
        instanceSlotMap.delete(instanceId);
        return null;
      }

      // Отримуємо або призначаємо slot для цього instance
      let handle: WhirlSlotHandle | null | undefined = instanceSlotMap.get(instanceId);

      // Якщо немає слоту, шукаємо новий
      if (!handle) {
        handle = acquireSlot(gl, instanceId, instanceSlotMap);
        if (!handle) {
          // Неможливо знайти слот - об'єкт не буде рендеритися
          instanceSlotMap.delete(instanceId);
          return null;
        }
        instanceSlotMap.set(instanceId, handle);
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
      return computeInterpolatedState(handle, interpData);
    },
    dispose() {
      // Вимикаємо слот і видаляємо з реєстру
      const handle = instanceSlotMap.get(instanceId);
      if (handle) {
        whirlGpuRenderer.releaseSlot(handle);
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
