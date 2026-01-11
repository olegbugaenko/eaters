import { clampNumber } from "@shared/helpers/numbers.helper";
import { sanitizeLevel } from "@shared/helpers/validation.helper";
import type { EnemyConfig, EnemyType } from "../../../../db/enemies-db";
import { isEnemyType, getEnemyConfig } from "../../../../db/enemies-db";
import type { ResourceStockpile } from "../../../../db/resources-db";
import {
  RESOURCE_IDS,
  normalizeResourceAmount,
  createEmptyResourceStockpile,
} from "../../../../db/resources-db";

const DEFAULT_ENEMY_TYPE: EnemyType = "basicEnemy";

/**
 * Sanitizes an enemy level value, ensuring it's a valid positive integer >= 1.
 * @param value - Value to sanitize
 * @returns Sanitized enemy level (>= 1)
 */
export const sanitizeEnemyLevel = (value: number | undefined): number => {
  return sanitizeLevel(value, 1);
};

export const sanitizeEnemyType = (value: EnemyType | undefined): EnemyType => {
  if (isEnemyType(value)) {
    return value;
  }
  return DEFAULT_ENEMY_TYPE;
};

/**
 * Gets the stat multiplier for a given enemy level.
 * Uses the same formula as bricks: 3^(level-1)
 * @param level - Enemy level
 * @returns Stat multiplier
 */
export const getEnemyLevelStatMultiplier = (level: number): number => {
  return Math.pow(3, Math.max(level - 1, 0));
};

/**
 * Gets the reward multiplier for a given enemy level.
 * Uses the same formula as bricks: 2^(level-1)
 * @param level - Enemy level
 * @returns Reward multiplier
 */
export const getEnemyLevelRewardMultiplier = (level: number): number => {
  return Math.pow(2, Math.max(level - 1, 0));
};

/**
 * Scales a stat value by a multiplier.
 * @param baseValue - Base value to scale
 * @param multiplier - Multiplier to apply
 * @param ensurePositive - If true, ensures result is at least 1 (for stats like HP)
 * @returns Scaled value
 */
export const scaleEnemyStat = (
  baseValue: number | undefined,
  multiplier: number,
  ensurePositive: boolean
): number => {
  if (typeof baseValue !== "number" || !Number.isFinite(baseValue)) {
    if (!ensurePositive) {
      return 0;
    }
    return multiplier > 1 ? 1 : 0;
  }
  const base = Math.max(baseValue, 0);
  const scaled = Math.round(base * multiplier);

  if (base === 0) {
    if (!ensurePositive) {
      return 0;
    }
    return multiplier > 1 ? 1 : 0;
  }

  if (ensurePositive) {
    return Math.max(1, scaled);
  }

  return Math.max(0, scaled);
};

/**
 * Scales a resource stockpile by a multiplier.
 * @param base - Base resource stockpile
 * @param multiplier - Multiplier to apply
 * @returns Scaled resource stockpile
 */
export const scaleEnemyResourceStockpile = (
  base: ResourceStockpile,
  multiplier: number
): ResourceStockpile => {
  const normalized = normalizeResourceAmount(base);
  const scaled = createEmptyResourceStockpile();
  RESOURCE_IDS.forEach((id) => {
    const baseValue = normalized[id] ?? 0;
    const scaledValue = Math.round(baseValue * multiplier);
    scaled[id] = scaledValue > 0 ? scaledValue : 0;
  });
  return scaled;
};

/**
 * Calculates enemy stats for a given level.
 * @param config - Enemy configuration
 * @param level - Enemy level
 * @returns Calculated stats for the level
 */
export const calculateEnemyStatsForLevel = (
  config: EnemyConfig,
  level: number
): {
  maxHp: number;
  baseDamage: number;
  armor: number;
  rewards: ResourceStockpile;
} => {
  const sanitizedLevel = sanitizeEnemyLevel(level);
  const statMultiplier = getEnemyLevelStatMultiplier(sanitizedLevel);
  const rewardMultiplier = getEnemyLevelRewardMultiplier(sanitizedLevel);

  const maxHp = Math.max(
    scaleEnemyStat(config.maxHp, statMultiplier, true),
    1
  );
  const baseDamage = scaleEnemyStat(config.baseDamage, statMultiplier, true);
  const armor = scaleEnemyStat(config.armor, statMultiplier, true);
  const baseRewards = normalizeResourceAmount(config.reward);
  const rewards = scaleEnemyResourceStockpile(baseRewards, rewardMultiplier);

  return { maxHp, baseDamage, armor, rewards };
};
