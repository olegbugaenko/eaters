import { getMapConfig, MapId } from "../../db/maps-db";
import { SkillId } from "../../db/skills-db";
import type { MapStats } from "../modules/active-map/map/map.module";
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
  // Short-lived memoization of unlock checks to avoid repeated deep traversals
  private conditionCache = new Map<string, boolean>();
  private lastCacheRefreshMs = 0;
  private static readonly CACHE_TTL_MS = 100; // aligned with game tick (100ms)

  constructor(options: UnlockServiceOptions) {
    this.getMapStats = options.getMapStats;
    this.getSkillLevel = options.getSkillLevel;
  }

  public isUnlocked(condition: GameUnlockCondition): boolean {
    this.refreshCache();
    const key = this.getConditionKey(condition);
    const cached = this.conditionCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    let result = false;
    switch (condition.type) {
      case "map":
        result = this.isMapLevelUnlocked(condition.id, condition.level);
        break;
      case "skill":
        result = this.isSkillLevelUnlocked(condition.id, condition.level);
        break;
      default:
        result = false;
        break;
    }
    this.conditionCache.set(key, result);
    return result;
  }

  public canAccessMapLevel(mapId: MapId, requestedLevel: number): boolean {
    this.refreshCache();
    const level = Math.max(1, sanitizeLevel(requestedLevel));
    const cacheKey = this.getAccessCacheKey(mapId, level);
    const cached = this.conditionCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const config = getMapConfig(mapId);
    let result = true;
    if (level > config.maxLevel) {
      result = false;
    } else if (!this.areConditionsMet(config.unlockedBy)) {
      result = false;
    } else {
      for (let prev = level - 1; prev >= 1; prev -= 1) {
        if (!this.hasCompletedMapLevel(mapId, prev)) {
          result = false;
          break;
        }
      }
    }

    this.conditionCache.set(cacheKey, result);
    return result;
  }

  public areConditionsMet(conditions: readonly GameUnlockCondition[] | undefined): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }
    return conditions.every((condition) => this.isUnlocked(condition));
  }

  private isMapLevelUnlocked(mapId: MapId, requestedLevel: number): boolean {
    // Iterative form avoids recursion overhead and repeated checks
    const level = Math.max(1, sanitizeLevel(requestedLevel));
    const config = getMapConfig(mapId);
    // Check maxLevel limit
    if (level > config.maxLevel) {
      return false;
    }
    if (!this.areConditionsMet(config.unlockedBy)) {
      return false;
    }
    for (let prev = level; prev >= 1; prev -= 1) {
      if (!this.hasCompletedMapLevel(mapId, prev)) {
        return false;
      }
    }
    return true;
  }

  private hasCompletedMapLevel(mapId: MapId, level: number): boolean {
    if (level < 1) {
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

  public clearCache(): void {
    this.conditionCache.clear();
    this.lastCacheRefreshMs = Date.now();
  }

  private refreshCache(): void {
    const now = Date.now();
    if (now - this.lastCacheRefreshMs > UnlockService.CACHE_TTL_MS) {
      this.conditionCache.clear();
      this.lastCacheRefreshMs = now;
    }
  }

  private getConditionKey(condition: GameUnlockCondition): string {
    if (condition.type === "map") {
      return `map:${condition.id}:${Math.max(1, sanitizeLevel(condition.level))}`;
    }
    if (condition.type === "skill") {
      return `skill:${condition.id}:${sanitizeLevel(condition.level)}`;
    }
    return "unknown";
  }

  private getAccessCacheKey(mapId: MapId, level: number): string {
    return `access:${mapId}:${Math.max(1, sanitizeLevel(level))}`;
  }
}
