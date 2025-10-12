import { PlayerUnitType } from "../db/player-units-db";

export interface PlayerUnitStatBlock {
  readonly maxHp: number;
  readonly attackDamage: number;
}

export interface PlayerUnitStatMultipliers {
  readonly maxHp: number;
  readonly attackDamage: number;
}

export interface PlayerUnitCritChanceStats {
  readonly base: number;
  readonly bonus: number;
  readonly effective: number;
}

export interface PlayerUnitCritMultiplierStats {
  readonly base: number;
  readonly multiplier: number;
  readonly effective: number;
}

export type PlayerUnitBonusFormat = "flat" | "percent" | "multiplier";

export interface PlayerUnitBonusLine {
  readonly label: string;
  readonly value: number;
  readonly format: PlayerUnitBonusFormat;
  readonly hint?: string;
}

export interface PlayerUnitRuntimeModifiers {
  readonly rewardMultiplier: number;
  readonly damageTransferPercent: number;
  readonly damageTransferRadius: number;
}

export interface PlayerUnitBlueprintStats {
  readonly type: PlayerUnitType;
  readonly name: string;
  readonly description?: string;
  readonly base: PlayerUnitStatBlock;
  readonly effective: PlayerUnitStatBlock;
  readonly multipliers: PlayerUnitStatMultipliers;
  readonly critChance: PlayerUnitCritChanceStats;
  readonly critMultiplier: PlayerUnitCritMultiplierStats;
  readonly armor: number;
  readonly baseAttackInterval: number;
  readonly baseAttackDistance: number;
  readonly moveSpeed: number;
  readonly moveAcceleration: number;
  readonly mass: number;
  readonly physicalSize: number;
  readonly bonuses?: readonly PlayerUnitBonusLine[];
}
