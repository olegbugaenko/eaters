import { BonusId } from "../db/bonuses-db";

export type BonusEffectType = "income" | "multiplier" | "base";

export type BonusEffectContext = Record<string, number>;

export type BonusEffectFormula = (level: number, context?: BonusEffectContext) => number;

export type BonusEffectTypeMap = Partial<Record<BonusEffectType | string, BonusEffectFormula>>;

export type BonusEffectMap = Partial<Record<BonusId, BonusEffectTypeMap>>;

export interface BonusEffectPreview {
  readonly bonusId: BonusId;
  readonly bonusName: string;
  readonly effectType: string;
  readonly currentValue: number;
  readonly nextValue: number;
}
