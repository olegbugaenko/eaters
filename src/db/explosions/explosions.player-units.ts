import type { ExplosionConfig, ExplosionType } from "./explosions.types";
import { createSimpleWave } from "./explosions.helpers";
import {
  UNIT_DEATH_WAVE_GRADIENT_STOPS,
  SOUL_COLLECT_WAVE_GRADIENT_STOPS,
} from "./explosions.colors.const";
import { DEFAULT_EMITTER } from "./explosions.emitters.const";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";

const NO_EMITTER: ExplosionConfig["emitter"] = {
  ...DEFAULT_EMITTER,
  emissionDurationMs: 0,
  particlesPerSecond: 0,
  baseSpeed: 0,
  speedVariation: 0,
  particleLifetimeMs: 0,
  fadeStartMs: 0,
  sizeRange: { min: 0, max: 0 },
  spawnRadius: { min: 0, max: 0 },
  spawnRadiusMultiplier: 1,
  arc: 0,
  direction: 0,
};

export const PLAYER_UNIT_EXPLOSIONS: Partial<Record<ExplosionType, ExplosionConfig>> = {
  soulCollect: {
    lifetimeMs: 900,
    defaultInitialRadius: 10,
    waves: createSimpleWave({
      defaultInitialRadius: 10,
      radiusExtension: 60,
      startAlpha: 0.8,
      endAlpha: 0,
      gradientStops: SOUL_COLLECT_WAVE_GRADIENT_STOPS,
    }),
    starburst: {
      enabled: true,
      color: { r: 0.833, g: 0.449, b: 0.949, a: 0.9 },
      spikeCount: 8,
      spikeLength: { min: 20, max: 26 },
      spikeWidth: { min: 3.2, max: 4.2 },
      angleJitterDeg: 28,
      lengthJitter: 0.5,
      widthJitter: 0.35,
      lifetimeMs: 880,
      fadeStartMs: 240,
      growSizeMult: 3.8,
      edgeSoftness: 0.5,
      rotationDegPerSec: 70,
    },
    emitter: NO_EMITTER,
  },
  unitDeath: {
    lifetimeMs: 1_200,
    defaultInitialRadius: 10,
    waves: createSimpleWave({
      defaultInitialRadius: 10,
      radiusExtension: 80,
      startAlpha: 0.7,
      endAlpha: 0,
      gradientStops: UNIT_DEATH_WAVE_GRADIENT_STOPS,
    }),
    emitter: {
      ...DEFAULT_EMITTER,
      emissionDurationMs: 260,
      particlesPerSecond: 900,
      baseSpeed: 0.05,
      speedVariation: 0.02,
      particleLifetimeMs: 900,
      fadeStartMs: 320,
      spawnRadius: { min: 0, max: 2 },
      spawnRadiusMultiplier: undefined,
      radialVelocity: true,
      sizeRange: { min: 3, max: 9 },
      shape: "triangle",
      sizeEvolutionMult: 1.75,
      sizeGrowthRate: 2.35,
      alignToVelocity: true,
      alignToVelocityFlip: true,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.5, g: 0.9, b: 0.95, a: 0.5 },
      }
    },
  },
};
