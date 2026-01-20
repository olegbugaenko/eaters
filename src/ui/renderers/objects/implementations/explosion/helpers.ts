import type { ParticleEmitterConfig } from "../../../../../logic/interfaces/visuals/particle-emitters-config";
import type {
  SceneObjectInstance,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  normalizeAngle,
  sanitizeAngle,
  sanitizeArc,
} from "@shared/helpers/angle.helper";
import {
  ParticleEmitterBaseConfig,
  ParticleEmitterParticleState,
  sanitizeParticleEmitterConfig,
} from "../../../primitives/ParticleEmitterPrimitive";
import { getInstanceRenderPosition, transformObjectPoint } from "../../ObjectRenderer";
import { randomBetween } from "@shared/helpers/numbers.helper";
import { DEFAULT_COLOR } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { ExplosionEmitterRenderConfig, ExplosionEmitterConfigCache } from "./types";

/**
 * Sanitizes and converts ParticleEmitterConfig to ExplosionEmitterRenderConfig
 */
export const sanitizeExplosionEmitterConfig = (
  config: ParticleEmitterConfig
): ExplosionEmitterRenderConfig | null => {
  const base = sanitizeParticleEmitterConfig(
    {
      particlesPerSecond: config.particlesPerSecond,
      particleLifetimeMs: config.particleLifetimeMs,
      fadeStartMs: config.fadeStartMs,
      emissionDurationMs: config.emissionDurationMs,
      sizeRange: config.sizeRange,
      offset: config.offset,
      color: config.color,
      fill: config.fill,
      shape: config.shape,
      alignToVelocity: config.alignToVelocity,
      maxParticles: config.maxParticles,
    },
    { defaultColor: DEFAULT_COLOR, minCapacity: 1 }
  );

  if (!base) {
    return null;
  }

  if (!config.spawnRadius) {
    return null;
  }

  const spawnMin = Math.max(0, config.spawnRadius.min);
  const spawnMax = Math.max(spawnMin, config.spawnRadius.max);

  return {
    ...base,
    baseSpeed: Math.max(0, config.baseSpeed ?? 0),
    speedVariation: Math.max(0, config.speedVariation ?? 0),
    spawnRadius: { min: spawnMin, max: spawnMax },
    arc: sanitizeArc(config.arc),
    direction: sanitizeAngle(config.direction),
    radialVelocity: config.radialVelocity ?? false,
  };
};

/**
 * Serializes ExplosionEmitterRenderConfig to a string for caching
 */
export const serializeExplosionEmitterConfig = (
  config: ExplosionEmitterRenderConfig
): string => {
  const serializedFill = config.fill ? JSON.stringify(config.fill) : "";
  return [
    config.particlesPerSecond,
    config.particleLifetimeMs,
    config.fadeStartMs,
    config.emissionDurationMs ?? 0,
    config.sizeRange.min,
    config.sizeRange.max,
    config.offset.x,
    config.offset.y,
    config.color.r,
    config.color.g,
    config.color.b,
    config.color.a,
    config.capacity,
    config.baseSpeed,
    config.speedVariation,
    config.spawnRadius.min,
    config.spawnRadius.max,
    config.arc,
    config.direction,
    serializedFill,
    config.shape,
  ].join(":");
};

/**
 * Gets the emitter origin position (with offset and rotation applied)
 */
export const getEmitterOrigin = (
  instance: SceneObjectInstance,
  config: ExplosionEmitterRenderConfig
): SceneVector2 => {
  const offset = config.offset ?? { x: 0, y: 0 };
  return transformObjectPoint(
    getInstanceRenderPosition(instance),
    instance.data.rotation,
    offset
  );
};

/**
 * Creates a particle state for explosion emitter
 */
export const createExplosionParticle = (
  origin: SceneVector2,
  _instance: SceneObjectInstance,
  config: ExplosionEmitterRenderConfig
): ParticleEmitterParticleState => {
  const speed = Math.max(
    0,
    config.baseSpeed +
      (config.speedVariation > 0
        ? randomBetween(-config.speedVariation, config.speedVariation)
        : 0)
  );
  const spawnRadius = randomBetween(config.spawnRadius.min, config.spawnRadius.max);
  const spawnAngle = pickSpawnAngle(config, pickParticleDirection(config));
  
  const position = {
    x: origin.x + Math.cos(spawnAngle) * spawnRadius,
    y: origin.y + Math.sin(spawnAngle) * spawnRadius,
  };

  // If radialVelocity is enabled, calculate direction from origin to spawn position
  let velocityDirection: number;
  if (config.radialVelocity) {
    const dx = position.x - origin.x;
    const dy = position.y - origin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 1e-6) {
      velocityDirection = Math.atan2(dy, dx);
    } else {
      // Fallback if spawn position is at origin
      velocityDirection = pickParticleDirection(config);
    }
  } else {
    velocityDirection = pickParticleDirection(config);
  }

  const size =
    config.sizeRange.min === config.sizeRange.max
      ? config.sizeRange.min
      : randomBetween(config.sizeRange.min, config.sizeRange.max);

  return {
    position,
    velocity: { x: Math.cos(velocityDirection) * speed, y: Math.sin(velocityDirection) * speed },
    ageMs: 0,
    lifetimeMs: config.particleLifetimeMs,
    size,
  };
};

/**
 * Picks a random particle direction within the configured arc
 */
const pickParticleDirection = (config: ExplosionEmitterRenderConfig): number => {
  const arc = Math.max(0, config.arc);
  if (arc === 0) {
    return config.direction;
  }
  if (arc >= Math.PI * 2 - 1e-6) {
    return Math.random() * Math.PI * 2;
  }
  const halfArc = arc / 2;
  const offset = Math.random() * arc - halfArc;
  return normalizeAngle(config.direction + offset);
};

/**
 * Picks a random spawn angle within the configured arc
 */
const pickSpawnAngle = (
  config: ExplosionEmitterRenderConfig,
  direction: number
): number => {
  const arc = Math.max(0, config.arc);
  if (arc === 0) {
    return direction;
  }
  if (arc >= Math.PI * 2 - 1e-6) {
    return Math.random() * Math.PI * 2;
  }
  const halfArc = arc / 2;
  const offset = Math.random() * arc - halfArc;
  return normalizeAngle(config.direction + offset);
};
