import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type {
  SceneFill,
  SceneSolidFill,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { getParticleEmitterGlContext } from "../../../primitives/utils/gpuContext";
import {
  explosionWaveGpuRenderer,
  type WaveInstance,
  type WaveUniformConfig,
  type WaveSlotHandle,
} from "../../../primitives/gpu/explosion-wave";
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
      let handle: WaveSlotHandle | null = null;
      let age = 0;
      // Get wave params from customData
      const customData = instance.data.customData as ExplosionRendererCustomData | undefined;
      const lifetime = customData?.waveLifetimeMs ?? DEFAULT_WAVE_LIFETIME_MS;
      const startAlpha = customData?.startAlpha ?? 1;
      const endAlpha = customData?.endAlpha ?? 0;
      let lastTs =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      dynamicPrimitives.push({
        data: new Float32Array(0),
        update(target) {
          const gl = getParticleEmitterGlContext();
          if (!gl) {
            return null;
          }

          explosionWaveGpuRenderer.setContext(gl);

          // Acquire slot if needed (uniforms set once on acquire)
          if (!handle) {
            const fill: SceneFill =
              (target.data.fill as SceneFill) ??
              ({
                fillType: FILL_TYPES.SOLID,
                color: { r: 1, g: 1, b: 1, a: 1 },
              } as SceneSolidFill);
            const { uniforms } = toWaveUniformsFromFill(fill);
            uniforms.hasExplicitRadius = false;
            uniforms.explicitRadius = 0;

            handle = explosionWaveGpuRenderer.acquireSlot(uniforms);
            if (!handle) {
              return null;
            }
            age = 0;
            lastTs =
              typeof performance !== "undefined" && performance.now
                ? performance.now()
                : Date.now();
          }

          const now =
            typeof performance !== "undefined" && performance.now
              ? performance.now()
              : Date.now();
          const dt = Math.max(0, Math.min(now - lastTs, 100));
          lastTs = now;
          age = Math.min(lifetime, age + dt);

          const radius = Math.max(
            0,
            Math.max(target.data.size?.width ?? 0, target.data.size?.height ?? 0) / 2
          );
          const isActive = age < lifetime;

          // Instance data - GPU shader handles alpha interpolation
          const waveInstance: WaveInstance = {
            position: target.data.position,
            size: radius * 2,
            age,
            lifetime,
            active: isActive,
            startAlpha,
            endAlpha,
          };

          explosionWaveGpuRenderer.updateSlot(handle, waveInstance);
          return null;
        },
        dispose() {
          if (handle) {
            explosionWaveGpuRenderer.releaseSlot(handle);
            handle = null;
          }
        },
      });
    }

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
