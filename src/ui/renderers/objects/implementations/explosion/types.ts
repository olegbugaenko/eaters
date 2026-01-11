import type { ParticleEmitterConfig } from "../../../../../logic/interfaces/visuals/particle-emitters-config";
import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ParticleEmitterBaseConfig } from "../../../primitives/ParticleEmitterPrimitive";

export interface ExplosionRendererCustomData {
  waveLifetimeMs?: number;
  emitter?: ParticleEmitterConfig;
  startAlpha?: number;
  endAlpha?: number;
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
