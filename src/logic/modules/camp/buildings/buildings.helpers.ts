import { BUILDING_IDS, BuildingId, BuildingConfig } from "../../../../db/buildings-db";

export const createDefaultLevels = (): Map<BuildingId, number> => {
  const levels = new Map<BuildingId, number>();
  BUILDING_IDS.forEach((id) => {
    levels.set(id, 0);
  });
  return levels;
};

export const areBuildingListsEqual = (
  a: readonly BuildingId[],
  b: readonly BuildingId[]
): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
};

export const getMaxLevel = (config: BuildingConfig): number => {
  if (config.maxLevel === undefined || config.maxLevel === null) {
    return Number.POSITIVE_INFINITY;
  }
  if (!Number.isFinite(config.maxLevel)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.floor(config.maxLevel));
};

export const sanitizeLevel = (value: unknown, config: BuildingConfig): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const normalized = Math.max(0, Math.floor(value));
  const maxLevel = getMaxLevel(config);
  return Math.min(normalized, maxLevel);
};
