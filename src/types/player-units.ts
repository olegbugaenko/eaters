import { PlayerUnitType } from "../db/player-units-db";

export interface PlayerUnitStatBlock {
  readonly maxHp: number;
  readonly attackDamage: number;
}

export interface PlayerUnitStatMultipliers {
  readonly maxHp: number;
  readonly attackDamage: number;
}

export interface PlayerUnitBlueprintStats {
  readonly type: PlayerUnitType;
  readonly name: string;
  readonly description?: string;
  readonly base: PlayerUnitStatBlock;
  readonly effective: PlayerUnitStatBlock;
  readonly multipliers: PlayerUnitStatMultipliers;
  readonly armor: number;
  readonly baseAttackInterval: number;
  readonly baseAttackDistance: number;
  readonly moveSpeed: number;
  readonly moveAcceleration: number;
  readonly mass: number;
  readonly physicalSize: number;
}
