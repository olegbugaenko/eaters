import { SkillId } from "../../../../db/skills-db";
import { DataBridge } from "../../../core/DataBridge";
import { GameModule } from "../../../core/types";
import { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import { UnlockService } from "../../../services/unlock/UnlockService";
import { BricksModule } from "../bricks/bricks.module";
import type { BrickData } from "../bricks/bricks.types";
import { NecromancerModule } from "../necromancer/necromancer.module";
import { PlayerUnitsModule } from "../player-units/player-units.module";
import type { PlayerUnitSpawnData } from "../player-units/player-units.types";
import { UnitAutomationModule } from "../unit-automation/unit-automation.module";
import { BonusesModule } from "../../shared/bonuses/bonuses.module";
import { ArcModule } from "../../scene/arc/arc.module";
import { MapId, MapListEntry as MapListEntryConfig } from "../../../../db/maps-db";
import { MapRunState } from "./MapRunState";
import { MapSceneCleanupContract } from "./map.scene-cleanup";

export interface ResourceRunController {
  startRun(): void;
  cancelRun(): void;
  finishRun(): void;
  isRunSummaryAvailable(): boolean;
  getRunDurationMs(): number;
}

export interface MapModuleOptions {
  scene: SceneObjectManager;
  bridge: DataBridge;
  runState: MapRunState;
  bonuses: BonusesModule;
  bricks: BricksModule;
  playerUnits: PlayerUnitsModule;
  necromancer: NecromancerModule;
  resources: ResourceRunController;
  unlocks: UnlockService;
  unitsAutomation: UnitAutomationModule;
  arcs: ArcModule;
  sceneCleanup: MapSceneCleanupContract;
  getSkillLevel: (id: SkillId) => number;
}

export interface MapSaveData {
  mapId: MapId;
  mapLevel?: number;
  stats?: MapStats;
  selectedLevels?: Partial<Record<MapId, number>>;
  autoRestartEnabled?: boolean;
  lastPlayedMap?: { mapId: MapId; level: number };
  mapSelectViewTransform?: { scale: number; worldX: number; worldY: number };
}

export interface MapLevelStats {
  success: number;
  failure: number;
  bestTimeMs: number | null;
}

export type MapStats = Partial<Record<MapId, Record<number, MapLevelStats>>>;

export interface MapListEntry extends MapListEntryConfig {
  readonly currentLevel: number;
  readonly selectedLevel: number;
  readonly attempts: number;
  readonly bestTimeMs: number | null;
  readonly clearedLevels: number;
  readonly maxLevel: number;
  readonly selectable: boolean; // true if map can be selected/played
}

export interface MapRunResult {
  mapId?: MapId;
  level?: number;
  success: boolean;
  durationMs?: number;
}

export interface MapAutoRestartState {
  readonly unlocked: boolean;
  readonly enabled: boolean;
}

export type MapModuleInstance = GameModule & { id: string };

export type MapGenerationPayload = {
  configSize: { width: number; height: number };
  bricks: BrickData[];
  spawnUnits: PlayerUnitSpawnData[];
  spawnPoints: { x: number; y: number }[];
};

