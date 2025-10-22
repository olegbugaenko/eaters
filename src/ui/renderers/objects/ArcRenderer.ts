import { getArcConfig, ArcType } from "../../../db/arcs-db";
import { SceneObjectInstance, SceneVector2 } from "../../../logic/services/SceneObjectManager";
import { DynamicPrimitive, ObjectRegistration, ObjectRenderer } from "./ObjectRenderer";
import { getParticleEmitterGlContext } from "../primitives/gpuContext";
import {
  ArcGpuUniforms,
  ensureArcBatch,
  writeArcInstance,
  setArcBatchActiveCount,
} from "../primitives/ArcGpuRenderer";

interface ArcRendererCustomData {
  arcType: ArcType;
  from: SceneVector2;
  to: SceneVector2;
  lifetimeMs?: number;
  fadeStartMs?: number;
}

export class ArcRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    let slotIndex = -1;
    let age = 0;
    let lifetime = 1000;
    let lastTs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    let batch: ReturnType<typeof ensureArcBatch> | null = null;
    let batchKey: string | null = null;

    const primitive: DynamicPrimitive = {
      data: new Float32Array(0),
      update(target: SceneObjectInstance) {
        const data = target.data.customData as ArcRendererCustomData | undefined;
        if (!data) return null;
        const config = getArcConfig(data.arcType);
        lifetime = Math.max(1, data.lifetimeMs ?? config.lifetimeMs);

        // lazy acquire GL + batch keyed by visual params only
        if (!batch) {
          const gl = getParticleEmitterGlContext();
          if (!gl) return null;
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
            uniforms.oscAmplitude,
            uniforms.oscAngularSpeed,
          ].join("|");
          batch = ensureArcBatch(gl, batchKey, 256, uniforms);
          if (!batch) return null;
        }

        const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        const dt = Math.max(0, Math.min(now - lastTs, 100));
        lastTs = now;
        age = Math.min(lifetime, age + dt);

        if (slotIndex < 0 && batch) {
          for (let i = 0; i < batch.capacity; i += 1) {
            const inst = batch.instances[i];
            if (!inst || !inst.active) {
              slotIndex = i;
              break;
            }
          }
          if (slotIndex < 0) slotIndex = 0;
        }

        if (batch && slotIndex >= 0) {
          writeArcInstance(batch, slotIndex, {
            from: data.from,
            to: data.to,
            age,
            lifetime,
            active: age < lifetime,
          });
          let activeCount = 0;
          for (let i = 0; i < batch.capacity; i += 1) {
            if (batch.instances[i]?.active) activeCount += 1;
          }
          setArcBatchActiveCount(batch, activeCount);
        }

        if (age >= lifetime) {
          return null;
        }

        return null;
      },
      dispose() {
        if (batch && slotIndex >= 0 && slotIndex < batch.capacity) {
          writeArcInstance(batch, slotIndex, {
            from: { x: 0, y: 0 },
            to: { x: 0, y: 0 },
            age: 0,
            lifetime: 0,
            active: false,
          });
          let activeCount = 0;
          for (let i = 0; i < batch.capacity; i += 1) {
            if (batch.instances[i]?.active) activeCount += 1;
          }
          setArcBatchActiveCount(batch, activeCount);
        }
      },
    };

    return {
      staticPrimitives: [],
      dynamicPrimitives: [primitive],
    };
  }
}

