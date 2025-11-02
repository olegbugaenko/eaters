import {
  ObjectRenderer,
  ObjectRegistration,
  DynamicPrimitive,
} from "./ObjectRenderer";
import { SceneObjectInstance } from "../../../logic/services/SceneObjectManager";
import { ensureWhirlBatch, writeWhirlInstance } from "../primitives/WhirlGpuRenderer";
import { getWhirlGlContext } from "../primitives/whirlContext";

interface SandStormCustomData {
  intensity?: number;
  phase?: number;
}

const DEFAULT_BATCH_CAPACITY = 128;

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

const createWhirlPrimitive = (instance: SceneObjectInstance): DynamicPrimitive => {
  let batch = ensureBatch();
  let slotIndex = -1;

  return {
    data: new Float32Array(0),
    update(target) {
      const gl = getWhirlGlContext();
      if (!gl) {
        return null;
      }

      if (!batch || batch.gl !== gl || batch.capacity < DEFAULT_BATCH_CAPACITY) {
        batch = ensureBatch();
        slotIndex = -1;
        if (!batch) {
          return null;
        }
      }

      if (!batch) {
        return null;
      }

      if (slotIndex < 0 || slotIndex >= batch.capacity) {
        slotIndex = acquireSlot(batch);
      } else if (!batch.instances[slotIndex] || !batch.instances[slotIndex]!.active) {
        slotIndex = acquireSlot(batch, slotIndex);
      }

      if (slotIndex < 0 || slotIndex >= batch.capacity) {
        return null;
      }

      const size = target.data.size ?? { width: 0, height: 0 };
      const radius = Math.max(0, Math.max(size.width, size.height) / 2);
      const custom = (target.data.customData ?? {}) as SandStormCustomData;
      const intensityRaw = typeof custom.intensity === "number" ? custom.intensity : 0;
      const intensity = Math.min(Math.max(intensityRaw, 0), 1);
      const phase = typeof custom.phase === "number" ? custom.phase : 0;

      writeWhirlInstance(batch, slotIndex, {
        position: { ...target.data.position },
        radius,
        phase,
        intensity,
        active: true,
      });

      return null;
    },
    dispose() {
      if (batch && slotIndex >= 0 && slotIndex < batch.capacity) {
        writeWhirlInstance(batch, slotIndex, {
          position: { x: 0, y: 0 },
          radius: 0,
          phase: 0,
          intensity: 0,
          active: false,
        });
      }
      slotIndex = -1;
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

const acquireSlot = (batch: NonNullable<ReturnType<typeof ensureBatch>>, startIndex = 0): number => {
  for (let i = 0; i < batch.capacity; i += 1) {
    const index = (startIndex + i) % batch.capacity;
    const inst = batch.instances[index];
    if (!inst || !inst.active) {
      return index;
    }
  }
  return Math.max(0, batch.capacity - 1);
};
