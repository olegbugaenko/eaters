import type { SceneObjectInstance, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type {
  GpuSpawnConfig,
  ParticleEmitterParticleState,
} from "../../../primitives/ParticleEmitterPrimitive";
import { sanitizeParticleEmitterConfig } from "../../../primitives/ParticleEmitterPrimitive";
import { getInstanceRenderPosition, transformObjectPoint } from "../../ObjectRenderer";
import { DEFAULT_PORTAL_EMITTER } from "./constants";
import type { PortalCustomData, PortalEmitterConfig } from "./types";
import type { ParticleEmitterConfig } from "../../../../../logic/interfaces/visuals/particle-emitters-config";
import { createCachedEmitterConfigGetter } from "@shared/helpers/emitter-cache.helper";

/**
 * Sanitizes portal emitter config
 */
const sanitizePortalEmitterConfig = (
  source: PortalCustomData["emitter"]
): PortalEmitterConfig | null => {
  const base = sanitizeParticleEmitterConfig(source ?? {}, {
    defaultColor: { r: 0.4, g: 0.8, b: 1, a: 0.9 },
    defaultOffset: { x: 0, y: 0 },
    minCapacity: 32,
    defaultShape: "circle",
  });
  if (!base) {
    return { ...DEFAULT_PORTAL_EMITTER };
  }
  return {
    ...base,
    baseSpeed: Math.max(0, source?.baseSpeed ?? DEFAULT_PORTAL_EMITTER.baseSpeed),
    speedVariation: Math.max(
      0,
      source?.speedVariation ?? DEFAULT_PORTAL_EMITTER.speedVariation
    ),
  };
};

/**
 * Gets the emitter config for a portal instance (with caching)
 */
export const getEmitterConfig = createCachedEmitterConfigGetter<
  PortalCustomData["emitter"],
  PortalEmitterConfig
>(
  (instance) => {
    const custom = instance.data.customData as PortalCustomData | undefined;
    return custom?.emitter;
  },
  (source) => sanitizePortalEmitterConfig(source)
);

/**
 * Gets the emitter origin position (with rotation applied)
 */
export const getEmitterOrigin = (
  instance: SceneObjectInstance,
  config: PortalEmitterConfig
): SceneVector2 => {
  const offset = config.offset ?? { x: 0, y: 0 };
  return transformObjectPoint(
    getInstanceRenderPosition(instance),
    instance.data.rotation,
    offset
  );
};

/**
 * Creates a particle state for portal emitter
 */
export const spawnPortalParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: PortalEmitterConfig
): ParticleEmitterParticleState => {
  // Emit uniformly in all directions
  const direction = Math.random() * Math.PI * 2;
  const speed = Math.max(
    0,
    config.baseSpeed +
      (config.speedVariation > 0 ? (Math.random() * 2 - 1) * config.speedVariation : 0)
  );
  const size =
    config.sizeRange.min === config.sizeRange.max
      ? config.sizeRange.min
      : config.sizeRange.min + Math.random() * (config.sizeRange.max - config.sizeRange.min);
  return {
    position: { x: origin.x, y: origin.y },
    velocity: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
    ageMs: 0,
    lifetimeMs: config.particleLifetimeMs,
    size,
  };
};

/**
 * Gets GPU spawn config for portal emitter.
 */
export const getGpuSpawnConfig = (
  _instance: SceneObjectInstance,
  config: PortalEmitterConfig
): GpuSpawnConfig => ({
  baseSpeed: config.baseSpeed,
  speedVariation: config.speedVariation,
  sizeMin: config.sizeRange.min,
  sizeMax: config.sizeRange.max,
  spawnRadiusMin: 0,
  spawnRadiusMax: 0,
  arc: Math.PI * 2,
  direction: 0,
  spread: 0,
  radialVelocity: false,
});
