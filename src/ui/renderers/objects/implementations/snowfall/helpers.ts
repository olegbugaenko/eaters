import type { SceneObjectInstance, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { sanitizeParticleEmitterConfig } from "../../../primitives/ParticleEmitterPrimitive";
import type {
  GpuSpawnConfig,
  ParticleEmitterParticleState,
} from "../../../primitives/ParticleEmitterPrimitive";
import { createCachedEmitterConfigGetter } from "@shared/helpers/emitter-cache.helper";
import type { SnowfallCustomData, SnowfallEmitterConfig } from "./types";

const sanitizeSnowfallEmitterConfig = (
  source: SnowfallCustomData["emitter"]
): SnowfallEmitterConfig | null => {
  if (!source) {
    return null;
  }
  const base = sanitizeParticleEmitterConfig(source, {
    defaultColor: { r: 0.9, g: 0.95, b: 1, a: 0.8 },
    defaultOffset: { x: 0, y: 0 },
    minCapacity: 64,
    defaultShape: "circle",
  });
  if (!base) {
    return null;
  }
  return {
    ...base,
    baseSpeed: Math.max(0, source.baseSpeed ?? 0.02),
    speedVariation: Math.max(0, source.speedVariation ?? 0.01),
    spread: Math.max(0, source.spread ?? 0.2),
    direction: Number.isFinite(source.direction) ? Number(source.direction) : Math.PI / 2,
    alignToVelocity: source.alignToVelocity === true,
    alignToVelocityFlip: source.alignToVelocityFlip === true,
    sizeGrowthRate: source.sizeGrowthRate,
  };
};

export const getEmitterConfig = createCachedEmitterConfigGetter<
  SnowfallCustomData["emitter"],
  SnowfallEmitterConfig
>(
  (instance) => {
    const custom = instance.data.customData as SnowfallCustomData | undefined;
    return custom?.emitter;
  },
  (source) => sanitizeSnowfallEmitterConfig(source)
);

export const getEmitterOrigin = (): SceneVector2 => ({ x: 0, y: 0 });

export const spawnSnowfallParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: SnowfallEmitterConfig
): ParticleEmitterParticleState => {
  const custom = instance.data.customData as SnowfallCustomData | undefined;
  const spawnRect = custom?.spawnRect;
  const position = spawnRect
    ? {
        x: spawnRect.min.x + Math.random() * (spawnRect.max.x - spawnRect.min.x),
        y: spawnRect.min.y + Math.random() * (spawnRect.max.y - spawnRect.min.y),
      }
    : { x: origin.x, y: origin.y };

  const spread = Math.max(0, config.spread);
  const angle =
    spread > 0
      ? config.direction + (Math.random() * 2 - 1) * (spread * 0.5)
      : config.direction;
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
    position,
    velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    ageMs: 0,
    lifetimeMs: config.particleLifetimeMs,
    size,
  };
};

export const updateSnowfallParticle = (
  particle: ParticleEmitterParticleState,
  deltaMs: number,
  instance: SceneObjectInstance,
  _config: SnowfallEmitterConfig
): boolean => {
  particle.ageMs += deltaMs;
  if (particle.ageMs >= particle.lifetimeMs) {
    return false;
  }
  particle.position.x += particle.velocity.x * deltaMs;
  particle.position.y += particle.velocity.y * deltaMs;

  const custom = instance.data.customData as SnowfallCustomData | undefined;
  const cullRect = custom?.cullRect;
  if (!cullRect) {
    return true;
  }

  return !(
    particle.position.x < cullRect.min.x ||
    particle.position.y < cullRect.min.y ||
    particle.position.x > cullRect.max.x ||
    particle.position.y > cullRect.max.y
  );
};

export const getGpuSpawnConfig = (
  instance: SceneObjectInstance,
  config: SnowfallEmitterConfig
): GpuSpawnConfig => {
  const custom = instance.data.customData as SnowfallCustomData | undefined;
  return {
    baseSpeed: config.baseSpeed,
    speedVariation: config.speedVariation,
    sizeMin: config.sizeRange.min,
    sizeMax: config.sizeRange.max,
    spawnRadiusMin: 0,
    spawnRadiusMax: 0,
    arc: 0,
    direction: config.direction,
    spread: config.spread,
    radialVelocity: false,
    spawnShape: "rect",
    spawnRectMin: custom?.spawnRect?.min,
    spawnRectMax: custom?.spawnRect?.max,
    cullRectMin: custom?.cullRect?.min,
    cullRectMax: custom?.cullRect?.max,
  };
};
