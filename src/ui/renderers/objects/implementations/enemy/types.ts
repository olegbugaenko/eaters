import type { ParticleEmitterBaseConfig } from "../../../primitives/ParticleEmitterPrimitive";
import type { EnemyRendererConfig, OctopusTentacleConfig } from "@db/enemies-db";
import type { ParticleEmitterConfig } from "@logic/interfaces/visuals/particle-emitters-config";

export interface EnemyCustomData {
  renderer?: EnemyRendererConfig;
  emitter?: ParticleEmitterConfig;
  physicalSize?: number;
  type: string;
  level: number;
  tentacles?: OctopusTentacleConfig;
  aliveSegments?: number[];
}

export interface EnemyEmitterRenderConfig extends ParticleEmitterBaseConfig {
  baseSpeed: number;
  speedVariation: number;
  spread: number;
  physicalSize: number;
}

export type { EnemyRendererConfig };
