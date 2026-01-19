import type { AbilityDescription } from "./ability.types";
import { PheromoneHealAbility } from "./implementations/PheromoneHealAbility";
import { PheromoneFrenzyAbility } from "./implementations/PheromoneFrenzyAbility";
import { FireballAbility } from "./implementations/FireballAbility";
import { TailNeedleAbility } from "./implementations/TailNeedleAbility";
import { ChainLightningAbility } from "./implementations/ChainLightningAbility";

export const PLAYER_UNIT_ABILITY_DEFINITIONS: readonly AbilityDescription<any, any>[] = [
  PheromoneHealAbility,
  PheromoneFrenzyAbility,
  FireballAbility,
  TailNeedleAbility,
  ChainLightningAbility,
];

export type { PlayerUnitAbilityState } from "./AbilityUnitState";
