import type { PlayerUnitType } from "../../../../db/player-units-db";
import type { UnitModuleId, UnitModuleBonusType } from "../../../../db/unit-modules-db";
import { isPlayerUnitType } from "../../../../db/player-units-db";
import { MAX_MODULES_PER_UNIT, MAX_ACTIVE_UNITS } from "./unit-design.const";
import type { UnitDesignId } from "./unit-design.types";

export const clampModuleCount = (modules: UnitModuleId[]): UnitModuleId[] =>
  modules.slice(0, MAX_MODULES_PER_UNIT);

export const areRostersEqual = (
  first: readonly UnitDesignId[],
  second: readonly UnitDesignId[]
): boolean => {
  if (first.length !== second.length) {
    return false;
  }
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) {
      return false;
    }
  }
  return true;
};

export const areModulesEqual = (
  a: readonly UnitModuleId[],
  b: readonly UnitModuleId[]
): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
};

export const sanitizeRoster = (
  roster: readonly UnitDesignId[],
  availableIds: readonly UnitDesignId[]
): UnitDesignId[] => {
  if (availableIds.length === 0) {
    return [];
  }
  const availableSet = new Set(availableIds);
  const sanitized: UnitDesignId[] = [];
  roster.forEach((id) => {
    if (sanitized.length >= MAX_ACTIVE_UNITS) {
      return;
    }
    if (!availableSet.has(id)) {
      return;
    }
    if (sanitized.includes(id)) {
      return;
    }
    sanitized.push(id);
  });
  return sanitized;
};

export const sanitizeUnitType = (type: PlayerUnitType | undefined): PlayerUnitType => {
  if (isPlayerUnitType(type)) {
    return type;
  }
  return "bluePentagon";
};

export const createDesignId = (counter: number): UnitDesignId => {
  return `unit-${counter}`;
};

export const extractCounter = (id: string): number => {
  const match = /unit-(\d+)/.exec(id);
  if (!match) {
    return 0;
  }
  const value = Number.parseInt(match[1] ?? "0", 10);
  return Number.isFinite(value) ? value : 0;
};

export const computeModuleValue = (
  type: UnitModuleBonusType,
  base: number,
  perLevel: number,
  level: number
): number => {
  if (level <= 0) {
    return 0;
  }
  const sanitizedBase = Number.isFinite(base) ? base : 0;
  const sanitizedPerLevel = Number.isFinite(perLevel) ? perLevel : 0;
  const value = sanitizedBase + sanitizedPerLevel * (level - 1);
  if (type === "multiplier") {
    return Math.max(value, 0);
  }
  return Math.max(value, 0);
};
