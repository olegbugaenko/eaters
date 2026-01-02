import { SkillId } from "../../../../db/skills-db";
import { DataBridge } from "../../../core/DataBridge";
import { GameModule } from "../../../core/types";
import { SceneObjectManager } from "../../../services/SceneObjectManager";
import { UnlockService } from "../../../services/UnlockService";
import { BricksModule, BrickData } from "../bricks/bricks.module";
import { NecromancerModule } from "../necromancer/necromancer.module";
import { PlayerUnitsModule, PlayerUnitSpawnData } from "../player-units/player-units.module";
import { UnitAutomationModule } from "../unit-automation/unit-automation.module";
import { BonusesModule } from "../../shared/bonuses/bonuses.module";
import { ArcModule } from "../../scene/arc/arc.module";
import { MapId, MapListEntry as MapListEntryConfig } from "../../../../db/maps-db";
import { MapRunState } from "./MapRunState";

export interface ResourceRunController {
  startRun(): void;
  cancelRun(): void;
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
  getSkillLevel: (id: SkillId) => number;
}

export interface MapSaveData {
  mapId: MapId;
  mapLevel?: number;
  stats?: MapStats;
  selectedLevels?: Partial<Record<MapId, number>>;
  autoRestartEnabled?: boolean;
  lastPlayedMap?: { mapId: MapId; level: number };
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

