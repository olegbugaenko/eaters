import type { ParticleEmitterConfig } from "../../../../../logic/interfaces/visuals/particle-emitters-config";
import type { SceneColor, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ParticleEmitterBaseConfig } from "../../../primitives/ParticleEmitterPrimitive";

export interface BulletTailRenderConfig {
  lengthMultiplier: number;
  widthMultiplier: number;
  startColor: SceneColor;
  endColor: SceneColor;
}

export interface BulletGlowConfig {
  color?: SceneColor;
  radiusMultiplier?: number;
}

export interface BulletRendererCustomData {
  tail?: Partial<BulletTailRenderConfig>;
  tailEmitter?: ParticleEmitterConfig;
  trailEmitter?: ParticleEmitterConfig;
  smokeEmitter?: ParticleEmitterConfig;
  glow?: BulletGlowConfig;
  speed?: number;
  maxSpeed?: number;
  velocity?: SceneVector2;
  movementRotation?: number;
  visualRotation?: number;
  bulletGpuKey?: string;
  shape?: "circle" | "sprite";
  renderComponents?: {
    body?: boolean;
    tail?: boolean;
    glow?: boolean;
    emitters?: boolean;
  };
}

export type BulletTailEmitterRenderConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  speedVariation: number;
  spread: number;
  spawnRadiusMin: number;
  spawnRadiusMax: number;
};

export type BulletEmitterKey = "tailEmitter" | "trailEmitter" | "smokeEmitter";
