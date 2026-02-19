import type { ParticleEmitterConfig } from "../../../../../logic/interfaces/visuals/particle-emitters-config";
import type { ParticleEmitterBaseConfig } from "../../../primitives/ParticleEmitterPrimitive";
import type { ExplosionStarburstRendererConfig } from "../../../../../logic/modules/scene/explosion/explosion.types";

export interface ExplosionRendererCustomData {
  waveLifetimeMs?: number;
  emitter?: ParticleEmitterConfig;
  startAlpha?: number;
  endAlpha?: number;
  starburst?: ExplosionStarburstRendererConfig;
}

export type ExplosionEmitterRenderConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  speedVariation: number;
  spawnRadius: { min: number; max: number };
  arc: number;
  direction: number;
  radialVelocity?: boolean;
};

export interface ExplosionEmitterConfigCache {
  source: ParticleEmitterConfig | undefined;
  config: ExplosionEmitterRenderConfig | null;
}
