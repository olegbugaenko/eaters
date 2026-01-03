import type { BonusId } from "../../../../db/bonuses-db";
import type { BonusEffectFormula } from "@shared/types/bonuses";

export type BonusValueMap = Record<BonusId, number>;

export type BonusValuesListener = (values: BonusValueMap) => void;

export type SanitizedBonusEffects = Partial<Record<BonusId, Record<string, BonusEffectFormula>>>;

export interface BonusSourceState {
  readonly id: string;
  readonly effects: SanitizedBonusEffects;
  level: number;
}
