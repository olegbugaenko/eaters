import { UNIT_MODULE_IDS, UnitModuleId } from "../../../../db/unit-modules-db";
import { ResourceStockpile, createEmptyResourceStockpile, RESOURCE_IDS } from "../../../../db/resources-db";

export const createDefaultLevels = (): Map<UnitModuleId, number> => {
  const levels = new Map<UnitModuleId, number>();
  UNIT_MODULE_IDS.forEach((id) => {
    levels.set(id, 0);
  });
  return levels;
};

export const clampLevel = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
};

export const scaleResourceStockpile = (base: ResourceStockpile, factor: number): ResourceStockpile => {
  const scaled = createEmptyResourceStockpile();
  RESOURCE_IDS.forEach((id) => {
    scaled[id] = (base[id] ?? 0) * factor;
  });
  return scaled;
};

export const toRecord = (stockpile: ResourceStockpile): Record<string, number> => {
  const record: Record<string, number> = {};
  RESOURCE_IDS.forEach((id) => {
    const value = stockpile[id];
    if (value > 0) {
      record[id] = value;
    }
  });
  return record;
};

export const areModuleListsEqual = (
  a: readonly UnitModuleId[],
  b: readonly UnitModuleId[]
): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
};

export const computeBonusValue = (base: number, perLevel: number, level: number): number => {
  if (level <= 0) {
    return 0;
  }
  if (!Number.isFinite(base) || !Number.isFinite(perLevel)) {
    return 0;
  }
  return base + perLevel * (level - 1);
};
