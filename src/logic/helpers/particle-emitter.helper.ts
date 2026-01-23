import { cloneSceneFill } from "@shared/helpers/scene-fill.helper";
import { cloneSceneColor } from "@shared/helpers/scene-color.helper";
import type { ParticleEmitterConfig } from "../interfaces/visuals/particle-emitters-config";

/**
 * Clones a particle emitter configuration.
 * Deep clones nested objects (sizeRange, offset, color, fill, etc.)
 */
export const cloneParticleEmitterConfig = (
  config: ParticleEmitterConfig
): ParticleEmitterConfig => {
  const cloned: ParticleEmitterConfig = {
    particlesPerSecond: config.particlesPerSecond,
    particleLifetimeMs: config.particleLifetimeMs,
    fadeStartMs: config.fadeStartMs,
    sizeRange: { min: config.sizeRange.min, max: config.sizeRange.max },
    color: cloneSceneColor(config.color),
  };

  // Optional fields
  if (typeof config.emissionDurationMs === "number") {
    cloned.emissionDurationMs = config.emissionDurationMs;
  }
  if (typeof config.emissionDampingInterval === "number") {
    cloned.emissionDampingInterval = config.emissionDampingInterval;
  }
  if (typeof config.baseSpeed === "number") {
    cloned.baseSpeed = config.baseSpeed;
  }
  if (typeof config.speedVariation === "number") {
    cloned.speedVariation = config.speedVariation;
  }
  if (config.radialSpeed) {
    cloned.radialSpeed = { min: config.radialSpeed.min, max: config.radialSpeed.max };
  }
  if (config.tangentialSpeed) {
    cloned.tangentialSpeed = { min: config.tangentialSpeed.min, max: config.tangentialSpeed.max };
  }
  if (typeof config.sizeEvolutionMult === "number") {
    cloned.sizeEvolutionMult = config.sizeEvolutionMult;
  }
  if (typeof config.sizeGrowthRate === "number") {
    cloned.sizeGrowthRate = config.sizeGrowthRate;
  }
  if (typeof config.spread === "number") {
    cloned.spread = config.spread;
  }
  if (typeof config.arc === "number") {
    cloned.arc = config.arc;
  }
  if (typeof config.direction === "number") {
    cloned.direction = config.direction;
  }
  if (config.offset) {
    cloned.offset = { x: config.offset.x, y: config.offset.y };
  }
  if (config.spawnRadius) {
    cloned.spawnRadius = { min: config.spawnRadius.min, max: config.spawnRadius.max };
  }
  if (typeof config.spawnRadiusMultiplier === "number") {
    cloned.spawnRadiusMultiplier = config.spawnRadiusMultiplier;
  }
  if (config.spawnJitter) {
    cloned.spawnJitter = {
      radial: config.spawnJitter.radial,
      angular: config.spawnJitter.angular,
    };
  }
  if (config.fill) {
    cloned.fill = cloneSceneFill(config.fill);
  }
  if (config.shape) {
    cloned.shape = config.shape;
  }
  if (typeof config.maxParticles === "number") {
    cloned.maxParticles = config.maxParticles;
  }

  return cloned;
};
