import type {
  SceneColor,
  SceneFillFilaments,
  SceneFillNoise,
  SceneGradientStop,
  SceneObjectManager,
  SceneRadialGradientFill,
  SceneVector2,
} from "../../../services/SceneObjectManager";
import type { ExplosionRendererEmitterConfig, ExplosionType } from "../../../../db/explosions-db";

export interface ExplosionModuleOptions {
  scene: SceneObjectManager;
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
  emitter?: ExplosionRendererEmitterConfig;
}
