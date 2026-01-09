import type { BonusId } from "../../../../db/bonuses-db";
import type { BonusEffectFormula } from "@shared/types/bonuses";

export type BonusValueMap = Record<BonusId, number>;

export type BonusValuesListener = (values: BonusValueMap) => void;

export type SanitizedBonusEffects = Partial<Record<BonusId, Record<string, BonusEffectFormula>>>;

export interface BonusRuleRequirements {
  progressionKeys?: string[];
  runtimeFlags?: string[];
}

export interface BonusRuleEffects {
  addMultiplier?: number;
  addFlat?: number;
}

export interface BonusRule {
  bonusId: BonusId;
  requires: BonusRuleRequirements;
  effects: BonusRuleEffects;
}

export interface BonusRuleContextInput {
  progressionKeys?: string[];
  runtimeFlags?: string[];
}

export interface BonusSourceState {
  readonly id: string;
  readonly effects: SanitizedBonusEffects;
  level: number;
}
