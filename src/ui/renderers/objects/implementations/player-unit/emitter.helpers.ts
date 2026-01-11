import type { SceneObjectInstance, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ParticleEmitterParticleState, GpuSpawnConfig } from "../../../primitives/ParticleEmitterPrimitive";
import { sanitizeParticleEmitterConfig } from "../../../primitives/ParticleEmitterPrimitive";
import { transformObjectPoint } from "../../ObjectRenderer";
import { randomBetween } from "@shared/helpers/numbers.helper";
import type { PlayerUnitCustomData, PlayerUnitEmitterRenderConfig } from "./types";
import { DEFAULT_EMITTER_COLOR } from "./constants";
import type { ParticleEmitterConfig } from "../../../../../logic/interfaces/visuals/particle-emitters-config";

// Cache emitter configs to avoid creating new objects every frame
const emitterConfigCache = new WeakMap<
  SceneObjectInstance,
  { source: ParticleEmitterConfig | undefined; config: PlayerUnitEmitterRenderConfig | null }
>();

/**
 * Gets emitter config for player unit (with caching)
 * Note: Uses custom caching logic due to additional processing (physicalSize, sizeGrowthRate)
 */
export const getEmitterConfig = (
  instance: SceneObjectInstance
): PlayerUnitEmitterRenderConfig | null => {
  const payload = instance.data.customData as PlayerUnitCustomData | undefined;
  const emitterSource = payload?.emitter;

  // Return cached config if source hasn't changed
  const cached = emitterConfigCache.get(instance);
  if (cached && cached.source === emitterSource) {
    return cached.config;
  }

  if (!payload || typeof payload !== "object" || !emitterSource) {
    emitterConfigCache.set(instance, { source: undefined, config: null });
    return null;
  }

  const base = sanitizeParticleEmitterConfig(emitterSource, {
    defaultColor: DEFAULT_EMITTER_COLOR,
    defaultOffset: { x: 0, y: 0 },
    minCapacity: 4,
  });
  if (!base) {
    emitterConfigCache.set(instance, { source: emitterSource, config: null });
    return null;
  }

  const baseSpeed = Math.max(
    0,
    Number.isFinite(emitterSource.baseSpeed) ? Number(emitterSource.baseSpeed) : 0
  );
  const speedVariation = Math.max(
    0,
    Number.isFinite(emitterSource.speedVariation) ? Number(emitterSource.speedVariation) : 0
  );
  const spread = Math.max(
    0,
    Number.isFinite(emitterSource.spread) ? Number(emitterSource.spread) : 0
  );
  const physicalSize =
    typeof payload.physicalSize === "number" && Number.isFinite(payload.physicalSize)
      ? Math.max(payload.physicalSize, 0)
      : 0;

  // Convert sizeEvolutionMult (multiplier at end of lifetime) to sizeGrowthRate (multiplier per second)
  let sizeGrowthRate = base.sizeGrowthRate ?? 1.0;
  const sizeEvolutionMult = (emitterSource as { sizeEvolutionMult?: number }).sizeEvolutionMult;
  if (
    typeof sizeEvolutionMult === "number" &&
    Number.isFinite(sizeEvolutionMult) &&
    sizeEvolutionMult > 0
  ) {
    const lifetimeSeconds = base.particleLifetimeMs / 1000;
    if (lifetimeSeconds > 0 && sizeEvolutionMult !== 1) {
      sizeGrowthRate = Math.pow(sizeEvolutionMult, 1 / lifetimeSeconds);
    }
  }

  const config: PlayerUnitEmitterRenderConfig = {
    ...base,
    baseSpeed,
    speedVariation,
    spread,
    physicalSize,
    sizeGrowthRate,
  };

  emitterConfigCache.set(instance, { source: emitterSource, config });
  return config;
};

/**
 * Serializes emitter config for caching
 */
export const serializeEmitterConfig = (config: PlayerUnitEmitterRenderConfig): string => {
  const serializedFill = config.fill ? JSON.stringify(config.fill) : "";
  return [
    config.particlesPerSecond,
    config.particleLifetimeMs,
    config.fadeStartMs,
    config.sizeRange.min,
    config.sizeRange.max,
    config.offset.x,
    config.offset.y,
    config.color.r,
    config.color.g,
    config.color.b,
    typeof config.color.a === "number" ? config.color.a : 1,
    config.emissionDurationMs ?? -1,
    config.capacity,
    config.baseSpeed,
    config.speedVariation,
    config.spread,
    config.physicalSize,
    serializedFill,
    config.shape,
  ].join(":");
};

/**
 * Gets emitter origin position
 */
export const getEmitterOrigin = (
  instance: SceneObjectInstance,
  config: PlayerUnitEmitterRenderConfig
): SceneVector2 => {
  const scale = Math.max(config.physicalSize, 1);
  const offset = {
    x: config.offset.x * scale - 7,
    y: config.offset.y * scale,
  };
  return transformObjectPoint(instance.data.position, instance.data.rotation, offset);
};

/**
 * Gets GPU spawn config for player unit emitter.
 * Enables GPU-based particle spawning (no CPU slot tracking needed!)
 */
export const getGpuSpawnConfig = (
  instance: SceneObjectInstance,
  config: PlayerUnitEmitterRenderConfig
): GpuSpawnConfig => ({
  baseSpeed: config.baseSpeed,
  speedVariation: config.speedVariation,
  sizeMin: config.sizeRange.min,
  sizeMax: config.sizeRange.max,
  spawnRadiusMin: 0,
  spawnRadiusMax: 0,
  arc: 0, // Not used - spread handles direction variation
  direction: (instance.data.rotation ?? 0) + Math.PI, // Emit backwards from unit
  spread: config.spread,
  radialVelocity: false,
});

/**
 * Creates a particle state for player unit emitter
 */
export const createEmitterParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: PlayerUnitEmitterRenderConfig
): ParticleEmitterParticleState => {
  const baseDirection = (instance.data.rotation ?? 0) + Math.PI;
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

  return {
    position: { x: origin.x, y: origin.y },
    velocity: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
    ageMs: 0,
    lifetimeMs: config.particleLifetimeMs,
    size,
  };
};
