import type { SceneObjectInstance, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type {
  GpuSpawnConfig,
  ParticleEmitterParticleState,
} from "../../../primitives/ParticleEmitterPrimitive";
import { sanitizeParticleEmitterConfig } from "../../../primitives/ParticleEmitterPrimitive";
import { getInstanceRenderPosition, transformObjectPoint } from "../../ObjectRenderer";
import { randomBetween } from "@shared/helpers/numbers.helper";
import type { ParticleEmitterConfig } from "@logic/interfaces/visuals/particle-emitters-config";
import type { EnemyCustomData, EnemyEmitterRenderConfig } from "./types";
import { DEFAULT_EMITTER_COLOR } from "../player-unit/constants";

const emitterConfigCache = new WeakMap<
  SceneObjectInstance,
  { source: ParticleEmitterConfig | undefined; config: EnemyEmitterRenderConfig | null }
>();

export const getEmitterConfig = (
  instance: SceneObjectInstance
): EnemyEmitterRenderConfig | null => {
  const payload = instance.data.customData as EnemyCustomData | undefined;
  const emitterSource = payload?.emitter;

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
  const spread = Math.max(0, Number.isFinite(emitterSource.spread) ? Number(emitterSource.spread) : 0);
  const physicalSize =
    typeof payload.physicalSize === "number" && Number.isFinite(payload.physicalSize)
      ? Math.max(payload.physicalSize, 0)
      : 0;

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

  const config: EnemyEmitterRenderConfig = {
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

export const serializeEmitterConfig = (config: EnemyEmitterRenderConfig): string => {
  const serializedFill = config.fill ? JSON.stringify(config.fill) : "";
  return [
    config.particlesPerSecond,
    config.particleLifetimeMs,
    config.fadeStartMs,
    config.fadeInMs,
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

export const getEmitterOrigin = (
  instance: SceneObjectInstance,
  config: EnemyEmitterRenderConfig
): SceneVector2 => {
  const scale = Math.max(config.physicalSize, 1);
  const offset = {
    x: config.offset.x * scale,
    y: config.offset.y * scale,
  };
  return transformObjectPoint(
    getInstanceRenderPosition(instance),
    instance.data.rotation,
    offset
  );
};

export const getGpuSpawnConfig = (
  instance: SceneObjectInstance,
  config: EnemyEmitterRenderConfig
): GpuSpawnConfig => ({
  baseSpeed: config.baseSpeed,
  speedVariation: config.speedVariation,
  sizeMin: config.sizeRange.min,
  sizeMax: config.sizeRange.max,
  spawnRadiusMin: 0,
  spawnRadiusMax: 0,
  arc: 0,
  direction: (instance.data.rotation ?? 0) + Math.PI,
  spread: config.spread,
  radialVelocity: false,
});

export const createEmitterParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: EnemyEmitterRenderConfig
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
