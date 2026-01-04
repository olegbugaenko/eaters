import {
  SceneFill,
} from "@logic/services/scene-object-manager/scene-object-manager.types";
import { cloneSceneColor } from "@shared/helpers/scene-color.helper";
import { cloneSceneFillDeep } from "@shared/helpers/scene-fill.helper";
import { getBrickConfig } from "@db/bricks-db";
import type { ParticleEmitterConfig } from "@logic/interfaces/visuals/particle-emitters-config";



/**
 * Creates a SceneFill from brick config
 */
export const createBrickFill = (config: ReturnType<typeof getBrickConfig>): SceneFill => {
  return cloneSceneFillDeep(config.fill);
};


// cloneSceneFillDeep is now imported from @shared/helpers/scene-fill.helper

/**
 * Clones a ParticleEmitterConfig
 */
export const cloneEmitterConfig = (
  emitter: ParticleEmitterConfig | undefined
): ParticleEmitterConfig | undefined => {
  if (!emitter) {
    return undefined;
  }

  return {
    particlesPerSecond: emitter.particlesPerSecond,
    particleLifetimeMs: emitter.particleLifetimeMs,
    fadeStartMs: emitter.fadeStartMs,
    baseSpeed: emitter.baseSpeed,
    speedVariation: emitter.speedVariation,
    sizeRange: { min: emitter.sizeRange.min, max: emitter.sizeRange.max },
    spread: emitter.spread,
    offset: emitter.offset ? { x: emitter.offset.x, y: emitter.offset.y } : { x: 0, y: 0 },
    color: cloneSceneColor(emitter.color),
    fill: emitter.fill ? cloneSceneFillDeep(emitter.fill) : undefined,
    shape: emitter.shape,
    maxParticles: emitter.maxParticles,
  };
};

// All cloning functions are now imported from @shared/helpers/renderer-clone.helper
