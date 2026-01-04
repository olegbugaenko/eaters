import { cloneParticleEmitterConfig } from "../../../helpers/particle-emitter.helper";
import type { ParticleEmitterConfig } from "../../../interfaces/visuals/particle-emitters-config";
import {
  PlayerUnitType,
  isPlayerUnitType,
  PlayerUnitRendererConfig,
} from "@db/player-units-db";
import { PlayerUnitRuntimeModifiers } from "@shared/types/player-units";
import {
  cloneRendererConfigForScene as cloneRendererConfigForSceneDeep,
  cloneRendererLayer,
} from "@shared/helpers/renderer-clone.helper";

/**
 * Sanitizes runtime modifiers for player units.
 */
export const sanitizeRuntimeModifiers = (
  modifiers: PlayerUnitRuntimeModifiers | undefined
): PlayerUnitRuntimeModifiers => ({
  rewardMultiplier: Math.max(modifiers?.rewardMultiplier ?? 1, 0),
  damageTransferPercent: Math.max(modifiers?.damageTransferPercent ?? 0, 0),
  damageTransferRadius: Math.max(modifiers?.damageTransferRadius ?? 0, 0),
  attackStackBonusPerHit: Math.max(modifiers?.attackStackBonusPerHit ?? 0, 0),
  attackStackBonusCap: Math.max(modifiers?.attackStackBonusCap ?? 0, 0),
});

/**
 * Sanitizes a player unit type, returning default if invalid.
 */
export const sanitizeUnitType = (value: PlayerUnitType | undefined): PlayerUnitType => {
  if (isPlayerUnitType(value)) {
    return value;
  }
  return "bluePentagon";
};

/**
 * Clones a player unit emitter configuration.
 */
export const cloneEmitter = (
  config: ParticleEmitterConfig
): ParticleEmitterConfig => cloneParticleEmitterConfig(config);

// All cloning functions are now imported from @shared/helpers/renderer-clone.helper
// Re-export with shallow clone by default for performance
export { cloneRendererLayer };

export const cloneRendererConfigForScene = (
  renderer: PlayerUnitRendererConfig
): PlayerUnitRendererConfig => {
  return cloneRendererConfigForSceneDeep(renderer, { deep: false });
};
