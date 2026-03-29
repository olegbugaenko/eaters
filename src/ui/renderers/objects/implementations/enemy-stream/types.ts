import type { ParticleEmitterBaseConfig } from "../../../primitives/ParticleEmitterPrimitive";
import type { EnemyStreamRenderData } from "@/logic/modules/active-map/enemies/stream-attack.types";

export interface EnemyStreamCustomData extends EnemyStreamRenderData {}

export type StreamEmitterRenderConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  speedVariation: number;
  spread: number;
  spawnRadiusMin: number;
  spawnRadiusMax: number;
};
