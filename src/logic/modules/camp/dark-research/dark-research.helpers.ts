import type { DarkResearchConfig } from "@/db/dark-research-db";

export const XP_PER_SECOND_DEFAULT = 1;

export const sanitizeNonNegativeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return value;
};

export const sanitizeLevel = (value: unknown): number =>
  Math.max(0, Math.floor(sanitizeNonNegativeNumber(value, 0)));

export const calculateMaxXpForLevel = (config: DarkResearchConfig, level: number): number => {
  const sanitizedLevel = Math.max(0, Math.floor(level));
  const base = Math.max(1, config.maxXpPerLevelBase);
  const xpPower = Math.max(0, config.xpPowerBase);
  const value = base * Math.pow(1 + xpPower, sanitizedLevel);
  return Math.max(1, value);
};
