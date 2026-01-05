import { SKILL_IDS, SkillId, SkillConfig } from "../../../../db/skills-db";
import type { SkillLevelMap } from "./skill-tree.types";

export const createDefaultLevels = (): SkillLevelMap => {
  const levels = {} as SkillLevelMap;
  SKILL_IDS.forEach((id) => {
    levels[id] = 0;
  });
  return levels;
};

export const clampLevel = (value: number, config: SkillConfig): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const sanitized = Math.floor(Math.max(value, 0));
  return Math.min(sanitized, config.maxLevel);
};
