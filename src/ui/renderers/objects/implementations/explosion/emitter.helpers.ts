import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import type { DynamicPrimitive } from "../../ObjectRenderer";
import { createParticleEmitterPrimitive } from "../../../primitives";
import type {
  ExplosionRendererCustomData,
  ExplosionEmitterRenderConfig,
  ExplosionEmitterConfigCache,
} from "./types";
import {
  sanitizeExplosionEmitterConfig,
  serializeExplosionEmitterConfig,
  getEmitterOrigin,
  createExplosionParticle,
} from "./helpers";

// Cache emitter configs to avoid creating new objects every frame
const explosionEmitterConfigCache = new WeakMap<
  SceneObjectInstance,
  ExplosionEmitterConfigCache
>();

/**
 * Gets the emitter config for an explosion instance (with caching)
 */
export const getEmitterConfig = (
  instance: SceneObjectInstance
): ExplosionEmitterRenderConfig | null => {
  const data = instance.data.customData as ExplosionRendererCustomData | undefined;
  const emitterSource = data?.emitter;

  // Return cached config if source hasn't changed
  const cached = explosionEmitterConfigCache.get(instance);
  if (cached && cached.source === emitterSource) {
    return cached.config;
  }

  if (!data || typeof data !== "object" || !emitterSource) {
    explosionEmitterConfigCache.set(instance, { source: undefined, config: null });
    return null;
  }

  const config = sanitizeExplosionEmitterConfig(emitterSource);
  explosionEmitterConfigCache.set(instance, { source: emitterSource, config });
  return config;
};

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
