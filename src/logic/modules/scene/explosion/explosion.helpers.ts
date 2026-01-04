import type {
  SceneColor,
  SceneFillFilaments,
  SceneFillNoise,
  SceneGradientStop,
  SceneRadialGradientFill,
} from "../../../services/scene-object-manager/scene-object-manager.types";
import { ExplosionConfig } from "../../../../db/explosions-db";
import type { ParticleEmitterConfig } from "../../../interfaces/visuals/particle-emitters-config";
import {
  cloneSceneFill,
  createRadialGradientFill,
} from "@shared/helpers/scene-fill.helper";
import {
  cloneSceneColor,
  ensureColorAlpha,
  cloneColorWithAlpha,
} from "@shared/helpers/scene-color.helper";
import { sanitizeAngle, sanitizeArc } from "../../../../shared/helpers/angle.helper";
import { clamp01, clampNumber } from "@shared/helpers/numbers.helper";
import type { WaveState } from "./explosion.types";

export const createReusableWaveFill = (
  gradientStops: readonly SceneGradientStop[],
  innerRadius: number,
  outerRadius: number,
  alpha: number,
  noise?: SceneFillNoise,
  filaments?: SceneFillFilaments
): {
  fill: SceneRadialGradientFill;
  stops: SceneGradientStop[];
  baseColor: SceneColor;
} => {
  const radius = Math.max(outerRadius, 0.0001);
  const normalizedInnerRadius = clamp01(innerRadius / radius);
  const baseColor = gradientStops[0]?.color ?? { r: 1, g: 1, b: 1, a: 0 };
  const sourceStops =
    gradientStops.length > 0
      ? gradientStops.map((stop) => ({
          offset: stop.offset,
          color: cloneSceneColor(stop.color ?? baseColor),
        }))
      : [
          {
            offset: normalizedInnerRadius,
            color: cloneColorWithAlpha(baseColor, 0),
          },
        ];

  const stops = sourceStops.map((stop) => ({
    offset: normalizedInnerRadius + clamp01(stop.offset) * (1 - normalizedInnerRadius),
    color: {
      ...stop.color,
      a: clamp01(ensureColorAlpha(stop.color) * alpha),
    },
  }));

  if (normalizedInnerRadius > 0 && stops[0]) {
    stops[0].color.a = 0;
  }

  const fill = createRadialGradientFill(radius, stops, {
    noise,
    filaments,
  });

  return { fill, stops, baseColor };
};

export const updateWaveFill = (
  wave: WaveState,
  innerRadius: number,
  outerRadius: number,
  alpha: number
): void => {
  const radius = Math.max(outerRadius, 0.0001);
  const normalizedInnerRadius = clamp01(innerRadius / radius);
  wave.fill.end = radius;

  const sourceStops =
    wave.gradientStops.length > 0
      ? wave.gradientStops
      : [
          {
            offset: normalizedInnerRadius,
            color: wave.baseColor,
          },
        ];
  const referenceStop =
    sourceStops[Math.max(0, Math.min(sourceStops.length - 1, wave.mutableStops.length - 1))] ??
    sourceStops[0];

  for (let i = 0; i < wave.mutableStops.length; i += 1) {
    const source = i < sourceStops.length ? sourceStops[i]! : referenceStop!;
    const target = wave.mutableStops[i]!;
    target.offset =
      normalizedInnerRadius + clamp01(source.offset) * (1 - normalizedInnerRadius);
    const color = source.color ?? wave.baseColor;
    target.color.r = color.r;
    target.color.g = color.g;
    target.color.b = color.b;
    target.color.a = clamp01(ensureColorAlpha(color) * alpha);
  }

  if (normalizedInnerRadius > 0 && wave.mutableStops[0]) {
    wave.mutableStops[0].color.a = 0;
  }
};

export const createEmitterCustomData = (
  config: ExplosionConfig,
  initialRadius: number
): ParticleEmitterConfig | undefined => {
  const particlesPerSecond = Math.max(0, config.emitter.particlesPerSecond);
  const particleLifetimeMs = Math.max(0, config.emitter.particleLifetimeMs);
  const emissionDurationMs = Math.max(0, config.emitter.emissionDurationMs ?? 0);

  if (particlesPerSecond <= 0 || particleLifetimeMs <= 0) {
    return undefined;
  }

  if (!config.emitter.spawnRadius) {
    return undefined;
  }

  const fadeStartMs = clampNumber(config.emitter.fadeStartMs, 0, particleLifetimeMs);
  const sizeMin = Math.max(0, config.emitter.sizeRange.min);
  const sizeMax = Math.max(sizeMin, config.emitter.sizeRange.max);
  const spawnRadiusMin = Math.max(0, config.emitter.spawnRadius.min);
  const spawnRadiusMax = Math.max(
    spawnRadiusMin,
    config.emitter.spawnRadius.max,
    initialRadius * (config.emitter.spawnRadiusMultiplier ?? 1)
  );

  const maxParticles = computeEmitterMaxParticles(
    particlesPerSecond,
    emissionDurationMs,
    particleLifetimeMs
  );

  return {
    particlesPerSecond,
    particleLifetimeMs,
    fadeStartMs,
    emissionDurationMs,
    sizeRange: { min: sizeMin, max: sizeMax },
    spawnRadius: { min: spawnRadiusMin, max: spawnRadiusMax },
    baseSpeed: Math.max(0, config.emitter.baseSpeed ?? 0),
    speedVariation: Math.max(0, config.emitter.speedVariation ?? 0),
    color: cloneSceneColor(config.emitter.color),
    fill: config.emitter.fill ? cloneSceneFill(config.emitter.fill) : undefined,
    arc: sanitizeArc(config.emitter.arc),
    direction: sanitizeAngle(config.emitter.direction),
    offset: { x: 0, y: 0 },
    maxParticles,
    shape: config.emitter.shape,
    sizeGrowthRate: config.emitter.sizeGrowthRate,
  };
};

export const computeEffectLifetime = (
  config: ExplosionConfig,
  emitter: ParticleEmitterConfig | undefined
): number => {
  const waveLifetime = Math.max(1, config.lifetimeMs);
  if (!emitter) {
    return waveLifetime;
  }
  const emitterLifetime = (emitter.emissionDurationMs ?? 0) + emitter.particleLifetimeMs;
  return Math.max(waveLifetime, emitterLifetime);
};

export const computeEmitterMaxParticles = (
  particlesPerSecond: number,
  emissionDurationMs: number,
  particleLifetimeMs: number
): number | undefined => {
  if (particlesPerSecond <= 0 || particleLifetimeMs <= 0) {
    return undefined;
  }
  const emissionWindowMs = Math.max(
    0,
    Math.min(emissionDurationMs, particleLifetimeMs)
  );
  if (emissionWindowMs <= 0) {
    return 1;
  }
  const base = (particlesPerSecond * emissionWindowMs) / 1000;
  const slack = particlesPerSecond / 60;
  return Math.max(1, Math.ceil(base + slack));
};
