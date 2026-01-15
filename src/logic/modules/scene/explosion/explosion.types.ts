import type {
  SceneColor,
  SceneFillFilaments,
  SceneFillNoise,
  SceneGradientStop,
  SceneRadialGradientFill,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { ExplosionType } from "../../../../db/explosions-db";
import type { ParticleEmitterConfig } from "../../../interfaces/visuals/particle-emitters-config";
import type { SoundEffectPlayer } from "../../../../core/logic/provided/modules/audio/audio.types";

export interface ExplosionModuleOptions {
  scene: SceneObjectManager;
  audio?: SoundEffectPlayer;
}

export interface WaveState {
  id: string;
  startInnerRadius: number;
  endInnerRadius: number;
  startOuterRadius: number;
  endOuterRadius: number;
  startAlpha: number;
  endAlpha: number;
  gradientStops: readonly SceneGradientStop[];
  noise?: SceneFillNoise;
  filaments?: SceneFillFilaments;
  fill: SceneRadialGradientFill;
  mutableStops: SceneGradientStop[];
  baseColor: SceneColor;
}

export interface ExplosionState {
  type: ExplosionType;
  position: SceneVector2;
  elapsedMs: number;
  waveLifetimeMs: number;
  effectLifetimeMs: number;
  waves: WaveState[];
  createdAt: number;
}

export interface SpawnExplosionOptions {
  position: SceneVector2;
  initialRadius: number;
}

export interface SpawnExplosionByTypeOptions {
  position: SceneVector2;
  initialRadius?: number;
}

export interface ExplosionRendererCustomData {
  waveLifetimeMs?: number;
  emitter?: ParticleEmitterConfig;
  startAlpha?: number;
  endAlpha?: number;
}
