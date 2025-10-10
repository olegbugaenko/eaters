import { getMapConfig, MapId } from "../../db/maps-db";
import { SkillId } from "../../db/skills-db";
import type { MapStats } from "../modules/MapModule";
import type { UnlockCondition } from "../../types/unlocks";

interface UnlockServiceOptions {
  getMapStats: () => MapStats;
  getSkillLevel: (id: SkillId) => number;
}

export type GameUnlockCondition = UnlockCondition<MapId, SkillId>;

const sanitizeLevel = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
};

export class UnlockService {
  private readonly getMapStats: () => MapStats;
  private readonly getSkillLevel: (id: SkillId) => number;

  constructor(options: UnlockServiceOptions) {
    this.getMapStats = options.getMapStats;
    this.getSkillLevel = options.getSkillLevel;
  }

  public isUnlocked(condition: GameUnlockCondition): boolean {
    switch (condition.type) {
      case "map":
        return this.isMapLevelUnlocked(condition.id, condition.level);
      case "skill":
        return this.isSkillLevelUnlocked(condition.id, condition.level);
      default:
        return false;
    }
  }

  public areConditionsMet(conditions: readonly GameUnlockCondition[] | undefined): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }
    return conditions.every((condition) => this.isUnlocked(condition));
  }

  private isMapLevelUnlocked(mapId: MapId, requestedLevel: number): boolean {
    const level = sanitizeLevel(requestedLevel);
    const config = getMapConfig(mapId);
    if (!this.areConditionsMet(config.unlockedBy)) {
      return false;
    }
    if (level === 0) {
      return true;
    }
    if (!this.hasCompletedMapLevel(mapId, level - 1)) {
      return false;
    }
    return this.isMapLevelUnlocked(mapId, level - 1);
  }

  private hasCompletedMapLevel(mapId: MapId, level: number): boolean {
    if (level < 0) {
      return true;
    }
    const stats = this.getMapStats()[mapId];
    if (!stats) {
      return false;
    }
    const entry = stats[level];
    if (!entry) {
      return false;
    }
    return entry.success > 0;
  }

  private isSkillLevelUnlocked(skillId: SkillId, requestedLevel: number): boolean {
    const level = sanitizeLevel(requestedLevel);
    if (level === 0) {
      return true;
    }
    const currentLevel = this.getSkillLevel(skillId);
    return currentLevel >= level;
  }
}
