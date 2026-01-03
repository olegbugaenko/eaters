import type { ExplosionRendererEmitterConfig } from "../../../../../db/explosions-db";
import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import type { ParticleEmitterBaseConfig } from "../../../primitives/ParticleEmitterPrimitive";

export interface ExplosionRendererCustomData {
  waveLifetimeMs?: number;
  emitter?: ExplosionRendererEmitterConfig;
}

export type ExplosionEmitterRenderConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  speedVariation: number;
  spawnRadius: { min: number; max: number };
  arc: number;
  direction: number;
};

export interface ExplosionEmitterConfigCache {
  source: ExplosionRendererEmitterConfig | undefined;
  config: ExplosionEmitterRenderConfig | null;
}
