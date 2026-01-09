import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { DynamicPrimitive } from "../../ObjectRenderer";
import { createParticleEmitterPrimitive } from "../../../primitives";
import type { GpuSpawnConfig } from "../../../primitives/ParticleEmitterPrimitive";
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
 * Extracts GPU spawn config from explosion emitter config
 */
const getGpuSpawnConfig = (
  _instance: SceneObjectInstance,
  config: ExplosionEmitterRenderConfig
): GpuSpawnConfig => ({
  baseSpeed: config.baseSpeed,
  speedVariation: config.speedVariation,
  sizeMin: config.sizeRange.min,
  sizeMax: config.sizeRange.max,
  spawnRadiusMin: config.spawnRadius.min,
  spawnRadiusMax: config.spawnRadius.max,
  arc: config.arc,
  direction: config.direction,
  spread: 0, // Explosions don't use spread
  radialVelocity: config.radialVelocity ?? false,
});

/**
 * Creates an explosion emitter primitive with GPU-based particle spawning
 */
export const createExplosionEmitterPrimitive = (
  instance: SceneObjectInstance
): DynamicPrimitive | null =>
  createParticleEmitterPrimitive<ExplosionEmitterRenderConfig>(instance, {
    getConfig: getEmitterConfig,
    getOrigin: getEmitterOrigin,
    spawnParticle: createExplosionParticle,
    serializeConfig: serializeExplosionEmitterConfig,
    getGpuSpawnConfig, // Enable GPU particle spawning!
  });
