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
  type WaveSlotHandle,
} from "../../../primitives/gpu/explosion-wave";
import {
  starburstGpuRenderer,
  type StarburstInstance,
  type StarburstSlotHandle,
} from "../../../primitives/gpu/starburst";
import { createExplosionEmitterPrimitive } from "./emitter.helpers";
import { toWaveUniformsFromFill } from "./wave-uniforms.helpers";
import { DEFAULT_WAVE_LIFETIME_MS } from "./constants";
import type { ExplosionRendererCustomData } from "./types";

export class ExplosionObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const dynamicPrimitives: DynamicPrimitive[] = [];

    const emitterPrimitive = createExplosionEmitterPrimitive(instance);
    if (emitterPrimitive) {
      emitterPrimitive.autoAnimate = true;
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

    // GPU starburst primitive (optional, configured via customData.starburst)
    {
      let handle: StarburstSlotHandle | null = null;
      let age = 0;
      const customData = instance.data.customData as ExplosionRendererCustomData | undefined;
      const starburstConfig = customData?.starburst;
      const starburstEnabled = Boolean(starburstConfig && starburstConfig.enabled !== false);
      const lifetime = Math.max(1, starburstConfig?.lifetimeMs ?? 1);
      const fadeStartMs = Math.max(0, starburstConfig?.fadeStartMs ?? lifetime * 0.6);
      const growSizeMult = Math.max(0.0001, starburstConfig?.growSizeMult ?? 1);
      const angleJitterRad = Math.max(0, starburstConfig?.angleJitterRad ?? 0);
      const spikeCount = Math.max(1, Math.round(starburstConfig?.spikeCount ?? 6));
      const spikeLengthMin = Math.max(0.01, starburstConfig?.spikeLength.min ?? 20);
      const spikeLengthMax = Math.max(spikeLengthMin, starburstConfig?.spikeLength.max ?? spikeLengthMin);
      const spikeWidthMin = Math.max(0.01, starburstConfig?.spikeWidth.min ?? 6);
      const spikeWidthMax = Math.max(spikeWidthMin, starburstConfig?.spikeWidth.max ?? spikeWidthMin);
      const spikeLength = spikeLengthMin === spikeLengthMax
        ? spikeLengthMin
        : spikeLengthMin + Math.random() * (spikeLengthMax - spikeLengthMin);
      const spikeWidth = spikeWidthMin === spikeWidthMax
        ? spikeWidthMin
        : spikeWidthMin + Math.random() * (spikeWidthMax - spikeWidthMin);
      const lengthJitter = Math.max(0, starburstConfig?.lengthJitter ?? 0);
      const widthJitter = Math.max(0, starburstConfig?.widthJitter ?? 0);
      const seed = starburstConfig?.seed ?? Math.random() * 100_000;
      const color = starburstConfig?.color ?? { r: 1, g: 1, b: 1, a: 0.65 };

      let lastTs =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();

      dynamicPrimitives.push({
        data: new Float32Array(0),
        update(target) {
          if (!starburstEnabled) {
            return null;
          }
          const gl = getParticleEmitterGlContext();
          if (!gl) {
            return null;
          }

          starburstGpuRenderer.setContext(gl);

          if (!handle) {
            handle = starburstGpuRenderer.acquireSlot(undefined);
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

          const starburstInstance: StarburstInstance = {
            position: target.data.position,
            age,
            lifetime,
            active: age < lifetime,
            spikeCount,
            spikeLength,
            spikeWidth,
            angleJitterRad,
            lengthJitter,
            widthJitter,
            growSizeMult,
            fadeStartMs,
            seed,
            color,
          };

          starburstGpuRenderer.updateSlot(handle, starburstInstance);
          return null;
        },
        dispose() {
          if (handle) {
            starburstGpuRenderer.releaseSlot(handle);
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
