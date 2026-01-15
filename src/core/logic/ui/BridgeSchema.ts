/**
 * Типобезпечна схема для DataBridge.
 * Визначає всі ключі та їх типи для перевірки під час компіляції.
 */

import type { MapId } from "../../../db/maps-db";
import type { UnitDesignId } from "@logic/modules/camp/unit-design/unit-design.types";
import type { PlayerUnitType } from "@db/player-units-db";
import type { PlayerUnitBlueprintStats } from "@shared/types/player-units";
import type { ResourceAmountPayload, ResourceRunSummaryPayload } from "@logic/modules/shared/resources/resources.types";
import type { MapListEntry, MapAutoRestartState } from "@logic/modules/active-map/map/map.types";
import type { BuildingsWorkshopBridgeState } from "@logic/modules/camp/buildings/buildings.types";
import type { CraftingBridgeState } from "@logic/modules/camp/crafting/crafting.types";
import type { UnitDesignerBridgeState } from "@logic/modules/camp/unit-design/unit-design.types";
import type { UnitModuleWorkshopBridgeState } from "@logic/modules/camp/unit-module-workshop/unit-module-workshop.types";
import type { UnitAutomationBridgeState } from "@logic/modules/active-map/unit-automation/unit-automation.types";
import type { SpellOption } from "@logic/modules/active-map/spellcasting/spellcasting.types";
import type { NecromancerResourcesPayload, NecromancerSpawnOption } from "@logic/modules/active-map/necromancer/necromancer.types";
import type { SkillTreeBridgePayload } from "@logic/modules/camp/skill-tree/skill-tree.types";
import type { AchievementsBridgePayload } from "@logic/modules/shared/achievements/achievements.types";
import type { TutorialMonitorInput, TutorialMonitorStatus } from "@logic/modules/active-map/tutorial-monitor/tutorial-monitor.types";
import type { CampStatisticsSnapshot } from "@logic/modules/shared/statistics/statistics.module";
import type { EventLogEntry } from "@logic/modules/shared/event-log/event-log.types";
import type { TargetSnapshot } from "@logic/modules/active-map/targeting/targeting.types";
import type { BrickRuntimeState } from "@logic/modules/active-map/bricks/bricks.types";
import type { EnemyRuntimeState } from "@logic/modules/active-map/enemies/enemies.types";
import type { NewUnlockNotificationBridgeState } from "@logic/services/new-unlock-notification/new-unlock-notification.types";

/**
 * View transform для навігації по картах/скілах.
 */
export interface ViewTransform {
  scale: number;
  worldX: number;
  worldY: number;
}

/**
 * Типобезпечна схема всіх ключів DataBridge та їх типів.
 */
export interface BridgeSchema {
  // Resources
  "resources/totals": ResourceAmountPayload[];
  "resources/runSummary": ResourceRunSummaryPayload;
  "resources/runDuration": number;

  // Maps
  "maps/list": MapListEntry[];
  "maps/selected": MapId | null;
  "maps/selectedLevel": number;
  "maps/clearedLevelsTotal": number;
  "maps/lastPlayed": { mapId: MapId; level: number } | null;
  "maps/autoRestart": MapAutoRestartState;
  "maps/selectViewTransform": ViewTransform | null;
  "maps/controlHintsCollapsed": boolean;
  "maps/inspectedTarget": TargetSnapshot<"brick" | "enemy", BrickRuntimeState | EnemyRuntimeState> | null;

  // Player Units
  "playerUnits/count": number;
  "playerUnits/totalHp": number;
  "playerUnits/blueprintStats": PlayerUnitBlueprintStats[];
  "playerUnits/countsByDesign": Record<UnitDesignId, number>;

  // Bricks
  "bricks/count": number;
  "bricks/totalHp": number;

  // Enemies
  "enemies/count": number;
  "enemies/totalHp": number;

  // Camp Modules
  "buildings/workshop": BuildingsWorkshopBridgeState;
  "crafting/state": CraftingBridgeState;
  "unitDesigner/state": UnitDesignerBridgeState;
  "unitModules/workshop": UnitModuleWorkshopBridgeState;
  "automation/state": UnitAutomationBridgeState;

  // Skill Tree
  "skills/tree": SkillTreeBridgePayload;
  "skills/treeViewTransform": ViewTransform | null;

  // Achievements
  "achievements/list": AchievementsBridgePayload;

  // Spellcasting
  "spellcasting/options": SpellOption[];

  // Necromancer
  "necromancer/resources": NecromancerResourcesPayload;
  "necromancer/spawnOptions": NecromancerSpawnOption[];

  // Tutorial
  "tutorial/monitor/input": TutorialMonitorInput;
  "tutorial/monitor/output": TutorialMonitorStatus;

  // Statistics
  "statistics/summary": CampStatisticsSnapshot;
  "statistics/history": EventLogEntry[];

  // Time
  "time-played": number;

  // New unlock notifications
  "newUnlocks/state": NewUnlockNotificationBridgeState;
}

/**
 * Тип для ключів BridgeSchema.
 */
export type BridgeKey = keyof BridgeSchema;

/**
 * Helper тип для отримання типу значення за ключем.
 */
export type BridgeValue<K extends BridgeKey> = BridgeSchema[K];
