import type { SceneVector2, SceneColor, SceneFill } from "../../../../services/scene-object-manager/scene-object-manager.types";
import type { BrickEffectTint } from "../../bricks/bricks.types";
import type { ExplosionType } from "../../../../../db/explosions-db";

export interface PersistentAoeRingRuntimeConfig {
  startRadius: number;
  endRadius: number;
  thickness: number;
}

export interface PersistentAoeParticleRuntimeConfig {
  baseParticlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  sizeRange: { min: number; max: number };
  color: SceneColor;
  fill?: SceneFill;
  maxParticles?: number;
  radialSpeed: { min: number; max: number };
  tangentialSpeed: { min: number; max: number };
  spawnJitter: { radial: number; angular: number };
}

export interface PersistentAoeVisualRuntimeConfig {
  explosion: ExplosionType | null;
  glowColor: SceneColor;
  glowAlpha: number;
  particle: PersistentAoeParticleRuntimeConfig | null;
  fireColor: SceneColor;
}

export interface PersistentAoeState {
  id: string;
  spellId: string;
  center: SceneVector2;
  elapsedMs: number;
  createdAt: number; // For cleanup when tab becomes active
  durationMs: number;
  ring: PersistentAoeRingRuntimeConfig;
  baseDamagePerSecond: number;
  damageMultiplier: number;
  effects: PersistentAoeEffectRuntimeConfig[];
  visual: PersistentAoeVisualRuntimeConfig;
  renderData: PersistentAoeObjectCustomData;
}

export type PersistentAoeEffectRuntimeConfig =
  | {
      type: "outgoing-damage-multiplier";
      durationMs: number;
      multiplier: number;
      tint: BrickEffectTint | null;
    }
  | {
      type: "outgoing-damage-flat-reduction";
      durationMs: number;
      reductionValue: number; // Will be multiplied by spell power when applied
      tint: BrickEffectTint | null;
    };

export interface PersistentAoeParticleCustomData {
  baseParticlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  sizeRange: { min: number; max: number };
  color: SceneColor;
  fill?: SceneFill;
  maxParticles?: number;
  radialSpeed: { min: number; max: number };
  tangentialSpeed: { min: number; max: number };
  spawnJitter: { radial: number; angular: number };
}

export interface PersistentAoeObjectCustomData {
  shape: "ring";
  explosion: ExplosionType | null;
  innerRadius: number;
  outerRadius: number;
  thickness: number;
  intensity: number;
  glowColor: SceneColor;
  glowAlpha: number;
  particle: PersistentAoeParticleCustomData | null;
  fireColor: SceneColor;
  durationMs: number;
}
