import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import type { DynamicPrimitive } from "../../ObjectRenderer";
import { createParticleEmitterPrimitive } from "../../../primitives";
import type {
  ExplosionRendererCustomData,
  ExplosionEmitterRenderConfig,
} from "./types";
import type { ParticleEmitterConfig } from "../../../../../logic/interfaces/visuals/particle-emitters-config";
import {
  sanitizeExplosionEmitterConfig,
  serializeExplosionEmitterConfig,
  getEmitterOrigin,
  createExplosionParticle,
} from "./helpers";
import { createCachedEmitterConfigGetter } from "@shared/helpers/emitter-cache.helper";

/**
 * Gets the emitter config for an explosion instance (with caching)
 */
export const getEmitterConfig = createCachedEmitterConfigGetter<
  ParticleEmitterConfig,
  ExplosionEmitterRenderConfig
>(
  (instance) => {
    const data = instance.data.customData as ExplosionRendererCustomData | undefined;
    return data && typeof data === "object" ? data.emitter : undefined;
  },
  (source) => sanitizeExplosionEmitterConfig(source)
);

/**
 * Creates an explosion emitter primitive
 */
export const createExplosionEmitterPrimitive = (
  instance: SceneObjectInstance
): DynamicPrimitive | null =>
  createParticleEmitterPrimitive<ExplosionEmitterRenderConfig>(instance, {
    getConfig: getEmitterConfig,
    getOrigin: getEmitterOrigin,
    spawnParticle: createExplosionParticle,
    serializeConfig: serializeExplosionEmitterConfig,
  });
