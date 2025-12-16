import { ObjectRenderer, ObjectRegistration } from "./ObjectRenderer";
import {
  SceneObjectInstance,
  SceneVector2,
  SceneColor,
  FILL_TYPES,
} from "../../../logic/services/SceneObjectManager";
import {
  createParticleEmitterPrimitive,
  createFireRingPrimitive,
} from "../primitives";
import {
  ParticleEmitterBaseConfig,
  ParticleEmitterParticleState,
  sanitizeParticleEmitterConfig,
} from "../primitives/ParticleEmitterPrimitive";
import type {
  PersistentAoeObjectCustomData,
  PersistentAoeParticleCustomData,
} from "@logic/modules/active-map/spells/PersistentAoeSpellBehavior";
import { DynamicPrimitive } from "./ObjectRenderer";
import {
  addFireRingInstance,
  updateFireRing,
  type FireRingInstance,
} from "../primitives/gpu/FireRingGpuRenderer";

interface FireRingEmitterConfig extends ParticleEmitterBaseConfig {
  meta: {
    radialSpeed: { min: number; max: number };
    tangentialSpeed: { min: number; max: number };
    spawnJitter: { radial: number; angular: number };
    intensity: number;
  };
}

const DEFAULT_CUSTOM_DATA: PersistentAoeObjectCustomData = {
  shape: "ring",
  explosion: null,
  innerRadius: 0,
  outerRadius: 0,
  thickness: 1,
  intensity: 0,
  glowColor: { r: 1, g: 0.45, b: 0.1, a: 0.8 },
  glowAlpha: 0.8,
  particle: null,
  fireColor: { r: 1, g: 0.58, b: 0.24, a: 1 },
  durationMs: 0,
};

const MIN_RADIUS = 1;

export class PersistentAoeSpellRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const initialData = getCustomData(instance);
    const dynamicPrimitives: DynamicPrimitive[] = [];

    // If explosion mode - no rendering here (explosions render via ExplosionRenderer)
    if (initialData.explosion) {
      return {
        staticPrimitives: [],
        dynamicPrimitives: [],
      };
    }

    // Fire mode: GPU fire ring shader
    const fireRingPrimitive = createFireRingPrimitive(instance, {
      getConfig: (target) => {
        const data = getCustomData(target);
        if (data.intensity <= 0) {
          return null;
        }
        return {
          innerRadius: data.innerRadius,
          outerRadius: data.outerRadius,
          thickness: data.thickness,
          intensity: data.intensity,
          lifetime: data.durationMs,
          color: {
            r: data.fireColor.r,
            g: data.fireColor.g,
            b: data.fireColor.b,
            a: data.fireColor.a,
          },
        };
      },
    });
    if (fireRingPrimitive) {
      dynamicPrimitives.push(fireRingPrimitive);
    }

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}

const getCustomData = (
  instance: SceneObjectInstance,
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
  const fireColor = sanitizeColor(data.fireColor, DEFAULT_CUSTOM_DATA.fireColor);
  
  return {
    shape: data.shape === "ring" ? "ring" : DEFAULT_CUSTOM_DATA.shape,
    explosion: data.explosion ?? null,
    innerRadius: Number.isFinite(data.innerRadius) ? Math.max(0, Number(data.innerRadius)) : 0,
    outerRadius: Number.isFinite(data.outerRadius) ? Math.max(0, Number(data.outerRadius)) : 0,
    thickness: Number.isFinite(data.thickness) ? Math.max(0, Number(data.thickness)) : 1,
    intensity: clamp01(Number(data.intensity)),
    glowColor: sanitizeColor(data.glowColor, DEFAULT_CUSTOM_DATA.glowColor),
    glowAlpha: clamp01(glowAlphaRaw),
    particle: sanitizeParticleCustomData(data.particle),
    fireColor,
    durationMs,
  };
};

const sanitizeParticleCustomData = (
  data: PersistentAoeParticleCustomData | null | undefined,
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
    sizeRange: { min: sizeMin, max: sizeMax },
    color: sanitizeColor(data.color, DEFAULT_CUSTOM_DATA.glowColor),
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

const createGlowFill = (instance: SceneObjectInstance) => {
  const data = getCustomData(instance);
  const outerRadius = Math.max(data.outerRadius, MIN_RADIUS);
  const innerRadius = clampNumber(data.innerRadius, 0, outerRadius);
  const ringWidth = Math.max(outerRadius - innerRadius, 1);
  const intensity = clamp01(data.intensity * data.glowAlpha);
  const color = sanitizeColor(data.glowColor, DEFAULT_CUSTOM_DATA.glowColor);

  const innerStop = clamp01(innerRadius / outerRadius);
  const peakStop = clamp01((innerRadius + ringWidth * 0.45) / outerRadius);
  const fadeStop = clamp01((innerRadius + ringWidth) / outerRadius);

  return {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    end: outerRadius,
    stops: [
      { offset: 0, color: { ...color, a: 0 } },
      { offset: innerStop * 0.95, color: { ...color, a: 0 } },
      { offset: peakStop, color: { ...color, a: clamp01(intensity) } },
      { offset: fadeStop, color: { ...color, a: clamp01(intensity * 0.35) } },
      { offset: 1, color: { ...color, a: 0 } },
    ],
  };
};

const getEmitterConfig = (
  instance: SceneObjectInstance,
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
  const flameFill = {
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
      sizeRange: particle.sizeRange,
      color: particle.color,
      fill: flameFill,
      shape: "circle",
      maxParticles: particle.maxParticles,
      aspectRatio: 2.2,
      alignToVelocity: true,
    },
    { defaultColor: particle.color, defaultShape: "circle", minCapacity: 32 },
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
    // GPU stretching/orientation handled via uniforms
  };
};

const spawnParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: FireRingEmitterConfig,
): ParticleEmitterParticleState => {
  const data = getCustomData(instance);
  const meta = config.meta;
  const outerRadius = Math.max(data.outerRadius, MIN_RADIUS);
  const innerRadius = clampNumber(data.innerRadius, 0, outerRadius);
  const jitter = meta.spawnJitter;

  const angle = Math.random() * Math.PI * 2 + (Math.random() - 0.5) * 2 * jitter.angular;
  const radiusMin = Math.max(0, innerRadius - jitter.radial);
  const radiusMax = Math.max(radiusMin, outerRadius + jitter.radial);
  const radius = randomRange(radiusMin, radiusMax);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const position = {
    x: origin.x + cos * radius,
    y: origin.y + sin * radius,
  };

  const radialSpeedPerSecond = randomRange(meta.radialSpeed.min, meta.radialSpeed.max);
  const tangentialSpeedPerSecond = randomRange(meta.tangentialSpeed.min, meta.tangentialSpeed.max);
  const radialSpeed = radialSpeedPerSecond / 1000;
  const tangentialSpeed = tangentialSpeedPerSecond / 1000;
  const tangent = { x: -sin, y: cos };
  const velocity = {
    x: cos * radialSpeed + tangent.x * tangentialSpeed,
    y: sin * radialSpeed + tangent.y * tangentialSpeed,
  };

  const lifetimeMs = config.particleLifetimeMs;
  const sizeBase = randomRange(config.sizeRange.min, config.sizeRange.max);
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

const sanitizeColor = (
  color: SceneColor | undefined,
  fallback: SceneColor = DEFAULT_CUSTOM_DATA.glowColor,
): SceneColor => ({
  r: clamp01(color?.r ?? fallback.r ?? DEFAULT_CUSTOM_DATA.glowColor.r),
  g: clamp01(color?.g ?? fallback.g ?? DEFAULT_CUSTOM_DATA.glowColor.g),
  b: clamp01(color?.b ?? fallback.b ?? DEFAULT_CUSTOM_DATA.glowColor.b),
  a: clamp01(
    typeof color?.a === "number"
      ? Number(color.a)
      : typeof fallback.a === "number"
      ? fallback.a
      : DEFAULT_CUSTOM_DATA.glowColor.a ?? 1,
  ),
});

const clampNumber = (value: number | undefined, min: number, max: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return min;
  }
  if (value <= min) {
    return min;
  }
  if (value >= max) {
    return max;
  }
  return value;
};

const clamp01 = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
};

const randomRange = (min: number, max: number): number => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return 0;
  }
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp01(t);
