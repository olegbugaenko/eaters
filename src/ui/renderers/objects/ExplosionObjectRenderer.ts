import type { ExplosionRendererEmitterConfig } from "../../../db/explosions-db";
import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
  transformObjectPoint,
} from "./ObjectRenderer";
import {
  SceneObjectInstance,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";
import {
  createDynamicCirclePrimitive,
  createParticleEmitterPrimitive,
} from "../primitives";
import {
  normalizeAngle,
  sanitizeAngle,
  sanitizeArc,
} from "../../../logic/services/particles/ParticleEmitterShared";
import {
  ParticleEmitterBaseConfig,
  ParticleEmitterParticleState,
  sanitizeParticleEmitterConfig,
} from "../primitives/ParticleEmitterPrimitive";

interface ExplosionRendererCustomData {
  emitter?: ExplosionRendererEmitterConfig;
}

type ExplosionEmitterRenderConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  speedVariation: number;
  spawnRadius: { min: number; max: number };
  arc: number;
  direction: number;
};

const DEFAULT_COLOR = { r: 1, g: 1, b: 1, a: 1 } as const;

const createExplosionEmitterPrimitive = (
  instance: SceneObjectInstance
): DynamicPrimitive | null =>
  createParticleEmitterPrimitive<ExplosionEmitterRenderConfig>(instance, {
    getConfig: getEmitterConfig,
    getOrigin: getEmitterOrigin,
    spawnParticle: createExplosionParticle,
    serializeConfig: serializeExplosionEmitterConfig,
  });

const getEmitterConfig = (
  instance: SceneObjectInstance
): ExplosionEmitterRenderConfig | null => {
  const data = instance.data.customData as ExplosionRendererCustomData | undefined;
  if (!data || typeof data !== "object" || !data.emitter) {
    return null;
  }
  return sanitizeExplosionEmitterConfig(data.emitter);
};

const sanitizeExplosionEmitterConfig = (
  config: ExplosionRendererEmitterConfig
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
      maxParticles: config.maxParticles,
    },
    { defaultColor: DEFAULT_COLOR, minCapacity: 1 }
  );

  if (!base) {
    return null;
  }

  const spawnMin = Math.max(0, config.spawnRadius.min);
  const spawnMax = Math.max(spawnMin, config.spawnRadius.max);

  return {
    ...base,
    baseSpeed: Math.max(0, config.baseSpeed),
    speedVariation: Math.max(0, config.speedVariation),
    spawnRadius: { min: spawnMin, max: spawnMax },
    arc: sanitizeArc(config.arc),
    direction: sanitizeAngle(config.direction),
  };
};

const serializeExplosionEmitterConfig = (
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
  ].join(":");
};

const getEmitterOrigin = (
  instance: SceneObjectInstance,
  config: ExplosionEmitterRenderConfig
): SceneVector2 => {
  const offset = config.offset ?? { x: 0, y: 0 };
  return transformObjectPoint(instance.data.position, instance.data.rotation, offset);
};

const createExplosionParticle = (
  origin: SceneVector2,
  _instance: SceneObjectInstance,
  config: ExplosionEmitterRenderConfig
): ParticleEmitterParticleState => {
  const direction = pickParticleDirection(config);
  const speed = Math.max(
    0,
    config.baseSpeed +
      (config.speedVariation > 0
        ? randomBetween(-config.speedVariation, config.speedVariation)
        : 0)
  );
  const spawnRadius = randomBetween(config.spawnRadius.min, config.spawnRadius.max);
  const spawnAngle = pickSpawnAngle(config, direction);
  const size =
    config.sizeRange.min === config.sizeRange.max
      ? config.sizeRange.min
      : randomBetween(config.sizeRange.min, config.sizeRange.max);

  return {
    position: {
      x: origin.x + Math.cos(spawnAngle) * spawnRadius,
      y: origin.y + Math.sin(spawnAngle) * spawnRadius,
    },
    velocity: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
    ageMs: 0,
    lifetimeMs: config.particleLifetimeMs,
    size,
  };
};

const pickParticleDirection = (
  config: ExplosionEmitterRenderConfig
): number => {
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

const randomBetween = (min: number, max: number): number => {
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
};

export class ExplosionObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const dynamicPrimitives: DynamicPrimitive[] = [];
    const emitterPrimitive = createExplosionEmitterPrimitive(instance);
    if (emitterPrimitive) {
      dynamicPrimitives.push(emitterPrimitive);
    }
    dynamicPrimitives.push(createDynamicCirclePrimitive(instance));

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
