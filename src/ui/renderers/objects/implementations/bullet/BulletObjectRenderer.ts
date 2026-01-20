import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  createDynamicCirclePrimitive,
  createDynamicTrianglePrimitive,
  createParticleEmitterPrimitive,
} from "../../../primitives";
import { getRenderComponents, getProjectileShape, getTailRotation } from "./helpers";
import { getTailConfig, createTailVertices, createTailFill } from "./tail.helpers";
import {
  getTailEmitterConfig,
  getTrailEmitterConfig,
  getSmokeEmitterConfig,
  getTailEmitterOrigin,
  createTailParticle,
  serializeTailEmitterConfig,
  getGpuSpawnConfig,
} from "./emitter.helpers";
import { getGlowConfig, getGlowRadius, createGlowFill } from "./glow.helpers";
import { createTriangleVertices } from "./triangle.helpers";
import type { BulletTailEmitterRenderConfig } from "./types";

const createEmitterPrimitive = (
  instance: SceneObjectInstance,
  getConfig: (instance: SceneObjectInstance) => BulletTailEmitterRenderConfig | null
): DynamicPrimitive | null => {
  const primitive = createParticleEmitterPrimitive<BulletTailEmitterRenderConfig>(instance, {
    getConfig,
    getOrigin: getTailEmitterOrigin,
    spawnParticle: createTailParticle,
    serializeConfig: serializeTailEmitterConfig,
    getGpuSpawnConfig,
  });
  if (primitive) {
    primitive.autoAnimate = true;
  }
  return primitive;
};

export class BulletObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const components = getRenderComponents(instance);

    const emitterPrimitive =
      components.emitters && createEmitterPrimitive(instance, getTailEmitterConfig);
    const trailEmitter =
      components.emitters && createEmitterPrimitive(instance, getTrailEmitterConfig);
    const smokeEmitter =
      components.emitters && createEmitterPrimitive(instance, getSmokeEmitterConfig);
    const dynamicPrimitives: DynamicPrimitive[] = [];
    if (emitterPrimitive) {
      dynamicPrimitives.push(emitterPrimitive);
    }
    if (trailEmitter) {
      dynamicPrimitives.push(trailEmitter);
    }
    if (smokeEmitter) {
      dynamicPrimitives.push(smokeEmitter);
    }

    // OPTIMIZATION: Pre-compute vertices and fill at registration time
    // This allows primitives to use their fast-path (skip update when position unchanged)
    if (components.tail) {
      const tailVertices = createTailVertices(instance);
      const tailFill = createTailFill(instance);
      dynamicPrimitives.push(
        createDynamicTrianglePrimitive(instance, {
          vertices: tailVertices,
          fill: tailFill,
          getRotation: getTailRotation,
        })
      );
    }

    const glowConfig = components.glow ? getGlowConfig(instance) : null;
    if (glowConfig) {
      const glowFill = createGlowFill(instance, glowConfig);
      dynamicPrimitives.push(
        createDynamicCirclePrimitive(instance, {
          getRadius: getGlowRadius,
          fill: glowFill,
        })
      );
    }

    if (components.body) {
      // Fallback renderer: sprites fall back to circles
      // (GPU renderer handles actual sprite textures)
      dynamicPrimitives.push(
        createDynamicCirclePrimitive(instance, {
          fill: instance.data.fill,
        })
      );
    }

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
