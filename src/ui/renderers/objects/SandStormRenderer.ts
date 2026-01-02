import {
  ObjectRenderer,
  ObjectRegistration,
  DynamicPrimitive,
} from "./ObjectRenderer";
import { SceneObjectInstance, SceneVector2, SceneColor } from "../../../logic/services/scene-object-manager/scene-object-manager.types";
import {
  ensureWhirlBatch,
  writeWhirlInstance,
  getWhirlGlContext,
} from "../primitives/gpu/WhirlGpuRenderer";

interface SandStormCustomData {
  intensity?: number;
  phase?: number;
  velocity?: SceneVector2;
  lastUpdateTime?: number;
  spinSpeed?: number;
  rotationSpeedMultiplier?: number;
  spiralArms?: number;
  spiralArms2?: number;
  spiralTwist?: number;
  spiralTwist2?: number;
  colorInner?: SceneColor;
  colorMid?: SceneColor;
  colorOuter?: SceneColor;
}

const DEFAULT_BATCH_CAPACITY = 128;

// Допоміжна функція для обчислення інтерпольованого стану
const computeInterpolatedState = (
  batch: NonNullable<ReturnType<typeof ensureBatch>>,
  slotIndex: number,
  data: InterpolationData
): Float32Array | null => {
  const currentTime = performance.now();
  const timeSinceUpdate = Math.max(0, Math.min(currentTime - data.lastUpdateTime, 200)) / 1000; // Clamp to max 200ms
  
  // Інтерполяція позиції
  const position = {
    x: data.basePosition.x + data.velocity.x * timeSinceUpdate,
    y: data.basePosition.y + data.velocity.y * timeSinceUpdate,
  };

  // Інтерполяція phase (обертання)
  const interpolatedPhase = data.phase + data.spinSpeed * timeSinceUpdate;

  writeWhirlInstance(batch, slotIndex, {
    position,
    radius: data.radius,
    phase: interpolatedPhase,
    intensity: data.intensity,
    active: true,
    rotationSpeedMultiplier: data.rotationSpeedMultiplier,
    spiralArms: data.spiralArms,
    spiralArms2: data.spiralArms2,
    spiralTwist: data.spiralTwist,
    spiralTwist2: data.spiralTwist2,
    colorInner: data.colorInner,
    colorMid: data.colorMid,
    colorOuter: data.colorOuter,
  });

  // Завжди повертаємо дані, щоб примусити рендерер оновлюватися на кожному кадрі
  return new Float32Array(0);
};

// Глобальний реєстр для зв'язку instance ID з slot index
const instanceSlotMap = new Map<string, number>();

// Глобальний реєстр для зберігання даних інтерполяції для кожного instance
interface InterpolationData {
  basePosition: SceneVector2;
  velocity: SceneVector2;
  lastUpdateTime: number;
  phase: number;
  spinSpeed: number;
  radius: number;
  intensity: number;
  rotationSpeedMultiplier: number;
  spiralArms: number;
  spiralArms2: number;
  spiralTwist: number;
  spiralTwist2: number;
  colorInner: [number, number, number];
  colorMid: [number, number, number];
  colorOuter: [number, number, number];
}
const interpolationDataMap = new Map<string, InterpolationData>();

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

// Експортована функція для оновлення всіх інтерпольованих позицій перед рендерингом
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

    const timeSinceUpdate = Math.max(0, Math.min(currentTime - interpData.lastUpdateTime, 200)) / 1000;
    
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

      const size = target.data.size ?? { width: 0, height: 0 };
      const radius = Math.max(0, Math.max(size.width, size.height) / 2);
      const basePosition = { ...target.data.position };
      const custom = (target.data.customData ?? {}) as SandStormCustomData;
      const intensityRaw = typeof custom.intensity === "number" ? custom.intensity : 0;
      const intensity = Math.min(Math.max(intensityRaw, 0), 1);
      const phase = typeof custom.phase === "number" ? custom.phase : 0;
      const velocity = custom.velocity ?? { x: 0, y: 0 };
      const lastUpdateTime = typeof custom.lastUpdateTime === "number" ? custom.lastUpdateTime : performance.now();
      const spinSpeed = typeof custom.spinSpeed === "number" ? custom.spinSpeed : 0;

      // Оновлюємо глобальні дані інтерполяції
      interpolationDataMap.set(instanceId, {
        basePosition: { ...basePosition },
        velocity: { ...velocity },
        lastUpdateTime,
        phase,
        spinSpeed,
        radius,
        intensity,
        rotationSpeedMultiplier: typeof custom.rotationSpeedMultiplier === "number" ? custom.rotationSpeedMultiplier : 1.0,
        spiralArms: typeof custom.spiralArms === "number" ? custom.spiralArms : 6.0,
        spiralArms2: typeof custom.spiralArms2 === "number" ? custom.spiralArms2 : 12.0,
        spiralTwist: typeof custom.spiralTwist === "number" ? custom.spiralTwist : 7.0,
        spiralTwist2: typeof custom.spiralTwist2 === "number" ? custom.spiralTwist2 : 4.0,
        colorInner: (() => {
          const c = custom.colorInner ?? { r: 0.95, g: 0.88, b: 0.72, a: 1 };
          return [c.r, c.g, c.b];
        })(),
        colorMid: (() => {
          const c = custom.colorMid ?? { r: 0.85, g: 0.72, b: 0.58, a: 1 };
          return [c.r, c.g, c.b];
        })(),
        colorOuter: (() => {
          const c = custom.colorOuter ?? { r: 0.68, g: 0.55, b: 0.43, a: 1 };
          return [c.r, c.g, c.b];
        })(),
      });

      // Завжди обчислюємо інтерпольовану позицію та phase
      const interpData = interpolationDataMap.get(instanceId);
      if (interpData) {
        return computeInterpolatedState(currentBatch, slotIndex, interpData);
      }
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
              rotationSpeedMultiplier: 1.0,
              spiralArms: 6.0,
              spiralArms2: 12.0,
              spiralTwist: 7.0,
              spiralTwist2: 4.0,
              colorInner: [0.95, 0.88, 0.72],
              colorMid: [0.85, 0.72, 0.58],
              colorOuter: [0.68, 0.55, 0.43],
            });
          }
        }
        instanceSlotMap.delete(instanceId);
        interpolationDataMap.delete(instanceId);
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
