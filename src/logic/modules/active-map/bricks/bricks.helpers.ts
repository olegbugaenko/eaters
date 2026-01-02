import { clampNumber } from "@/utils/helpers/numbers";
import type { BrickConfig, BrickType } from "../../../../db/bricks-db";
import { isBrickType, getBrickConfig } from "../../../../db/bricks-db";
import type { ExplosionType } from "../../../../db/explosions-db";
import type { DestructubleExplosionConfig } from "../../../interfaces/destructuble";
import type { ResourceStockpile } from "../../../../db/resources-db";
import {
  RESOURCE_IDS,
  normalizeResourceAmount,
  createEmptyResourceStockpile,
} from "../../../../db/resources-db";

const DEFAULT_BRICK_TYPE: BrickType = "classic";

interface BrickExplosionState {
  type: ExplosionType;
  initialRadius: number;
}

export const sanitizeKnockBackSpeed = (
  value: number | undefined,
  distance: number
): number => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (distance > 0) {
    return distance * 2;
  }
  return 0;
};

export const sanitizeKnockBackAmplitude = (
  value: number | undefined,
  distance: number,
  config: BrickConfig,
  physicalSize: number
): number => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (distance > 0) {
    return clampNumber(distance * 0.15, 4, 12);
  }

  const fallbackSize = Math.max(physicalSize, Math.max(config.size.width, config.size.height) / 2);
  return clampNumber(fallbackSize * 0.35, 4, 10);
};

export const sanitizeHp = (value: number | undefined, maxHp: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampNumber(value, 0, maxHp);
  }
  return clampNumber(maxHp, 0, maxHp);
};

export const sanitizeRotation = (value: number | undefined): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return Math.random() * Math.PI * 2;
};

export const sanitizeBrickType = (value: BrickType | undefined): BrickType => {
  if (isBrickType(value)) {
    return value;
  }
  return DEFAULT_BRICK_TYPE;
};

export const sanitizeBrickLevel = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
};

export const resolveBrickExplosion = (
  config: DestructubleExplosionConfig | undefined,
  brickConfig: BrickConfig,
  physicalSize: number
): BrickExplosionState | undefined => {
  const baseRadius = Math.max(
    Math.max(brickConfig.size.width, brickConfig.size.height) / 2,
    physicalSize
  );

  const type = config?.type;
  if (!type) {
    return undefined;
  }

  if (
    config &&
    typeof config.initialRadius === "number" &&
    Number.isFinite(config.initialRadius)
  ) {
    const radius = Math.max(1, config.initialRadius);
    return { type, initialRadius: radius };
  }

  const multiplier =
    config && typeof config.radiusMultiplier === "number" && Number.isFinite(config.radiusMultiplier)
      ? config.radiusMultiplier
      : 1;
  const offset =
    config && typeof config.radiusOffset === "number" && Number.isFinite(config.radiusOffset)
      ? config.radiusOffset
      : 0;

  const initialRadius = Math.max(1, baseRadius * multiplier + offset);
  return { type, initialRadius };
};

export const getBrickLevelStatMultiplier = (level: number): number => Math.pow(3, Math.max(level - 1, 0));

export const getBrickLevelRewardMultiplier = (level: number): number => Math.pow(2, Math.max(level - 1, 0));

export const scaleBrickStat = (
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

export const scaleResourceStockpile = (
  base: ResourceStockpile,
  multiplier: number
): ResourceStockpile => {
  const scaled = createEmptyResourceStockpile();
  RESOURCE_IDS.forEach((id) => {
    const value = base[id] ?? 0;
    const scaledValue = Math.round(Math.max(value, 0) * multiplier * 100) / 100;
    scaled[id] = scaledValue > 0 ? scaledValue : 0;
  });
  return scaled;
};

export const calculateBrickStatsForLevel = (
  config: BrickConfig,
  level: number
): { maxHp: number; baseDamage: number; armor: number; rewards: ResourceStockpile } => {
  const sanitizedLevel = sanitizeBrickLevel(level);
  const statMultiplier = getBrickLevelStatMultiplier(sanitizedLevel);
  const rewardMultiplier = getBrickLevelRewardMultiplier(sanitizedLevel);
  const destructuble = config.destructubleData;

  const maxHp = Math.max(
    scaleBrickStat(destructuble?.maxHp ?? 1, statMultiplier, true),
    1
  );
  const baseDamage = scaleBrickStat(destructuble?.baseDamage ?? 0, statMultiplier, true);
  const armor = scaleBrickStat(destructuble?.armor ?? 0, statMultiplier, true);
  const baseRewards = normalizeResourceAmount(config.rewards);
  const rewards = scaleResourceStockpile(baseRewards, rewardMultiplier);

  return { maxHp, baseDamage, armor, rewards };
};
