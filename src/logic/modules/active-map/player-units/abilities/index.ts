import { AbilityDescription } from "./AbilityTypes";
import { PlayerUnitAbilityState, PheromoneAttackBonusState } from "./AbilityUnitState";
import { PheromoneHealAbility } from "./PheromoneHealAbility";
import { PheromoneFrenzyAbility } from "./PheromoneFrenzyAbility";
import { FireballAbility } from "./FireballAbility";

export const PLAYER_UNIT_ABILITY_DEFINITIONS: readonly AbilityDescription<any, any>[] = [
  PheromoneHealAbility,
  PheromoneFrenzyAbility,
  FireballAbility,
];

export type { PlayerUnitAbilityState, PheromoneAttackBonusState };
