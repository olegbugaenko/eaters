import type { ExplosionConfig, ExplosionType } from "./explosions.types";
import { createSimpleWave } from "./explosions.helpers";
import { UNIT_DEATH_WAVE_GRADIENT_STOPS } from "./explosions.colors.const";
import { DEFAULT_EMITTER } from "./explosions.emitters.const";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";

export const PLAYER_UNIT_EXPLOSIONS: Partial<Record<ExplosionType, ExplosionConfig>> = {
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
