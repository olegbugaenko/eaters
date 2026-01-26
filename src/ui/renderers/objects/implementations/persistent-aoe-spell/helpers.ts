import type {
  SceneObjectInstance,
  SceneVector2,
  SceneColor,
  SceneFill,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { ParticleEmitterParticleState } from "../../../primitives/ParticleEmitterPrimitive";
import { sanitizeParticleEmitterConfig } from "../../../primitives/ParticleEmitterPrimitive";
import { clamp01, lerp, clampNumber, randomBetween } from "@shared/helpers/numbers.helper";
import { sanitizeSceneColor, cloneColorWithAlpha } from "@shared/helpers/scene-color.helper";
import type {
  PersistentAoeObjectCustomData,
  PersistentAoeParticleCustomData,
  FireRingEmitterConfig,
} from "./types";
import { DEFAULT_CUSTOM_DATA, MIN_RADIUS } from "./constants";

/**
 * Gets and sanitizes custom data from instance
 */
export const getCustomData = (
  instance: SceneObjectInstance
): PersistentAoeObjectCustomData => {
  const data = instance.data.customData as PersistentAoeObjectCustomData | undefined;
  if (!data || typeof data !== "object") {
    return DEFAULT_CUSTOM_DATA;
  }
  const glowAlphaRaw =
    typeof data.glowAlpha === "number" && Number.isFinite(data.glowAlpha)
      ? Number(data.glowAlpha)
      : DEFAULT_CUSTOM_DATA.glowAlpha;
  const durationMs =
    typeof data.durationMs === "number" && Number.isFinite(data.durationMs)
      ? Math.max(0, Number(data.durationMs))
      : DEFAULT_CUSTOM_DATA.durationMs;
  const fireColor = sanitizeSceneColor(data.fireColor, DEFAULT_CUSTOM_DATA.fireColor);

  return {
    shape: data.shape === "ring" ? "ring" : DEFAULT_CUSTOM_DATA.shape,
    explosion: data.explosion ?? null,
    innerRadius: Number.isFinite(data.innerRadius)
      ? Math.max(0, Number(data.innerRadius))
      : 0,
    outerRadius: Number.isFinite(data.outerRadius)
      ? Math.max(0, Number(data.outerRadius))
      : 0,
    thickness: Number.isFinite(data.thickness) ? Math.max(0, Number(data.thickness)) : 1,
    intensity: clamp01(Number(data.intensity)),
    glowColor: sanitizeSceneColor(data.glowColor, DEFAULT_CUSTOM_DATA.glowColor),
    glowAlpha: clamp01(glowAlphaRaw),
    particle: sanitizeParticleCustomData(data.particle),
    fireColor,
    durationMs,
  };
};

/**
 * Sanitizes particle custom data
 */
export const sanitizeParticleCustomData = (
  data: PersistentAoeParticleCustomData | null | undefined
): PersistentAoeParticleCustomData | null => {
  if (!data || typeof data !== "object") {
    return null;
  }
  const baseRate = Number.isFinite(data.baseParticlesPerSecond)
    ? Math.max(0, Number(data.baseParticlesPerSecond))
    : 0;
  const lifetime = Number.isFinite(data.particleLifetimeMs)
    ? Math.max(0, Number(data.particleLifetimeMs))
    : 0;
  const fadeStart = Number.isFinite(data.fadeStartMs)
    ? clampNumber(Number(data.fadeStartMs), 0, lifetime)
    : 0;
  const fadeIn = Number.isFinite(data.fadeInMs)
    ? clampNumber(Number(data.fadeInMs), 0, lifetime)
    : 0;
  const sizeMin = Number.isFinite(data.sizeRange?.min)
    ? Math.max(0, Number(data.sizeRange.min))
    : 0;
  const sizeMax = Number.isFinite(data.sizeRange?.max)
    ? Math.max(sizeMin, Number(data.sizeRange.max))
    : sizeMin;
  if (baseRate <= 0 || lifetime <= 0) {
    return null;
  }
  const radialMinRaw = data.radialSpeed?.min;
  const radialMaxCandidate = data.radialSpeed?.max;
  const radialMin = Number.isFinite(radialMinRaw) ? Math.max(0, Number(radialMinRaw)) : 0;
  const radialMax = Number.isFinite(radialMaxCandidate)
    ? Math.max(radialMin, Math.max(0, Number(radialMaxCandidate)))
    : radialMin;
  const tangentialMinCandidate = data.tangentialSpeed?.min;
  const tangentialMaxCandidate = data.tangentialSpeed?.max;
  const tangentialMinRaw = Number.isFinite(tangentialMinCandidate)
    ? Number(tangentialMinCandidate)
    : -radialMax;
  const tangentialMaxRaw = Number.isFinite(tangentialMaxCandidate)
    ? Number(tangentialMaxCandidate)
    : radialMax;
  const tangentialMin = Math.min(tangentialMinRaw, tangentialMaxRaw);
  const tangentialMax = Math.max(tangentialMinRaw, tangentialMaxRaw);
  return {
    baseParticlesPerSecond: baseRate,
    particleLifetimeMs: lifetime,
    fadeStartMs: fadeStart,
    fadeInMs: fadeIn,
    sizeRange: { min: sizeMin, max: sizeMax },
    color: sanitizeSceneColor(data.color, DEFAULT_CUSTOM_DATA.glowColor),
    fill: data.fill,
    maxParticles:
      typeof data.maxParticles === "number" && data.maxParticles > 0
        ? Math.floor(data.maxParticles)
        : undefined,
    radialSpeed: {
      min: radialMin,
      max: radialMax,
    },
    tangentialSpeed: {
      min: tangentialMin,
      max: tangentialMax,
    },
    spawnJitter: {
      radial: Number.isFinite(data.spawnJitter?.radial)
        ? Math.max(0, Number(data.spawnJitter?.radial))
        : 0,
      angular: Number.isFinite(data.spawnJitter?.angular)
        ? clampNumber(Number(data.spawnJitter?.angular), 0, Math.PI)
        : 0,
    },
  };
};

/**
 * Creates glow fill for persistent AOE spell
 */
export const createGlowFill = (instance: SceneObjectInstance): SceneFill => {
  const data = getCustomData(instance);
  const outerRadius = Math.max(data.outerRadius, MIN_RADIUS);
  const innerRadius = clampNumber(data.innerRadius, 0, outerRadius);
  const ringWidth = Math.max(outerRadius - innerRadius, 1);
  const intensity = clamp01(data.intensity * data.glowAlpha);
  const color = sanitizeSceneColor(data.glowColor, DEFAULT_CUSTOM_DATA.glowColor);

  const innerStop = clamp01(innerRadius / outerRadius);
  const peakStop = clamp01((innerRadius + ringWidth * 0.45) / outerRadius);
  const fadeStop = clamp01((innerRadius + ringWidth) / outerRadius);

  return {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    end: outerRadius,
    stops: [
      { offset: 0, color: cloneColorWithAlpha(color, 0) },
      { offset: innerStop * 0.95, color: cloneColorWithAlpha(color, 0) },
      { offset: peakStop, color: cloneColorWithAlpha(color, clamp01(intensity)) },
      { offset: fadeStop, color: cloneColorWithAlpha(color, clamp01(intensity * 0.35)) },
      { offset: 1, color: cloneColorWithAlpha(color, 0) },
    ],
  };
};

/**
 * Gets emitter config for fire ring particles
 */
export const getEmitterConfig = (
  instance: SceneObjectInstance
): FireRingEmitterConfig | null => {
  const data = getCustomData(instance);
  const particle = data.particle;
  if (!particle) {
    return null;
  }
  const intensity = clamp01(data.intensity);
  const rate = particle.baseParticlesPerSecond * intensity;
  if (rate <= 0) {
    return null;
  }
  const flameFill: SceneFill = {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    end: 1.0,
    stops: [
      { offset: 0.0, color: { r: 3.0, g: 2.8, b: 2.2, a: 1.0 } }, // очень яркий центр (HDR-like)
      { offset: 0.25, color: { r: 2.5, g: 2.0, b: 0.8, a: 1.0 } }, // яркий желтый
      { offset: 0.5, color: { r: 1.8, g: 0.9, b: 0.3, a: 0.9 } }, // оранжевый
      { offset: 0.75, color: { r: 1.2, g: 0.4, b: 0.1, a: 0.6 } }, // красный
      { offset: 1.0, color: { r: 0.4, g: 0.05, b: 0.0, a: 0.0 } }, // темно-красный fade
    ],
  };

  const sanitized = sanitizeParticleEmitterConfig(
    {
      particlesPerSecond: rate,
      particleLifetimeMs: particle.particleLifetimeMs,
      fadeStartMs: particle.fadeStartMs,
      fadeInMs: particle.fadeInMs,
      sizeRange: particle.sizeRange,
      color: particle.color,
      fill: flameFill,
      shape: "circle",
      maxParticles: particle.maxParticles,
      aspectRatio: 2.2,
      alignToVelocity: true,
    },
    { defaultColor: particle.color, defaultShape: "circle", minCapacity: 32 }
  );
  if (!sanitized) {
    return null;
  }
  return {
    ...sanitized,
    meta: {
      radialSpeed: {
        min: Math.max(0, particle.radialSpeed.min),
        max: Math.max(Math.max(0, particle.radialSpeed.min), particle.radialSpeed.max),
      },
      tangentialSpeed: {
        min: Math.min(particle.tangentialSpeed.min, particle.tangentialSpeed.max),
        max: Math.max(particle.tangentialSpeed.min, particle.tangentialSpeed.max),
      },
      spawnJitter: {
        radial: Math.max(0, particle.spawnJitter.radial),
        angular: clampNumber(particle.spawnJitter.angular, 0, Math.PI),
      },
      intensity,
    },
  };
};

/**
 * Spawns a particle for fire ring emitter
 */
export const spawnParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: FireRingEmitterConfig
): ParticleEmitterParticleState => {
  const data = getCustomData(instance);
  const meta = config.meta;
  const outerRadius = Math.max(data.outerRadius, MIN_RADIUS);
  const innerRadius = clampNumber(data.innerRadius, 0, outerRadius);
  const jitter = meta.spawnJitter;

  const angle = Math.random() * Math.PI * 2 + (Math.random() - 0.5) * 2 * jitter.angular;
  const radiusMin = Math.max(0, innerRadius - jitter.radial);
  const radiusMax = Math.max(radiusMin, outerRadius + jitter.radial);
  const radius = randomBetween(radiusMin, radiusMax);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const position = {
    x: origin.x + cos * radius,
    y: origin.y + sin * radius,
  };

  const radialSpeedPerSecond = randomBetween(meta.radialSpeed.min, meta.radialSpeed.max);
  const tangentialSpeedPerSecond = randomBetween(
    meta.tangentialSpeed.min,
    meta.tangentialSpeed.max
  );
  const radialSpeed = radialSpeedPerSecond / 1000;
  const tangentialSpeed = tangentialSpeedPerSecond / 1000;
  const tangent = { x: -sin, y: cos };
  const velocity = {
    x: cos * radialSpeed + tangent.x * tangentialSpeed,
    y: sin * radialSpeed + tangent.y * tangentialSpeed,
  };

  const lifetimeMs = config.particleLifetimeMs;
  const sizeBase = randomBetween(config.sizeRange.min, config.sizeRange.max);
  const intensity = clamp01(meta.intensity * 1.1);
  const size = Math.max(1, sizeBase * lerp(0.6, 1.15, intensity));

  return {
    position,
    velocity,
    ageMs: 0,
    lifetimeMs,
    size,
  };
};
