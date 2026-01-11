import { computePlayerUnitBlueprint } from "../player-units/player-units.blueprint";
import type { PlayerUnitType } from "../../../../db/player-units-db";
import type { BonusValueMap } from "../../shared/bonuses/bonuses.types";
import type { PlayerUnitBlueprintStats, PlayerUnitRuntimeModifiers } from "@shared/types/player-units";

/**
 * Default runtime modifiers for player units.
 */
export const DEFAULT_RUNTIME: PlayerUnitRuntimeModifiers = Object.freeze({
  rewardMultiplier: 1,
  damageTransferPercent: 0,
  damageTransferRadius: 0,
  attackStackBonusPerHit: 0,
  attackStackBonusCap: 0,
  knockBackReduction: 1,
});

/**
 * Creates a new default runtime modifiers object.
 */
export const getDefaultRuntime = (): PlayerUnitRuntimeModifiers => ({
  ...DEFAULT_RUNTIME,
});

/**
 * Creates a fallback blueprint for a unit type.
 * Uses base blueprint computation with empty bonuses array.
 */
export const getFallbackBlueprint = (
  type: PlayerUnitType,
  bonusValues: BonusValueMap
): PlayerUnitBlueprintStats => ({
  ...computePlayerUnitBlueprint(type, bonusValues),
  bonuses: [],
});
