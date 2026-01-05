import type { ParticleEmitterBaseConfig } from "../../../primitives/ParticleEmitterPrimitive";

export interface PortalCustomData {
  emitter?: Partial<ParticleEmitterBaseConfig> & {
    baseSpeed?: number;
    speedVariation?: number;
  };
  radius?: number;
}

export type PortalEmitterConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  speedVariation: number;
};
