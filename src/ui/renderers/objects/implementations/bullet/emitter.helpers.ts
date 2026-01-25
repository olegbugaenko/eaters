import type { SceneObjectInstance, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type {
  GpuSpawnConfig,
  ParticleEmitterParticleState,
} from "../../../primitives/ParticleEmitterPrimitive";
import { sanitizeParticleEmitterConfig } from "../../../primitives/ParticleEmitterPrimitive";
import { getInstanceRenderPosition, transformObjectPoint } from "../../ObjectRenderer";
import { randomBetween } from "@shared/helpers/numbers.helper";
import type {
  BulletRendererCustomData,
  BulletTailEmitterRenderConfig,
  BulletEmitterKey,
} from "./types";
import type { ParticleEmitterConfig } from "../../../../../logic/interfaces/visuals/particle-emitters-config";
import { getBulletRadius, getMovementRotation } from "./helpers";

// Caches for emitter configs
const tailEmitterConfigCache = new WeakMap<
  SceneObjectInstance,
  {
    source: BulletRendererCustomData["tailEmitter"] | undefined;
    config: BulletTailEmitterRenderConfig | null;
  }
>();
const trailEmitterConfigCache = new WeakMap<
  SceneObjectInstance,
  {
    source: BulletRendererCustomData["trailEmitter"] | undefined;
    config: BulletTailEmitterRenderConfig | null;
  }
>();
const smokeEmitterConfigCache = new WeakMap<
  SceneObjectInstance,
  {
    source: BulletRendererCustomData["smokeEmitter"] | undefined;
    config: BulletTailEmitterRenderConfig | null;
  }
>();

/**
 * Gets emitter config for a specific emitter key (with caching)
 */
const getEmitterConfig = (
  instance: SceneObjectInstance,
  key: BulletEmitterKey,
  cache:
    | typeof tailEmitterConfigCache
    | typeof trailEmitterConfigCache
    | typeof smokeEmitterConfigCache
): BulletTailEmitterRenderConfig | null => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  const emitter = data && typeof data === "object" ? data[key] : undefined;
  const cached = cache.get(instance);
  if (cached && cached.source === emitter) {
    return cached.config;
  }

  const config = emitter ? sanitizeTailEmitterConfig(emitter) : null;
  cache.set(instance, { source: emitter, config });

  return config;
};

/**
 * Gets tail emitter config
 */
export const getTailEmitterConfig = (
  instance: SceneObjectInstance
): BulletTailEmitterRenderConfig | null =>
  getEmitterConfig(instance, "tailEmitter", tailEmitterConfigCache);

/**
 * Gets trail emitter config
 */
export const getTrailEmitterConfig = (
  instance: SceneObjectInstance
): BulletTailEmitterRenderConfig | null =>
  getEmitterConfig(instance, "trailEmitter", trailEmitterConfigCache);

/**
 * Gets smoke emitter config
 */
export const getSmokeEmitterConfig = (
  instance: SceneObjectInstance
): BulletTailEmitterRenderConfig | null =>
  getEmitterConfig(instance, "smokeEmitter", smokeEmitterConfigCache);

/**
 * Sanitizes tail emitter config
 */
export const sanitizeTailEmitterConfig = (
  config: ParticleEmitterConfig
): BulletTailEmitterRenderConfig | null => {
  const base = sanitizeParticleEmitterConfig(config, {
    defaultOffset: { x: -1, y: 0 },
    defaultColor: { r: 1, g: 1, b: 1, a: 1 },
  });
  if (!base) {
    return null;
  }

  const baseSpeed = Math.max(
    0,
    Number.isFinite(config.baseSpeed) ? Number(config.baseSpeed) : 0
  );
  const speedVariation = Math.max(
    0,
    Number.isFinite(config.speedVariation) ? Number(config.speedVariation) : 0
  );
  const spread = Math.max(0, Number.isFinite(config.spread) ? Number(config.spread) : 0);
  const spawnRadiusMin = Math.max(0, config.spawnRadius?.min ?? 0);
  const spawnRadiusMax = Math.max(spawnRadiusMin, config.spawnRadius?.max ?? spawnRadiusMin);

  // Convert sizeEvolutionMult (multiplier at end of lifetime) to sizeGrowthRate (multiplier per second)
  // Formula: sizeGrowthRate = sizeEvolutionMult ^ (1 / lifetimeSeconds)
  let sizeGrowthRate = base.sizeGrowthRate ?? 1.0;
  if (
    typeof config.sizeEvolutionMult === "number" &&
    Number.isFinite(config.sizeEvolutionMult) &&
    config.sizeEvolutionMult > 0
  ) {
    const lifetimeSeconds = base.particleLifetimeMs / 1000;
    if (lifetimeSeconds > 0 && config.sizeEvolutionMult !== 1) {
      sizeGrowthRate = Math.pow(config.sizeEvolutionMult, 1 / lifetimeSeconds);
    }
  }

  return {
    ...base,
    baseSpeed,
    speedVariation,
    spread,
    spawnRadiusMin,
    spawnRadiusMax,
    sizeGrowthRate,
  };
};

/**
 * Serializes tail emitter config for caching
 */
export const serializeTailEmitterConfig = (config: BulletTailEmitterRenderConfig): string => {
  const serializedFill = config.fill ? JSON.stringify(config.fill) : "";
  return [
    config.particlesPerSecond,
    config.particleLifetimeMs,
    config.fadeStartMs,
    config.emissionDampingInterval ?? 0,
    config.baseSpeed,
    config.speedVariation,
    config.sizeRange.min,
    config.sizeRange.max,
    config.spawnRadiusMin,
    config.spawnRadiusMax,
    config.spread,
    config.offset.x,
    config.offset.y,
    config.color.r,
    config.color.g,
    config.color.b,
    config.color.a,
    config.capacity,
    serializedFill,
    config.shape,
  ].join(":");
};

/**
 * Gets tail emitter origin position
 */
export const getTailEmitterOrigin = (
  instance: SceneObjectInstance,
  config: BulletTailEmitterRenderConfig
): SceneVector2 => {
  const radius = getBulletRadius(instance);
  const offset = {
    x: config.offset.x * radius,
    y: config.offset.y * radius,
  };
  return transformObjectPoint(
    getInstanceRenderPosition(instance),
    getMovementRotation(instance),
    offset
  );
};

/**
 * Creates a tail particle state
 */
export const createTailParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: BulletTailEmitterRenderConfig
): ParticleEmitterParticleState => {
  const baseDirection = getMovementRotation(instance) + Math.PI;
  const halfSpread = config.spread / 2;
  const direction =
    baseDirection + (config.spread > 0 ? randomBetween(-halfSpread, halfSpread) : 0);
  const speed = Math.max(
    0,
    config.baseSpeed +
      (config.speedVariation > 0
        ? randomBetween(-config.speedVariation, config.speedVariation)
        : 0)
  );
  const size =
    config.sizeRange.min === config.sizeRange.max
      ? config.sizeRange.min
      : randomBetween(config.sizeRange.min, config.sizeRange.max);
  const spawnRadius =
    config.spawnRadiusMin === config.spawnRadiusMax
      ? config.spawnRadiusMin
      : randomBetween(config.spawnRadiusMin, config.spawnRadiusMax);
  const spawnAngle = Math.random() * Math.PI * 2;

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

/**
 * Gets GPU spawn config for bullet tail emitters.
 * Ensures GPU spawn model matches CPU spawn (direction + spread + speed).
 */
export const getGpuSpawnConfig = (
  instance: SceneObjectInstance,
  config: BulletTailEmitterRenderConfig
): GpuSpawnConfig => ({
  baseSpeed: config.baseSpeed,
  speedVariation: config.speedVariation,
  sizeMin: config.sizeRange.min,
  sizeMax: config.sizeRange.max,
  spawnRadiusMin: config.spawnRadiusMin,
  spawnRadiusMax: config.spawnRadiusMax,
  arc: 0,
  direction: getMovementRotation(instance) + Math.PI,
  spread: config.spread,
  radialVelocity: false,
});
