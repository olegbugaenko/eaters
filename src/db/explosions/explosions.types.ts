import type {
  SceneColor,
  SceneFillFilaments,
  SceneFillNoise,
  SceneGradientStop,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ParticleEmitterConfig } from "../../logic/interfaces/visuals/particle-emitters-config";

export type ExplosionType =
  | "plasmoid"
  | "smallPlasmoid"
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
  | "plasmaBeam"
  | "smallEnergetic"
  | "chainLightning"
  | "magicArrow"
  | "unitDeath";

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


export interface ExplosionStarburstConfig {
  enabled?: boolean;
  color: SceneColor;
  spikeCount: number;
  spikeLength: { min: number; max: number };
  spikeWidth: { min: number; max: number };
  angleJitterDeg?: number;
  lengthJitter?: number;
  widthJitter?: number;
  lifetimeMs: number;
  fadeStartMs?: number;
  growSizeMult?: number;
}

export interface ExplosionConfig {
  lifetimeMs: number;
  defaultInitialRadius: number;
  waves: readonly ExplosionWaveConfig[];
  emitter: ParticleEmitterConfig;
  starburst?: ExplosionStarburstConfig;
  soundEffectUrl?: string;
}
