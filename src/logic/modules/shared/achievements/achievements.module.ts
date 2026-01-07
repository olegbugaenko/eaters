import { GameModule } from "../../../core/types";
import { DataBridgeHelpers } from "../../../core/DataBridgeHelpers";
import {
  ACHIEVEMENT_IDS,
  AchievementId,
  getAchievementConfig,
} from "../../../../db/achievements-db";
import { getMapConfig, getMapList, MapId } from "../../../../db/maps-db";
import type { MapLevelStats, MapStats } from "../../active-map/map/map.types";
import type { BonusEffectPreview } from "@shared/types/bonuses";
import type {
  AchievementBridgeEntry,
  AchievementLevelMap,
  AchievementsBridgePayload,
  AchievementsModuleOptions,
  AchievementsSaveData,
} from "./achievements.types";
import { ACHIEVEMENTS_BRIDGE_KEY } from "./achievements.const";

export class AchievementsModule implements GameModule {
  public readonly id = "achievements";

  private readonly bridge;
  private readonly bonuses;
  private readonly mapByAchievementId: Record<AchievementId, MapId | null>;
  private levels: AchievementLevelMap = {};

  constructor(options: AchievementsModuleOptions) {
    this.bridge = options.bridge;
    this.bonuses = options.bonuses;
    this.mapByAchievementId = this.resolveMapByAchievement();
    this.registerBonusSources();
    this.syncAllBonusLevels();
  }

  public initialize(): void {
    this.pushState();
  }

  public reset(): void {
    this.levels = {};
    this.syncAllBonusLevels();
    this.pushState();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed) {
      this.levels = parsed;
    } else {
      this.levels = {};
    }
    this.syncAllBonusLevels();
    this.pushState();
  }

  public save(): unknown {
    if (Object.keys(this.levels).length === 0) {
      return undefined;
    }
    return {
      levels: { ...this.levels },
    } satisfies AchievementsSaveData;
  }

  public tick(): void {
    // Achievements update on map completion sync.
  }

  public syncFromMapStats(stats: MapStats): void {
    const nextLevels: AchievementLevelMap = {};
    let changed = false;

    ACHIEVEMENT_IDS.forEach((id) => {
      const mapId = this.mapByAchievementId[id];
      const mapStats = mapId ? stats[mapId] : undefined;
      const cleared = this.getClearedLevelCount(mapStats);
      const config = getAchievementConfig(id);
      const maxLevel = this.getMaxLevelForAchievement(config.maxLevel, mapId);
      const nextLevel = Math.min(cleared, maxLevel);
      nextLevels[id] = nextLevel;
      if ((this.levels[id] ?? 0) !== nextLevel) {
        changed = true;
      }
    });

    if (!changed) {
      return;
    }

    this.levels = nextLevels;
    this.syncAllBonusLevels();
    this.pushState();
  }

  public getLevel(id: AchievementId): number {
    return this.levels[id] ?? 0;
  }

  private resolveMapByAchievement(): Record<AchievementId, MapId | null> {
    const result = {} as Record<AchievementId, MapId | null>;
    ACHIEVEMENT_IDS.forEach((id) => {
      result[id] = null;
    });

    getMapList().forEach((map) => {
      const config = getMapConfig(map.id);
      if (config.achievementId) {
        result[config.achievementId] = map.id;
      }
    });

    return result;
  }

  private getMaxLevelForAchievement(maxLevel: number, mapId: MapId | null): number {
    if (!mapId) {
      return maxLevel;
    }
    const mapConfig = getMapConfig(mapId);
    return Math.min(maxLevel, mapConfig.maxLevel);
  }

  private getClearedLevelCount(levels: Record<number, MapLevelStats> | undefined): number {
    if (!levels) {
      return 0;
    }
    const successful = new Set<number>();
    Object.entries(levels).forEach(([rawLevel, stats]) => {
      const level = Number(rawLevel);
      if (Number.isFinite(level) && stats?.success > 0) {
        successful.add(Math.max(1, Math.floor(level)));
      }
    });

    let cleared = 1;
    while (successful.has(cleared)) {
      cleared += 1;
    }
    return cleared - 1;
  }

  private parseSaveData(data: unknown): AchievementLevelMap | null {
    if (typeof data !== "object" || data === null) {
      return null;
    }
    const raw = data as AchievementsSaveData;
    if (!raw.levels || typeof raw.levels !== "object") {
      return null;
    }
    const parsed: AchievementLevelMap = {};
    Object.entries(raw.levels).forEach(([id, value]) => {
      if (!this.isAchievementId(id)) {
        return;
      }
      parsed[id] = this.sanitizeLevel(value);
    });
    return parsed;
  }

  private isAchievementId(value: string): value is AchievementId {
    return (ACHIEVEMENT_IDS as readonly string[]).includes(value);
  }

  private sanitizeLevel(value: unknown): number {
    if (!Number.isFinite(value as number)) {
      return 0;
    }
    return Math.max(0, Math.floor(Number(value)));
  }

  private registerBonusSources(): void {
    ACHIEVEMENT_IDS.forEach((id) => {
      const config = getAchievementConfig(id);
      const sourceId = this.getBonusSourceId(id);
      this.bonuses.registerSource(sourceId, config.effects);
    });
  }

  private syncAllBonusLevels(): void {
    ACHIEVEMENT_IDS.forEach((id) => this.syncBonusLevel(id));
  }

  private syncBonusLevel(id: AchievementId): void {
    const sourceId = this.getBonusSourceId(id);
    const level = this.levels[id] ?? 0;
    this.bonuses.setBonusCurrentLevel(sourceId, level);
  }

  private getBonusSourceId(id: AchievementId): string {
    return `achievement_${id}`;
  }

  private pushState(): void {
    const payload: AchievementsBridgePayload = {
      achievements: ACHIEVEMENT_IDS.map((id) => this.createAchievementPayload(id)).filter(
        (entry): entry is AchievementBridgeEntry => entry !== null
      ),
    };
    DataBridgeHelpers.pushState(this.bridge, ACHIEVEMENTS_BRIDGE_KEY, payload);
  }

  private createAchievementPayload(id: AchievementId): AchievementBridgeEntry | null {
    const level = this.levels[id] ?? 0;
    if (level <= 0) {
      return null;
    }
    const config = getAchievementConfig(id);
    const mapId = this.mapByAchievementId[id];
    const bonusEffects: BonusEffectPreview[] =
      this.bonuses.getBonusEffects(this.getBonusSourceId(id));

    return {
      id,
      name: config.name,
      description: config.description,
      mapId,
      level,
      maxLevel: this.getMaxLevelForAchievement(config.maxLevel, mapId),
      bonusEffects,
    };
  }
}
