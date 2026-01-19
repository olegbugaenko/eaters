import { getArcConfig, ArcType } from "../../../../../db/arcs-db";
import type {
  SceneObjectInstance,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { DynamicPrimitive, ObjectRegistration, ObjectRenderer } from "../../ObjectRenderer";
import { getParticleEmitterGlContext } from "../../../primitives/utils/gpuContext";
import {
  arcGpuRenderer,
  type ArcGpuUniforms,
  type ArcInstance,
  type ArcBatchConfig,
  type ArcSlotHandle,
} from "../../../primitives/gpu/arc";
import type { ArcRendererCustomData } from "./types";
import { DEFAULT_ARC_BATCH_CAPACITY } from "./constants";

export class ArcRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    let slotHandle: ArcSlotHandle | null = null;
    let age = 0;
    let lifetime = 1000;
    let lastTs =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    let batchKey: string | null = null;
    let batchConfig: ArcBatchConfig | null = null;

    const primitive: DynamicPrimitive = {
      data: new Float32Array(0),
      autoAnimate: true,
      update(target: SceneObjectInstance) {
        const data = target.data.customData as ArcRendererCustomData | undefined;
        if (!data) {
          if (slotHandle) {
            arcGpuRenderer.releaseSlot(slotHandle);
            slotHandle = null;
          }
          return null;
        }
        const gl = getParticleEmitterGlContext();
        if (!gl) {
          if (slotHandle) {
            arcGpuRenderer.releaseSlot(slotHandle);
            slotHandle = null;
          }
          return null;
        }
        if (arcGpuRenderer["gl"] !== gl) {
          arcGpuRenderer.setContext(gl);
          slotHandle = null;
        }
        const config = getArcConfig(data.arcType);
        lifetime = Math.max(1, data.lifetimeMs ?? config.lifetimeMs);

        // lazy acquire GL + batch keyed by visual params only
        if (!batchConfig) {
          const uniforms: ArcGpuUniforms = {
            coreColor: new Float32Array([
              config.coreColor.r,
              config.coreColor.g,
              config.coreColor.b,
              typeof config.coreColor.a === "number" ? config.coreColor.a : 1,
            ]),
            blurColor: new Float32Array([
              config.blurColor.r,
              config.blurColor.g,
              config.blurColor.b,
              typeof config.blurColor.a === "number" ? config.blurColor.a : 1,
            ]),
            coreWidth: config.coreWidth,
            blurWidth: config.blurWidth,
            fadeStartMs: data.fadeStartMs ?? config.fadeStartMs,
            noiseAmplitude: config.noiseAmplitude,
            noiseDensity: Math.max(0, config.bendsPer100Px / 100),
            aperiodicStrength: Math.max(0, config.aperiodicStrength ?? 0),
            oscAmplitude: config.oscillationAmplitude,
            oscAngularSpeed: (Math.PI * 2) / Math.max(1, config.oscillationPeriodMs),
          };
          batchKey = [
            uniforms.coreColor.join(","),
            uniforms.blurColor.join(","),
            uniforms.coreWidth,
            uniforms.blurWidth,
            uniforms.fadeStartMs,
            uniforms.noiseAmplitude,
            uniforms.noiseDensity,
            uniforms.aperiodicStrength,
            uniforms.oscAmplitude,
            uniforms.oscAngularSpeed,
          ].join("|");

          batchConfig = {
            batchKey,
            uniforms,
          };
        }

        // Acquire slot if not already acquired
        if (!slotHandle && batchConfig) {
          slotHandle = arcGpuRenderer.acquireSlot(batchConfig);
          if (!slotHandle) {
            return null;
          }
        }

        const now =
          typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();
        if (typeof data.createdAtMs === "number") {
          age = Math.min(lifetime, Math.max(0, now - data.createdAtMs));
          lastTs = now;
        } else {
          const dt = Math.max(0, Math.min(now - lastTs, 100));
          lastTs = now;
          age = Math.min(lifetime, age + dt);
        }

        if (slotHandle && batchConfig) {
          const isActive = age < lifetime;
          const instance: ArcInstance = {
            from: data.from,
            to: data.to,
            age,
            lifetime,
            active: isActive,
          };
          arcGpuRenderer.updateSlot(slotHandle, instance);
        }

        if (age >= lifetime) {
          if (slotHandle) {
            arcGpuRenderer.releaseSlot(slotHandle);
            slotHandle = null;
          }
          return null;
        }

        return null;
      },
      dispose() {
        if (slotHandle) {
          arcGpuRenderer.releaseSlot(slotHandle);
          slotHandle = null;
        }
      },
    };

    return {
      staticPrimitives: [],
      dynamicPrimitives: [primitive],
    };
  }
}
