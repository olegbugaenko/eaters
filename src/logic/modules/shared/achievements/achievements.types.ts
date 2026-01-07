import type { BonusEffectPreview } from "@shared/types/bonuses";
import type { AchievementId } from "../../../../db/achievements-db";
import type { MapId } from "../../../../db/maps-db";
import type { DataBridge } from "../../../core/DataBridge";
import type { BonusesModule } from "../bonuses/bonuses.module";

export interface AchievementBridgeEntry {
  readonly id: AchievementId;
  readonly name: string;
  readonly description: string;
  readonly mapId: MapId | null;
  readonly level: number;
  readonly maxLevel: number;
  readonly bonusEffects: BonusEffectPreview[];
}

export interface AchievementsBridgePayload {
  readonly achievements: AchievementBridgeEntry[];
}

export type AchievementLevelMap = Partial<Record<AchievementId, number>>;

export interface AchievementsModuleOptions {
  readonly bridge: DataBridge;
  readonly bonuses: BonusesModule;
}

export interface AchievementsSaveData {
  readonly levels?: AchievementLevelMap;
}
