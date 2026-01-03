import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import type {
  SceneFill,
  SceneSolidFill,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { getParticleEmitterGlContext } from "../../../primitives/utils/gpuContext";
import {
  ensureWaveBatch,
  writeWaveInstance,
  setWaveBatchActiveCount,
} from "../../../primitives/gpu/ExplosionWaveGpuRenderer";
import { createExplosionEmitterPrimitive } from "./emitter.helpers";
import { toWaveUniformsFromFill } from "./wave-uniforms.helpers";
import { DEFAULT_WAVE_LIFETIME_MS, DEFAULT_WAVE_BATCH_CAPACITY } from "./constants";
import type { ExplosionRendererCustomData } from "./types";

export class ExplosionObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const dynamicPrimitives: DynamicPrimitive[] = [];

    const emitterPrimitive = createExplosionEmitterPrimitive(instance);
    if (emitterPrimitive) {
      dynamicPrimitives.push(emitterPrimitive);
    }

    // GPU wave ring primitive (lazy init to avoid races with GL context availability)
    {
      let batch: ReturnType<typeof ensureWaveBatch> | null = null;
      let fillKeyCached: string | null = null;
      let slotIndex = -1;
      let age = 0;
      // Get wave lifetime from customData, fallback to default
      const customData = instance.data.customData as ExplosionRendererCustomData | undefined;
      const lifetime = customData?.waveLifetimeMs ?? DEFAULT_WAVE_LIFETIME_MS;
      let lastTs =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      // Cache fill reference to avoid recalculating key every frame
      let lastFillRef: SceneFill | null = null;
      dynamicPrimitives.push({
        data: new Float32Array(0),
        update(target) {
          if (batch && batch.disposed) {
            batch = null;
            slotIndex = -1;
          }
          // Acquire GL and batch lazily
          if (!batch) {
            const gl = getParticleEmitterGlContext();
            if (gl) {
              const fill: SceneFill =
                (target.data.fill as SceneFill) ??
                ({
                  fillType: FILL_TYPES.SOLID,
                  color: { r: 1, g: 1, b: 1, a: 1 },
                } as SceneSolidFill);
              const { uniforms, key: fillKey } = toWaveUniformsFromFill(fill);
              uniforms.hasExplicitRadius = false;
              uniforms.explicitRadius = 0;
              batch = ensureWaveBatch(gl, fillKey, DEFAULT_WAVE_BATCH_CAPACITY, uniforms);
              fillKeyCached = batch ? fillKey : null;
              lastFillRef = fill;
            }
            if (!batch) {
              return null;
            }
          }

          // Only recalculate key if fill reference changed (rare)
          const currentFill: SceneFill =
            (target.data.fill as SceneFill) ??
            ({
              fillType: FILL_TYPES.SOLID,
              color: { r: 1, g: 1, b: 1, a: 1 },
            } as SceneSolidFill);
          if (currentFill !== lastFillRef && fillKeyCached) {
            lastFillRef = currentFill;
            const { key: currentKey } = toWaveUniformsFromFill(currentFill);
            if (currentKey !== fillKeyCached) {
              // Deactivate previous slot in the old batch before switching
              if (batch && slotIndex >= 0 && slotIndex < batch.capacity) {
                const wasActive = batch.instances[slotIndex]?.active ?? false;
                writeWaveInstance(batch, slotIndex, {
                  position: { x: 0, y: 0 },
                  size: 0,
                  age: 0,
                  lifetime: 0,
                  active: false,
                });
                if (wasActive) {
                  setWaveBatchActiveCount(batch, batch.handle.activeCount - 1);
                }
              }
              const gl = getParticleEmitterGlContext();
              if (gl) {
                const { uniforms } = toWaveUniformsFromFill(currentFill);
                uniforms.hasExplicitRadius = false;
                uniforms.explicitRadius = 0;
                const next = ensureWaveBatch(
                  gl,
                  currentKey,
                  DEFAULT_WAVE_BATCH_CAPACITY,
                  uniforms
                );
                if (next) {
                  batch = next;
                  fillKeyCached = currentKey;
                  slotIndex = -1;
                  age = 0;
                  lastTs =
                    typeof performance !== "undefined" && performance.now
                      ? performance.now()
                      : Date.now();
                }
              }
            }
          }

          const now =
            typeof performance !== "undefined" && performance.now
              ? performance.now()
              : Date.now();
          const dt = Math.max(0, Math.min(now - lastTs, 100));
          lastTs = now;
          age = Math.min(lifetime, age + dt);

          if (slotIndex < 0) {
            for (let i = 0; i < batch.capacity; i += 1) {
              if (!batch.instances[i] || !batch.instances[i]!.active) {
                slotIndex = i;
                break;
              }
            }
            if (slotIndex < 0) {
              slotIndex = 0;
            }
          }

          const radius = Math.max(
            0,
            Math.max(target.data.size?.width ?? 0, target.data.size?.height ?? 0) / 2
          );
          const wasActive = batch.instances[slotIndex]?.active ?? false;
          const isActive = age < lifetime;
          writeWaveInstance(batch, slotIndex, {
            position: target.data.position,
            size: radius * 2,
            age,
            lifetime,
            active: isActive,
          });
          // Incremental update instead of O(capacity) loop
          if (isActive && !wasActive) {
            setWaveBatchActiveCount(batch, batch.handle.activeCount + 1);
          } else if (!isActive && wasActive) {
            setWaveBatchActiveCount(batch, batch.handle.activeCount - 1);
          }
          return null;
        },
        dispose() {
          if (batch && slotIndex >= 0 && slotIndex < batch.capacity) {
            const wasActive = batch.instances[slotIndex]?.active ?? false;
            writeWaveInstance(batch, slotIndex, {
              position: { x: 0, y: 0 },
              size: 0,
              age: 0,
              lifetime: 0,
              active: false,
            });
            // Decrement only if was active
            if (wasActive) {
              setWaveBatchActiveCount(batch, batch.handle.activeCount - 1);
            }
          }
          batch = null;
        },
      });
    }

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
