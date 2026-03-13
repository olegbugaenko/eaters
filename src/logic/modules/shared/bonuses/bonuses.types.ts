import type { BonusId } from "../../../../db/bonuses-db";
import type { BonusBreakdownEntry, BonusEffectFormula } from "@shared/types/bonuses";
import type { BonusSourceCategory } from "./bonuses.const";

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
  readonly category: BonusSourceCategory;
  readonly effects: SanitizedBonusEffects;
  level: number;
}

export interface BonusesModuleUiApi {
  getValues(): BonusValueMap;
  getBreakdown(bonusId: BonusId): readonly BonusBreakdownEntry[];
}

declare module "@/core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    bonuses: BonusesModuleUiApi;
  }
}
