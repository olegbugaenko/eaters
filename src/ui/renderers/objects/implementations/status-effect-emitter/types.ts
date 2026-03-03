import type { ParticleEmitterBaseConfig } from "../../../primitives/ParticleEmitterPrimitive";
import type { ParticleEmitterConfig } from "@/logic/interfaces/visuals/particle-emitters-config";

export interface StatusEffectEmitterCustomData {
  readonly emitter: ParticleEmitterConfig;
}

export interface StatusEffectEmitterRenderConfig extends ParticleEmitterBaseConfig {
  readonly baseSpeed: number;
  readonly speedVariation: number;
  readonly spread: number;
  readonly spawnRadiusMin: number;
  readonly spawnRadiusMax: number;
  readonly direction: number;
}
