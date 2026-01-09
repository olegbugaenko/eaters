import type { BonusId } from "@db/bonuses-db";
import type { UnlockConditionList } from "@shared/types/unlocks";

export interface ProgressionSource<TMapId extends string = string, TSkillId extends string = string> {
  areConditionsMet(conditions: UnlockConditionList<TMapId, TSkillId> | undefined): boolean;
  clearCache(): void;
}

export interface RuntimeContextSource {
  shouldProcessTick(): boolean;
}

export interface BonusValueSource {
  getBonusValue(id: BonusId): number;
}
