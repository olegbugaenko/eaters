import { SkillId } from "../../../../db/skills-db";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import { GameModule } from "@core/logic/types";
import { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import { UnlockService } from "../../../services/unlock/UnlockService";
import { BricksModule } from "../bricks/bricks.module";
import type { BrickData, BrickRuntimeState } from "../bricks/bricks.types";
import { NecromancerModule } from "../necromancer/necromancer.module";
import { PlayerUnitsModule } from "../player-units/player-units.module";
import type { PlayerUnitSpawnData } from "../player-units/player-units.types";
import { UnitAutomationModule } from "../unit-automation/unit-automation.module";
import { BonusesModule } from "../../shared/bonuses/bonuses.module";
import { AchievementsModule } from "../../shared/achievements/achievements.module";
import { ArcModule } from "../../scene/arc/arc.module";
import { EnemiesModule } from "../enemies/enemies.module";
import type { EnemyRuntimeState } from "../enemies/enemies.types";
import { MapId, MapListEntry as MapListEntryConfig } from "../../../../db/maps-db";
import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { TargetSnapshot } from "../targeting/targeting.types";
import { MapRunState } from "./MapRunState";
import { MapSceneCleanupContract } from "./map.scene-cleanup";

export interface ResourceRunController {
  startRun(): void;
  cancelRun(): void;
  finishRun(success: boolean): void;
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
  enemies: EnemiesModule;
  necromancer: NecromancerModule;
  resources: ResourceRunController;
  unlocks: UnlockService;
  achievements: AchievementsModule;
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
  controlHintsCollapsed?: boolean;
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

export interface MapModuleUiApi {
  selectMap(mapId: MapId): void;
  selectMapLevel(mapId: MapId, level: number): void;
  restartSelectedMap(): void;
  leaveCurrentMap(): void;
  pauseActiveMap(): void;
  resumeActiveMap(): void;
  setAutoRestartEnabled(enabled: boolean): void;
  setMapSelectViewTransform(
    transform: { scale: number; worldX: number; worldY: number } | null
  ): void;
  setControlHintsCollapsed(collapsed: boolean): void;
  setInspectedTargetAtPosition(position: SceneVector2, radius?: number): void;
  clearInspectedTarget(): void;
  inspectTargetAtPosition(
    position: SceneVector2,
    radius?: number
  ): TargetSnapshot<"brick" | "enemy", BrickRuntimeState | EnemyRuntimeState> | null;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    map: MapModuleUiApi;
  }
}
