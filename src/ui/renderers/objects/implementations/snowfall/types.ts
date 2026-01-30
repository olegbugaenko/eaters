import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ParticleEmitterConfig } from "@logic/interfaces/visuals/particle-emitters-config";
import type { ParticleEmitterBaseConfig } from "../../../primitives/ParticleEmitterPrimitive";

export interface SnowfallRect {
  min: SceneVector2;
  max: SceneVector2;
}

export interface SnowfallCustomData {
  emitter?: ParticleEmitterConfig;
  spawnRect?: SnowfallRect;
  cullRect?: SnowfallRect;
}

export type SnowfallEmitterConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  speedVariation: number;
  spread: number;
  direction: number;
};
