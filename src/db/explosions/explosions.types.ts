import type {
  SceneFillFilaments,
  SceneFillNoise,
  SceneGradientStop,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ParticleEmitterConfig } from "../../logic/interfaces/visuals/particle-emitters-config";

export type ExplosionType =
  | "plasmoid"
  | "magnetic"
  | "healWave"
  | "fireball"
  | "grayBrickHit"
  | "grayBrickDestroy"
  | "grayBrickDestroyV2"
  | "yellowBrickHit"
  | "yellowBrickDestroy"
  | "organicBrickHit"
  | "organicBrickDestroy"
  | "ironBrickHit"
  | "ironBrickDestroy"
  | "woodBrickHit"
  | "woodBrickDestroy"
  | "copperBrickHit"
  | "copperBrickDestroy"
  | "silverBrickHit"
  | "silverBrickDestroy"
  | "coalBrickHit"
  | "coalBrickDestroy"
  | "iceBrickHit"
  | "iceBrickDestroy"
  | "magmaBrickHit"
  | "magmaBrickDestroy"
  | "criticalHit"
  | "weakenCurse"
  | "smallCannon"
  | "bigCannon"
  | "smallCannonGrey"
  | "smallLaser"
  | "smallEnergetic";

export interface ExplosionWaveConfig {
  initialInnerRadius: number;
  expansionInnerRadius: number;
  initialOuterRadius: number;
  expansionOuterRadius: number;
  startAlpha: number;
  endAlpha: number;
  gradientStops: readonly SceneGradientStop[];
  noise?: SceneFillNoise;
  filaments?: SceneFillFilaments;
}

export interface ExplosionConfig {
  lifetimeMs: number;
  defaultInitialRadius: number;
  waves: readonly ExplosionWaveConfig[];
  emitter: ParticleEmitterConfig;
  soundEffectUrl?: string;
}
