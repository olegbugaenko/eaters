import type {
  SceneColor,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ParticleEmitterConfig } from "@/logic/interfaces/visuals/particle-emitters-config";
import type { StatusEffectId } from "@/db/status-effects-db";
import type { StatusEffectApplicationOptions } from "../status-effects/status-effects.types";
import type { DamageApplicationOptions } from "../targeting/DamageService";

export interface EnemyStreamVisualRuntimeConfig {
  readonly color: SceneColor;
  readonly coreColor: SceneColor;
  readonly edgeColor: SceneColor;
  readonly widthStart: number;
  readonly widthEnd: number;
  readonly innerWidthMultiplier: number;
  readonly raggedness: number;
  readonly waveAmplitude: number;
  readonly waveFrequency: number;
  readonly pulseSpeed: number;
  readonly pulseIntensity: number;
  readonly segments: number;
  readonly sparks?: ParticleEmitterConfig;
}

export interface EnemyStreamRenderData {
  readonly autoAnimate: true;
  readonly seed: number;
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly range: number;
  readonly angleDeg: number;
  readonly visual: EnemyStreamVisualRuntimeConfig;
  readonly flameEmitters?: readonly ParticleEmitterConfig[];
}

export interface EnemyStreamInstance {
  readonly id: string;
  readonly sourceEnemyId: string;
  readonly sceneObjectId: string;
  readonly durationMs: number;
  readonly tickIntervalMs: number;
  readonly damage: number;
  readonly range: number;
  readonly angleDeg: number;
  readonly visual: EnemyStreamVisualRuntimeConfig;
  readonly statusEffectId?: StatusEffectId;
  readonly statusEffectOptions?: StatusEffectApplicationOptions;
  readonly damageOptions?: DamageApplicationOptions;
  readonly spawnOffset?: SceneVector2;
  position: SceneVector2;
  direction: SceneVector2;
  rotation: number;
  elapsedMs: number;
  damageAccumulatorMs: number;
  justSpawned: boolean;
  targetId: string | null;
}
