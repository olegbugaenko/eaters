import type {
  ParticleEmitterBaseConfig,
  ParticleEmitterParticleState,
  ParticleEmitterPrimitiveOptions,
  ParticleEmitterSanitizerOptions,
} from "./ParticleEmitterPrimitive";
import {
  createParticleEmitterPrimitive,
  sanitizeParticleEmitterConfig,
} from "./ParticleEmitterPrimitive";

/**
 * @deprecated Use createParticleEmitterPrimitive directly.
 */
export const createParticleSystemPrimitive = createParticleEmitterPrimitive;

export type {
  ParticleEmitterBaseConfig as ParticleSystemBaseConfig,
  ParticleEmitterParticleState as ParticleSystemParticleState,
  ParticleEmitterPrimitiveOptions as ParticleSystemPrimitiveOptions,
  ParticleEmitterSanitizerOptions as ParticleSystemSanitizerOptions,
};

export { sanitizeParticleEmitterConfig as sanitizeParticleSystemConfig };
