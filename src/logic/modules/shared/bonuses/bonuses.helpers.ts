import { BONUS_IDS, BonusId, getBonusConfig } from "../../../../db/bonuses-db";
import type { BonusValueMap } from "./bonuses.types";
import { BONUS_COMPARISON_EPSILON } from "./bonuses.const";

export const createBonusValueMap = (
  initializer: (config: ReturnType<typeof getBonusConfig>, id: BonusId) => number
): BonusValueMap => {
  const values = {} as BonusValueMap;
  BONUS_IDS.forEach((id) => {
    const config = getBonusConfig(id);
    values[id] = initializer(config, id);
  });
  return values;
};

export const sanitizeLevel = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(Math.floor(value), 0);
};

export const sanitizeEffectValue = (value: number, effectType: string): number => {
  if (!Number.isFinite(value)) {
    return effectType === "multiplier" ? 1 : 0;
  }
  return value;
};

export const areBonusMapsEqual = (a: BonusValueMap, b: BonusValueMap): boolean => {
  return BONUS_IDS.every((id) => Math.abs((a[id] ?? 0) - (b[id] ?? 0)) < BONUS_COMPARISON_EPSILON);
};
