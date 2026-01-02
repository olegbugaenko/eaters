import { createRadialGradientFill } from "../../../helpers/scene-fill.helper";
import { cloneParticleEmitterConfig } from "../../../helpers/particle-emitter.helper";
import type { ParticleEmitterConfig } from "../../../interfaces/visuals/particle-emitters-config";
import type { BulletConfig, BulletTailConfig, BulletType } from "../../../../db/bullets-db";
import type { BulletCustomData } from "./bullet.types";

/**
 * Creates a radial gradient fill for a bullet based on its configuration.
 */
export const createBulletFill = (radius: number, config: BulletConfig) =>
  createRadialGradientFill(radius, config.gradientStops, {
    noise: config.noise,
    filaments: config.filaments,
  });

/**
 * Creates custom data for a bullet including tail configuration and emitter.
 */
export const createBulletCustomData = (
  type: BulletType,
  tail: BulletTailConfig,
  tailEmitter: ParticleEmitterConfig | undefined
): BulletCustomData => ({
  type,
  tail: {
    lengthMultiplier: tail.lengthMultiplier,
    widthMultiplier: tail.widthMultiplier,
    startColor: { ...tail.startColor },
    endColor: { ...tail.endColor },
  },
  tailEmitter: tailEmitter ? cloneParticleEmitterConfig(tailEmitter) : undefined,
});
