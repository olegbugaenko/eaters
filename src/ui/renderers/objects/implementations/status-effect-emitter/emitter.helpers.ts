import type { SceneObjectInstance, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type {
  GpuSpawnConfig,
  ParticleEmitterParticleState,
} from "../../../primitives/ParticleEmitterPrimitive";
import { sanitizeParticleEmitterConfig } from "../../../primitives/ParticleEmitterPrimitive";
import type { ParticleEmitterConfig } from "@/logic/interfaces/visuals/particle-emitters-config";
import { getInstanceRenderPosition } from "../../ObjectRenderer";
import { randomBetween } from "@shared/helpers/numbers.helper";
import type { StatusEffectEmitterCustomData, StatusEffectEmitterRenderConfig } from "./types";

const emitterConfigCache = new WeakMap<
  SceneObjectInstance,
  { source: ParticleEmitterConfig | undefined; config: StatusEffectEmitterRenderConfig | null }
>();

export const getStatusEffectEmitterConfig = (
  instance: SceneObjectInstance
): StatusEffectEmitterRenderConfig | null => {
  const custom = instance.data.customData as StatusEffectEmitterCustomData | undefined;
  const emitter = custom?.emitter;
  const cached = emitterConfigCache.get(instance);
  if (cached && cached.source === emitter) {
    return cached.config;
  }

  const config = emitter ? sanitizeStatusEffectEmitterConfig(emitter) : null;
  emitterConfigCache.set(instance, { source: emitter, config });
  return config;
};

export const sanitizeStatusEffectEmitterConfig = (
  config: ParticleEmitterConfig
): StatusEffectEmitterRenderConfig | null => {
  const base = sanitizeParticleEmitterConfig(config, {
    defaultOffset: { x: 0, y: 0 },
    defaultColor: { r: 0.9, g: 0.1, b: 0.1, a: 1 },
  });
  if (!base) {
    return null;
  }

  const baseSpeed = Math.max(0, Number(config.baseSpeed) || 0);
  const speedVariation = Math.max(0, Number(config.speedVariation) || 0);
  const spread = Math.max(0, Number(config.spread) || 0);
  const spawnRadiusMin = Math.max(0, config.spawnRadius?.min ?? 0);
  const spawnRadiusMax = Math.max(spawnRadiusMin, config.spawnRadius?.max ?? spawnRadiusMin);
  const direction = Number.isFinite(config.direction) ? Number(config.direction) : 0;

  return {
    ...base,
    baseSpeed,
    speedVariation,
    spread,
    spawnRadiusMin,
    spawnRadiusMax,
    direction,
  };
};

export const serializeEmitterConfig = (config: StatusEffectEmitterRenderConfig): string => {
  const serializedFill = config.fill ? JSON.stringify(config.fill) : "";
  return [
    config.particlesPerSecond,
    config.particleLifetimeMs,
    config.fadeStartMs,
    config.fadeInMs,
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
    config.direction,
  ].join(":");
};

export const getEmitterOrigin = (
  instance: SceneObjectInstance,
  config: StatusEffectEmitterRenderConfig
): SceneVector2 => {
  const position = getInstanceRenderPosition(instance);
  return {
    x: position.x + config.offset.x,
    y: position.y + config.offset.y,
  };
};

export const createEmitterParticle = (
  origin: SceneVector2,
  _instance: SceneObjectInstance,
  config: StatusEffectEmitterRenderConfig
): ParticleEmitterParticleState => {
  const halfSpread = config.spread / 2;
  const direction =
    config.direction + (config.spread > 0 ? randomBetween(-halfSpread, halfSpread) : 0);
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

export const getGpuSpawnConfig = (
  _instance: SceneObjectInstance,
  config: StatusEffectEmitterRenderConfig
): GpuSpawnConfig => ({
  baseSpeed: config.baseSpeed,
  speedVariation: config.speedVariation,
  sizeMin: config.sizeRange.min,
  sizeMax: config.sizeRange.max,
  spawnRadiusMin: config.spawnRadiusMin,
  spawnRadiusMax: config.spawnRadiusMax,
  arc: 0,
  direction: config.direction,
  spread: config.spread,
  radialVelocity: false,
});
