import { DataBridge } from "../core/DataBridge";
import { GameModule } from "../core/types";
import { SceneObjectManager, SceneSize } from "../services/SceneObjectManager";
import { BricksModule, BrickData } from "./BricksModule";
import {
  PlayerUnitsModule,
  PlayerUnitSpawnData,
} from "./PlayerUnitsModule";
import { NecromancerModule } from "./NecromancerModule";
import { UnlockService } from "../services/UnlockService";
import {
  MapConfig,
  MapId,
  MapListEntry as MapListEntryConfig,
  getMapConfig,
  getMapList,
  isMapId,
} from "../../db/maps-db";
import { SceneVector2 } from "../services/SceneObjectManager";
import { buildBricksFromBlueprints } from "../services/BrickLayoutService";

interface ResourceRunController {
  startRun(): void;
}

export const MAP_LIST_BRIDGE_KEY = "maps/list";
export const MAP_SELECTED_BRIDGE_KEY = "maps/selected";

interface MapModuleOptions {
  scene: SceneObjectManager;
  bridge: DataBridge;
  bricks: BricksModule;
  playerUnits: PlayerUnitsModule;
  necromancer: NecromancerModule;
  resources: ResourceRunController;
  unlocks: UnlockService;
}

interface MapSaveData {
  mapId: MapId;
  stats?: MapStats;
}

export interface MapLevelStats {
  success: number;
  failure: number;
}

export type MapStats = Partial<Record<MapId, Record<number, MapLevelStats>>>;

export interface MapListEntry extends MapListEntryConfig {
  readonly currentLevel: number;
  readonly attempts: number;
}

export interface MapRunResult {
  mapId?: MapId;
  level?: number;
  success: boolean;
}

const DEFAULT_MAP_ID: MapId = "foundations";
export const PLAYER_UNIT_SPAWN_SAFE_RADIUS = 150;

export class MapModule implements GameModule {
  public readonly id = "maps";

  private selectedMapId: MapId | null = null;
  private readonly unlocks: UnlockService;
  private mapStats: MapStats = {};

  constructor(private readonly options: MapModuleOptions) {
    this.unlocks = options.unlocks;
  }

  public initialize(): void {
    this.pushMapList();
    this.ensureSelection({ generateBricks: false, generateUnits: false });
  }

  public reset(): void {
    this.ensureSelection({ generateBricks: true, generateUnits: true });
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    this.mapStats = parsed?.stats ?? {};
    this.pushMapList();

    const savedMapId = parsed?.mapId;
    this.selectedMapId = savedMapId && this.isMapSelectable(savedMapId) ? savedMapId : null;
    this.ensureSelection({ generateBricks: false, generateUnits: false });
  }

  public save(): unknown {
    return {
      mapId: this.selectedMapId ?? DEFAULT_MAP_ID,
      stats: this.cloneStats(),
    } satisfies MapSaveData;
  }

  public tick(_deltaMs: number): void {
    // Map logic is static for now.
  }

  public selectMap(mapId: MapId): void {
    if (!isMapId(mapId) || !this.isMapSelectable(mapId)) {
      return;
    }
    this.selectedMapId = mapId;
    this.applyMap(mapId, { generateBricks: true, generateUnits: true });
  }

  public restartSelectedMap(): void {
    if (!this.selectedMapId) {
      return;
    }
    this.applyMap(this.selectedMapId, { generateBricks: true, generateUnits: true });
  }

  public recordRunResult(result: MapRunResult): void {
    const mapId = result.mapId && isMapId(result.mapId) ? result.mapId : this.selectedMapId;
    if (!mapId) {
      return;
    }
    const level = sanitizeLevel(result.level);
    const stats = this.ensureLevelStats(mapId, level);
    if (result.success) {
      stats.success += 1;
    } else {
      stats.failure += 1;
    }
    this.pushMapList();
    this.pushSelectedMap();
  }

  public getMapStats(): MapStats {
    return this.cloneStats();
  }

  private ensureSelection(options: { generateBricks: boolean; generateUnits: boolean }): void {
    const mapId = this.resolveSelectableMapId(this.selectedMapId);
    if (!mapId) {
      this.selectedMapId = null;
      this.options.bridge.setValue<MapId | null>(MAP_SELECTED_BRIDGE_KEY, null);
      return;
    }
    this.selectedMapId = mapId;
    this.applyMap(mapId, options);
  }

  private applyMap(
    mapId: MapId,
    options: { generateBricks: boolean; generateUnits: boolean }
  ): void {
    const config = getMapConfig(mapId);
    this.options.scene.setMapSize(config.size);
    this.options.playerUnits.prepareForMap();
    if (options.generateBricks) {
      const bricks = this.generateBricks(config);
      this.options.bricks.setBricks(bricks);
    }
    const spawnUnits = this.generatePlayerUnits(config);
    const spawnPoints = this.getSpawnPoints(config, spawnUnits);

    if (options.generateUnits) {
      this.options.playerUnits.setUnits(spawnUnits);
    }

    this.options.necromancer.configureForMap({
      spawnPoints,
    });

    this.options.resources.startRun();

    this.pushSelectedMap();
  }

  private generateBricks(config: MapConfig): BrickData[] {
    const spawnOrigins =
      config.spawnPoints && config.spawnPoints.length > 0
        ? config.spawnPoints
        : (config.playerUnits ?? []).map((unit) => unit.position);
    const unitPositions = spawnOrigins.map((origin) =>
      this.clampToMap(origin, config.size)
    );
    const bricks = buildBricksFromBlueprints(config.bricks).map((brick) => ({
      position: this.clampToMap(brick.position, config.size),
      rotation: brick.rotation,
      type: brick.type,
    }));

    if (unitPositions.length === 0 || PLAYER_UNIT_SPAWN_SAFE_RADIUS <= 0) {
      return bricks;
    }

    const safetyRadiusSq = PLAYER_UNIT_SPAWN_SAFE_RADIUS * PLAYER_UNIT_SPAWN_SAFE_RADIUS;
    return bricks.filter((brick) =>
      unitPositions.every((unit) => {
        const dx = brick.position.x - unit.x;
        const dy = brick.position.y - unit.y;
        return dx * dx + dy * dy >= safetyRadiusSq;
      })
    );
  }

  private generatePlayerUnits(config: MapConfig): PlayerUnitSpawnData[] {
    if (!config.playerUnits) {
      return [];
    }
    const spawnPoints = (config.spawnPoints ?? []).map((point) =>
      this.clampToMap(point, config.size)
    );
    return config.playerUnits.map((unit, index) => {
      const fallback = this.clampToMap(unit.position, config.size);
      const spawnPoint =
        spawnPoints.length > 0
          ? spawnPoints[index % spawnPoints.length]
          : undefined;
      return {
        type: unit.type,
        position: spawnPoint ?? fallback,
      };
    });
  }

  private getSpawnPoints(
    config: MapConfig,
    units: PlayerUnitSpawnData[]
  ): SceneVector2[] {
    if (config.spawnPoints && config.spawnPoints.length > 0) {
      return config.spawnPoints.map((point) =>
        this.clampToMap(point, config.size)
      );
    }
    return units.map((unit) => unit.position);
  }

  private clampToMap(position: SceneVector2, size: SceneSize): SceneVector2 {
    return {
      x: clamp(position.x, 0, size.width),
      y: clamp(position.y, 0, size.height),
    };
  }

  private pushMapList(): void {
    const list = this.getAvailableMaps();
    this.options.bridge.setValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY, list);
  }

  private pushSelectedMap(): void {
    this.options.bridge.setValue<MapId | null>(MAP_SELECTED_BRIDGE_KEY, this.selectedMapId);
  }

  private parseSaveData(data: unknown): MapSaveData | null {
    if (typeof data !== "object" || data === null) {
      return null;
    }
    const raw = data as { mapId?: unknown; stats?: unknown };
    if (!raw.mapId || !isMapId(raw.mapId)) {
      return null;
    }
    const stats = this.parseStats(raw.stats);
    return { mapId: raw.mapId, stats };
  }

  private resolveSelectableMapId(preferred: MapId | null): MapId | null {
    if (preferred && this.isMapSelectable(preferred)) {
      return preferred;
    }
    if (this.isMapSelectable(DEFAULT_MAP_ID)) {
      return DEFAULT_MAP_ID;
    }
    const available = this.getAvailableMaps();
    return available.length > 0 ? available[0]!.id : null;
  }

  private isMapSelectable(mapId: MapId): boolean {
    return this.unlocks.isUnlocked({ type: "map", id: mapId, level: 0 });
  }

  private getAvailableMaps(): MapListEntry[] {
    return getMapList()
      .filter((map) => this.isMapSelectable(map.id))
      .map((map) => this.createListEntry(map));
  }

  private createListEntry(map: MapListEntryConfig): MapListEntry {
    const currentLevel = this.getHighestUnlockedLevel(map.id);
    const attempts = this.getAttemptsForLevel(map.id, currentLevel);
    return {
      ...map,
      currentLevel,
      attempts,
    };
  }

  private getHighestUnlockedLevel(mapId: MapId): number {
    let level = 0;
    const maxIterations = 100;
    while (level < maxIterations) {
      const nextLevel = level + 1;
      if (!this.unlocks.isUnlocked({ type: "map", id: mapId, level: nextLevel })) {
        break;
      }
      level = nextLevel;
    }
    return level;
  }

  private getAttemptsForLevel(mapId: MapId, level: number): number {
    const stats = this.mapStats[mapId];
    if (!stats) {
      return 0;
    }
    const entry = stats[level];
    if (!entry) {
      return 0;
    }
    return entry.success + entry.failure;
  }

  private parseStats(data: unknown): MapStats {
    if (typeof data !== "object" || data === null) {
      return {};
    }
    const result: MapStats = {};
    Object.entries(data as Record<string, unknown>).forEach(([mapId, value]) => {
      if (!isMapId(mapId) || typeof value !== "object" || value === null) {
        return;
      }
      const levels: Record<number, MapLevelStats> = {};
      Object.entries(value as Record<string, unknown>).forEach(([levelKey, statsValue]) => {
        const parsed = Number(levelKey);
        if (!Number.isFinite(parsed) || typeof statsValue !== "object" || statsValue === null) {
          return;
        }
        const level = sanitizeLevel(parsed);
        const stats = this.parseLevelStats(statsValue as Record<string, unknown>);
        levels[level] = stats;
      });
      if (Object.keys(levels).length > 0) {
        result[mapId as MapId] = levels;
      }
    });
    return result;
  }

  private parseLevelStats(data: Record<string, unknown>): MapLevelStats {
    const success = sanitizeCount(data.success);
    const failure = sanitizeCount(data.failure);
    return { success, failure };
  }

  private ensureLevelStats(mapId: MapId, level: number): MapLevelStats {
    if (!this.mapStats[mapId]) {
      this.mapStats[mapId] = {};
    }
    const sanitizedLevel = sanitizeLevel(level);
    const mapEntry = this.mapStats[mapId]!;
    if (!mapEntry[sanitizedLevel]) {
      mapEntry[sanitizedLevel] = { success: 0, failure: 0 };
    }
    return mapEntry[sanitizedLevel]!;
  }

  private cloneStats(): MapStats {
    const clone: MapStats = {};
    Object.entries(this.mapStats).forEach(([mapId, levels]) => {
      if (!levels) {
        return;
      }
      const levelClone: Record<number, MapLevelStats> = {};
      Object.entries(levels).forEach(([levelKey, stats]) => {
        const parsed = Number(levelKey);
        if (!Number.isFinite(parsed)) {
          return;
        }
        const level = sanitizeLevel(parsed);
        levelClone[level] = { success: stats.success, failure: stats.failure };
      });
      clone[mapId as MapId] = levelClone;
    });
    return clone;
  }
}

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isFinite(value)) {
    if (min > max) {
      return min;
    }
    return Math.min(Math.max(value, min), max);
  }
  return min;
};

const sanitizeLevel = (value: unknown): number => {
  if (!Number.isFinite(value as number)) {
    return 0;
  }
  const level = Math.floor(Number(value));
  return Math.max(level, 0);
};

const sanitizeCount = (value: unknown): number => {
  if (!Number.isFinite(value as number)) {
    return 0;
  }
  return Math.max(0, Math.floor(Number(value)));
};
