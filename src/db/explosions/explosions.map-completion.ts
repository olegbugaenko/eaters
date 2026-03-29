import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { ExplosionConfig } from "./explosions.types";

const MAP_VICTORY_EMITTER_FILL = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 0.5, g: 1.0, b: 0.9, a: 1.0 } },
    { offset: 0.45, color: { r: 0.3, g: 0.9, b: 0.8, a: 0.55 } },
    { offset: 1, color: { r: 0.1, g: 0.7, b: 0.6, a: 0.05 } },
  ],
} as const;

const MAP_DEFEAT_EMITTER_FILL = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: 1.0, g: 0.55, b: 0.3, a: 1.0 } },
    { offset: 0.45, color: { r: 0.95, g: 0.45, b: 0.1, a: 0.6 } },
    { offset: 1, color: { r: 0.7, g: 0.48, b: 0.04, a: 0.05 } },
  ],
} as const;

export const MAP_COMPLETION_EXPLOSIONS: Partial<Record<"mapVictoryWave" | "mapDefeatWave", ExplosionConfig>> = {
  mapVictoryWave: {
    lifetimeMs: 2200,
    defaultInitialRadius: 45,
    allowInSimulationPause: true,
    waves: [
      {
        initialInnerRadius: 0,
        expansionInnerRadius: 20,
        initialOuterRadius: 45,
        expansionOuterRadius: 180,
        startAlpha: 0.75,
        endAlpha: 0.0,
        gradientStops: [
          { offset: 0, color: { r: 0.5, g: 0.95, b: 0.85, a: 0.0 } },
          { offset: 0.2, color: { r: 0.6, g: 1.0, b: 0.9, a: 0.6 } },
          { offset: 0.65, color: { r: 0.5, g: 0.9, b: 0.8, a: 0.95 } },
          { offset: 1, color: { r: 0.1, g: 0.65, b: 0.6, a: 0.0 } },
        ],
      },
      {
        initialInnerRadius: 20,
        expansionInnerRadius: 50,
        initialOuterRadius: 60,
        expansionOuterRadius: 260,
        startAlpha: 0.4,
        endAlpha: 0.0,
        gradientStops: [
          { offset: 0, color: { r: 0.3, g: 0.9, b: 0.8, a: 0.0 } },
          { offset: 0.4, color: { r: 0.2, g: 0.8, b: 0.75, a: 0.35 } },
          { offset: 1, color: { r: 0.1, g: 0.6, b: 0.55, a: 0.0 } },
        ],
      },
    ],
    emitter: {
      emissionDurationMs: 3500,
      particlesPerSecond: 1800,
      baseSpeed: 0.4,
      speedVariation: 0.25,
      particleLifetimeMs: 2900,
      fadeStartMs: 500,
      sizeRange: { min: 2, max: 6 },
      spawnRadius: { min: 10, max: 40 },
      spawnRadiusMultiplier: 1.0,
      color: { r: 0.3, g: 1.0, b: 0.9, a: 1.0 },
      arc: Math.PI * 2,
      direction: 0,
      fill: MAP_VICTORY_EMITTER_FILL,
      maxParticles: 300,
    },
    starburst: {
      color: { r: 0.3, g: 1.0, b: 0.88 },
      spikeCount: 12,
      spikeLength: { min: 30, max: 70 },
      spikeWidth: { min: 3, max: 7 },
      angleJitterDeg: 12,
      lengthJitter: 0.35,
      widthJitter: 0.3,
      lifetimeMs: 1700,
      fadeStartMs: 350,
      growSizeMult: 32.2,
      edgeSoftness: 0.5,
      rotationDegPerSec: 540,
    },
  },

  mapDefeatWave: {
    lifetimeMs: 2100,
    defaultInitialRadius: 45,
    allowInSimulationPause: true,
    waves: [
      {
        initialInnerRadius: 0,
        expansionInnerRadius: 40,
        initialOuterRadius: 45,
        expansionOuterRadius: 160,
        startAlpha: 0.8,
        endAlpha: 0.0,
        gradientStops: [
          { offset: 0, color: { r: 0.8, g: 0.08, b: 0.06, a: 0.0 } },
          { offset: 0.3, color: { r: 0.95, g: 0.14, b: 0.08, a: 0.6 } },
          { offset: 0.65, color: { r: 1.0, g: 0.2, b: 0.12, a: 0.75 } },
          { offset: 1, color: { r: 0.7, g: 0.05, b: 0.04, a: 0.0 } },
        ],
      },
      {
        initialInnerRadius: 30,
        expansionInnerRadius: 55,
        initialOuterRadius: 60,
        expansionOuterRadius: 220,
        startAlpha: 0.45,
        endAlpha: 0.0,
        gradientStops: [
          { offset: 0, color: { r: 0.9, g: 0.1, b: 0.07, a: 0.0 } },
          { offset: 0.4, color: { r: 0.95, g: 0.15, b: 0.1, a: 0.38 } },
          { offset: 1, color: { r: 0.7, g: 0.05, b: 0.04, a: 0.0 } },
        ],
      },
    ],
    emitter: {
      emissionDurationMs: 2000,
      particlesPerSecond: 3000,
      baseSpeed: 0.64,
      speedVariation: 0.47,
      particleLifetimeMs: 1800,
      fadeStartMs: 500,
      sizeRange: { min: 2.5, max: 8 },
      spawnRadius: { min: 10, max: 40 },
      spawnRadiusMultiplier: 1.2,
      color: { r: 1.0, g: 0.58, b: 0.3, a: 1.0 },
      arc: Math.PI * 2,
      direction: 0,
      fill: MAP_DEFEAT_EMITTER_FILL,
      maxParticles: 1200,
    },
    starburst: {
      color: { r: 1.0, g: 0.22, b: 0.1 },
      spikeCount: 8,
      spikeLength: { min: 35, max: 80 },
      spikeWidth: { min: 4, max: 9 },
      angleJitterDeg: 15,
      lengthJitter: 0.4,
      widthJitter: 0.35,
      lifetimeMs: 700,
      fadeStartMs: 320,
      growSizeMult: 3.3,
      edgeSoftness: 0.45,
      rotationDegPerSec: 125,
    },
  },
};
