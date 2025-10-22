import { DataBridge } from "../../core/DataBridge";
import { GameModule } from "../../core/types";
import { SceneObjectManager, SceneSize, FILL_TYPES } from "../../services/SceneObjectManager";
import { BricksModule, BrickData } from "./BricksModule";
import {
  PlayerUnitsModule,
  PlayerUnitSpawnData,
} from "./PlayerUnitsModule";
import { NecromancerModule } from "./NecromancerModule";
import { UnlockService } from "../../services/UnlockService";
import {
  MapConfig,
  MapId,
  MapListEntry as MapListEntryConfig,
  getMapConfig,
  getMapList,
  isMapId,
} from "../../../db/maps-db";
import { SceneVector2 } from "../../services/SceneObjectManager";
import { SkillId } from "../../../db/skills-db";
import { buildBricksFromBlueprints } from "../../services/BrickLayoutService";
import { UnitAutomationModule } from "./UnitAutomationModule";

interface ResourceRunController {
  startRun(): void;
  cancelRun(): void;
}

export const MAP_LIST_BRIDGE_KEY = "maps/list";
export const MAP_SELECTED_BRIDGE_KEY = "maps/selected";
export const MAP_SELECTED_LEVEL_BRIDGE_KEY = "maps/selectedLevel";

interface MapModuleOptions {
  scene: SceneObjectManager;
  bridge: DataBridge;
  bricks: BricksModule;
  playerUnits: PlayerUnitsModule;
  necromancer: NecromancerModule;
  resources: ResourceRunController;
  unlocks: UnlockService;
  unitsAutomation: UnitAutomationModule;
  getSkillLevel: (id: SkillId) => number;
  onRunCompleted: (success: boolean) => void;
}

interface MapSaveData {
  mapId: MapId;
  mapLevel?: number;
  stats?: MapStats;
  selectedLevels?: Partial<Record<MapId, number>>;
  autoRestartEnabled?: boolean;
  autoRestartThresholdEnabled?: boolean;
  autoRestartMinEffectiveUnits?: number;
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
  readonly thresholdEnabled?: boolean; // enable early restart logic
  readonly minEffectiveUnits?: number; // restart if alive + affordable < N
}

export const MAP_AUTO_RESTART_BRIDGE_KEY = "maps/autoRestart";

export const DEFAULT_MAP_AUTO_RESTART_STATE: MapAutoRestartState = Object.freeze({
  unlocked: false,
  enabled: false,
  thresholdEnabled: false,
  minEffectiveUnits: 3,
});

const DEFAULT_MAP_ID: MapId = "foundations";
export const PLAYER_UNIT_SPAWN_SAFE_RADIUS = 150;
const AUTO_RESTART_SKILL_ID: SkillId = "autorestart_rituals";

export class MapModule implements GameModule {
  public readonly id = "maps";

  private selectedMapId: MapId | null = null;
  private readonly unlocks: UnlockService;
  private readonly getSkillLevel: (id: SkillId) => number;
  private mapStats: MapStats = {};
  // Cached deep-clone of mapStats for read-only consumers (e.g., UnlockService)
  private statsCloneCache: MapStats | null = null;
  private statsCloneDirty = true;
  private selectedMapLevel = 0;
  private activeMapLevel = 0;
  private runActive = false;
  private mapSelectedLevels: Partial<Record<MapId, number>> = {};
  private autoRestartUnlocked = false;
  private autoRestartEnabled = false;
  private thresholdEnabled = false;
  private minEffectiveUnits = 3;
  private portalObjects: { id: string; position: SceneVector2 }[] = [];

  constructor(private readonly options: MapModuleOptions) {
    this.unlocks = options.unlocks;
    this.getSkillLevel = options.getSkillLevel;
  }

  public initialize(): void {
    this.refreshAutoRestartState();
    this.pushAutoRestartState();
    this.pushMapList();
    this.ensureSelection();
  }

  public reset(): void {
    this.autoRestartEnabled = false;
    this.thresholdEnabled = false;
    this.minEffectiveUnits = 3;
    this.runActive = false;
    this.refreshAutoRestartState();
    this.pushAutoRestartState();
    this.ensureSelection();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    this.mapStats = parsed?.stats ?? {};
    this.mapSelectedLevels = parsed?.selectedLevels ?? {};
    this.autoRestartEnabled = Boolean(parsed?.autoRestartEnabled);
    // stats changed from save → invalidate cached clone
    this.statsCloneDirty = true;
    this.refreshAutoRestartState();
    this.pushAutoRestartState();
    this.pushMapList();

    const savedMapId = parsed?.mapId;
    if (savedMapId && this.isMapSelectable(savedMapId)) {
      this.selectedMapId = savedMapId;
      if (typeof parsed?.mapLevel === "number") {
        this.mapSelectedLevels[savedMapId] = this.clampLevelToUnlocked(
          savedMapId,
          parsed.mapLevel
        );
      }
    } else {
      this.selectedMapId = null;
    }
    this.ensureSelection();
  }

  public save(): unknown {
    return {
      mapId: this.selectedMapId ?? DEFAULT_MAP_ID,
      mapLevel: this.selectedMapLevel,
      stats: this.cloneStats(),
      selectedLevels: this.cloneSelectedLevels(),
      autoRestartEnabled: this.autoRestartEnabled,
      autoRestartThresholdEnabled: this.thresholdEnabled,
      autoRestartMinEffectiveUnits: this.minEffectiveUnits,
    } satisfies MapSaveData;
  }

  public tick(_deltaMs: number): void {
    const changed = this.refreshAutoRestartState();
    if (changed) {
      this.pushAutoRestartState();
    }
    // Early end-of-run check: when enabled, if alive + affordable < N, end the run (failure)
    if (this.autoRestartEnabled && this.thresholdEnabled && this.selectedMapId && this.runActive) {
      const alive = this.options.playerUnits.getCurrentUnitCount();
      const affordable = this.options.necromancer.getAffordableSpawnCountBySanity();
      const effective = alive + affordable;
      if (effective < Math.max(0, Math.floor(this.minEffectiveUnits))) {
        // Trigger run completion (failure) once per run
        this.runActive = false;
        this.options.onRunCompleted(false);
      }
    }
    // Drive portal emitter updates like explosions do (explosions call updateObject every tick)
    if (this.portalObjects.length > 0) {
      this.portalObjects.forEach((portal) => {
        this.options.scene.updateObject(portal.id, {
          position: { x: portal.position.x, y: portal.position.y },
        });
      });
    }
  }

  public selectMap(mapId: MapId): void {
    if (!isMapId(mapId) || !this.isMapSelectable(mapId)) {
      return;
    }
    this.updateSelection(mapId);
  }

  public selectMapLevel(mapId: MapId, level: number): void {
    if (!isMapId(mapId) || !this.isMapSelectable(mapId)) {
      return;
    }
    const clamped = this.clampLevelToUnlocked(mapId, level);
    this.mapSelectedLevels[mapId] = clamped;

    if (this.selectedMapId === mapId) {
      if (this.selectedMapLevel === clamped) {
        this.pushMapList();
        this.pushSelectedMapLevel();
        return;
      }
      this.selectedMapLevel = clamped;
      this.pushSelectedMapLevel();
      this.pushMapList();
      return;
    }

    this.pushMapList();
  }

  public restartSelectedMap(): void {
    if (!this.selectedMapId) {
      return;
    }
    this.startSelectedMap({ generateBricks: true, generateUnits: true });
  }

  public leaveCurrentMap(): void {
    this.activeMapLevel = 0;
    this.runActive = false;
    this.options.resources.cancelRun();
    this.options.playerUnits.setUnits([]);
    this.options.bricks.setBricks([]);
    this.options.unitsAutomation.onMapEnd();
    // Remove portals
    this.portalObjects.forEach((p) => this.options.scene.removeObject(p.id));
    this.portalObjects = [];
    this.options.necromancer.endCurrentMap();
    this.pushSelectedMap();
    this.pushSelectedMapLevel();
    this.pushMapList();
  }

  public setAutoRestartEnabled(enabled: boolean): void {
    const unlockChanged = this.refreshAutoRestartState();
    if (!this.autoRestartUnlocked) {
      if (unlockChanged) {
        this.pushAutoRestartState();
      }
      return;
    }
    const next = Boolean(enabled);
    if (this.autoRestartEnabled === next) {
      if (unlockChanged) {
        this.pushAutoRestartState();
      }
      return;
    }
    this.autoRestartEnabled = next;
    this.pushAutoRestartState();
  }

  public setAutoRestartThreshold(enabled: boolean, minEffectiveUnits: number): void {
    const unlockChanged = this.refreshAutoRestartState();
    if (!this.autoRestartUnlocked) {
      if (unlockChanged) {
        this.pushAutoRestartState();
      }
      return;
    }
    const nextEnabled = Boolean(enabled);
    const nextMin = Math.max(0, Math.floor(minEffectiveUnits));
    let changed = unlockChanged;
    if (this.thresholdEnabled !== nextEnabled) {
      this.thresholdEnabled = nextEnabled;
      changed = true;
    }
    if (this.minEffectiveUnits !== nextMin) {
      this.minEffectiveUnits = nextMin;
      changed = true;
    }
    if (changed) {
      this.pushAutoRestartState();
    }
  }

  public recordRunResult(result: MapRunResult): void {
    const mapId = result.mapId && isMapId(result.mapId) ? result.mapId : this.selectedMapId;
    if (!mapId) {
      return;
    }
    const level =
      result.level !== undefined
        ? sanitizeLevel(result.level)
        : this.getActiveLevelForMap(mapId);
    const stats = this.ensureLevelStats(mapId, level);
    if (result.success) {
      stats.success += 1;
      const duration = sanitizeDuration(result.durationMs);
      if (duration !== null) {
        if (stats.bestTimeMs === null || duration < stats.bestTimeMs) {
          stats.bestTimeMs = duration;
        }
      }
    } else {
      stats.failure += 1;
    }
    // stats mutated → invalidate cached clone
    this.statsCloneDirty = true;
    this.pushMapList();
    this.pushSelectedMap();
    this.pushSelectedMapLevel();
  }

  public getMapStats(): MapStats {
    return this.cloneStats();
  }

  public isRunActive(): boolean {
    return this.runActive;
  }

  private ensureSelection(): void {
    const mapId = this.resolveSelectableMapId(this.selectedMapId);
    if (!mapId) {
      this.selectedMapId = null;
      this.selectedMapLevel = 0;
      this.activeMapLevel = 0;
      this.pushSelectedMap();
      this.pushSelectedMapLevel();
      this.pushMapList();
      return;
    }
    this.updateSelection(mapId);
  }

  private startSelectedMap(options: {
    generateBricks: boolean;
    generateUnits: boolean;
  }): void {
    const mapId = this.selectedMapId;
    if (!mapId) {
      return;
    }
    const { generateBricks, generateUnits } = options;
    const config = getMapConfig(mapId);
    const level = this.getSelectedLevel(mapId);
    this.mapSelectedLevels[mapId] = level;
    this.selectedMapLevel = level;
    this.activeMapLevel = level;
    this.runActive = true;
    this.options.unitsAutomation.onMapStart();
    this.options.scene.setMapSize(config.size);
    this.options.playerUnits.prepareForMap();
    // Clear existing portals if any (e.g., on restart)
    if (this.portalObjects.length > 0) {
      this.portalObjects.forEach((p) => this.options.scene.removeObject(p.id));
      this.portalObjects = [];
    }
    if (generateBricks) {
      const bricks = this.generateBricks(config, level);
      this.options.bricks.setBricks(bricks);
    }
    const spawnUnits = this.generatePlayerUnits(config);
    const spawnPoints = this.getSpawnPoints(config, spawnUnits);

    if (generateUnits) {
      this.options.playerUnits.setUnits(spawnUnits);
    }

    this.options.necromancer.configureForMap({
      spawnPoints,
    });

    // Spawn portals at each spawn point as visual indicators
    spawnPoints.forEach((point) => {
      const id = this.options.scene.addObject("portal", {
        position: { x: point.x, y: point.y },
        size: { width: 90, height: 90 },
        fill: {
          fillType: FILL_TYPES.RADIAL_GRADIENT,
          start: { x: 0, y: 0 },
          end: 45,
          stops: [
            { offset: 0, color: { r: 0.4, g: 0.5, b: 0.6, a: 0.15 } },
            { offset: 0.55, color: { r: 0.4, g: 0.7, b: 0.7, a: 0.05 } },
            { offset: 0.65, color: { r: 0.4, g: 0.9, b: 0.9, a: 0.65 } },
            { offset: 0.75, color: { r: 0.4, g: 0.9, b: 0.9, a: 0.75 } },
            { offset: 0.8, color: { r: 0.25, g: 0.9, b: 0.9, a: 0.8 } },
            { offset: 0.85, color: { r: 0.25, g: 0.9, b: 0.9, a: 0.8 } },
            { offset: 1, color: { r: 0.15, g: 0.7, b: 0.7, a: 0 } },
          ],
        },
        rotation: 0,
        customData: {
          radius: 45,
          emitter: {
            particlesPerSecond: 90,
            particleLifetimeMs: 900,
            fadeStartMs: 750,
            sizeRange: { min: 1, max: 3 },
            offset: { x: 0, y: 0 },
            color: { r: 0.4, g: 0.8, b: 0.8, a: 0.6 },
            shape: "circle",
            maxParticles: 120,
            baseSpeed: 0.03,
            speedVariation: 0.01,
          },
        },
      });
      this.portalObjects.push({ id, position: { ...point } });
    });

    this.options.resources.startRun();

    this.pushSelectedMap();
    this.pushSelectedMapLevel();
    this.pushMapList();
  }

  private updateSelection(mapId: MapId): void {
    const level = this.getSelectedLevel(mapId);
    this.selectedMapId = mapId;
    this.mapSelectedLevels[mapId] = level;
    this.selectedMapLevel = level;
    this.pushSelectedMap();
    this.pushSelectedMapLevel();
    this.pushMapList();
  }

  private refreshAutoRestartState(): boolean {
    const unlocked = this.getSkillLevel(AUTO_RESTART_SKILL_ID) > 0;
    let changed = false;
    if (this.autoRestartUnlocked !== unlocked) {
      this.autoRestartUnlocked = unlocked;
      changed = true;
    }
    if (!unlocked && this.autoRestartEnabled) {
      this.autoRestartEnabled = false;
      changed = true;
    }
    return changed;
  }

  private pushAutoRestartState(): void {
    this.options.bridge.setValue<MapAutoRestartState>(
      MAP_AUTO_RESTART_BRIDGE_KEY,
      {
        unlocked: this.autoRestartUnlocked,
        enabled: this.autoRestartUnlocked && this.autoRestartEnabled,
        thresholdEnabled: this.thresholdEnabled,
        minEffectiveUnits: this.minEffectiveUnits,
      }
    );
  }

  private generateBricks(config: MapConfig, mapLevel: number): BrickData[] {
    const spawnOrigins =
      config.spawnPoints && config.spawnPoints.length > 0
        ? config.spawnPoints
        : (config.playerUnits ?? []).map((unit) => unit.position);
    const unitPositions = spawnOrigins.map((origin) =>
      this.clampToMap(origin, config.size)
    );
    const bricks = buildBricksFromBlueprints(config.bricks({ mapLevel })).map((brick) => ({
      position: this.clampToMap(brick.position, config.size),
      rotation: brick.rotation,
      type: brick.type,
      level: brick.level,
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
    // Ensure unlock checks are fresh (map stats/skills may have just changed)
    this.unlocks.clearCache();
    const list = this.getAvailableMaps();
    this.options.bridge.setValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY, list);
  }

  private pushSelectedMap(): void {
    this.options.bridge.setValue<MapId | null>(MAP_SELECTED_BRIDGE_KEY, this.selectedMapId);
  }

  private pushSelectedMapLevel(): void {
    const level = this.selectedMapId ? this.selectedMapLevel : 0;
    this.options.bridge.setValue<number>(MAP_SELECTED_LEVEL_BRIDGE_KEY, level);
  }

  private parseSaveData(data: unknown): MapSaveData | null {
    if (typeof data !== "object" || data === null) {
      return null;
    }
    const raw = data as {
      mapId?: unknown;
      stats?: unknown;
      mapLevel?: unknown;
      selectedLevels?: unknown;
      autoRestartEnabled?: unknown;
      autoRestartThresholdEnabled?: unknown;
      autoRestartMinEffectiveUnits?: unknown;
    };
    if (!raw.mapId || !isMapId(raw.mapId)) {
      return null;
    }
    const stats = this.parseStats(raw.stats);
    const mapLevel = typeof raw.mapLevel === "number" ? sanitizeLevel(raw.mapLevel) : undefined;
    const selectedLevels = this.parseSelectedLevels(raw.selectedLevels);
    const autoRestartEnabled = raw.autoRestartEnabled === true;
    const autoRestartThresholdEnabled = raw.autoRestartThresholdEnabled === true;
    this.thresholdEnabled = autoRestartThresholdEnabled;
    if (Object.prototype.hasOwnProperty.call(raw, "autoRestartMinEffectiveUnits")) {
      const autoRestartMinEffectiveUnits = sanitizeLevel(raw.autoRestartMinEffectiveUnits);
      this.minEffectiveUnits = Math.max(0, autoRestartMinEffectiveUnits);
    }
    return { mapId: raw.mapId, mapLevel, stats, selectedLevels, autoRestartEnabled };
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
    const selectedLevel = this.getSelectedLevel(map.id);
    const attempts = this.getAttemptsForLevel(map.id, selectedLevel);
    const bestTimeMs = this.getBestTimeForLevel(map.id, selectedLevel);
    return {
      ...map,
      currentLevel,
      selectedLevel,
      attempts,
      bestTimeMs,
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

  private getSelectedLevel(mapId: MapId): number {
    const stored = this.mapSelectedLevels[mapId];
    const storedLevel = typeof stored === "number" ? sanitizeLevel(stored) : undefined;
    const highest = this.getHighestUnlockedLevel(mapId);
    if (storedLevel === undefined) {
      return highest;
    }
    return clamp(storedLevel, 0, highest);
  }

  private clampLevelToUnlocked(mapId: MapId, level: number): number {
    const sanitized = sanitizeLevel(level);
    const highest = this.getHighestUnlockedLevel(mapId);
    return clamp(sanitized, 0, highest);
  }

  private getActiveLevelForMap(mapId: MapId): number {
    if (mapId === this.selectedMapId) {
      return this.activeMapLevel;
    }
    return this.getSelectedLevel(mapId);
  }

  private getAttemptsForLevel(mapId: MapId, level: number): number {
    const stats = this.mapStats[mapId];
    if (!stats) {
      return 0;
    }
    const sanitizedLevel = sanitizeLevel(level);
    const entry = stats[sanitizedLevel];
    if (!entry) {
      return 0;
    }
    return entry.success + entry.failure;
  }

  private getBestTimeForLevel(mapId: MapId, level: number): number | null {
    const stats = this.mapStats[mapId];
    if (!stats) {
      return null;
    }
    const sanitizedLevel = sanitizeLevel(level);
    const entry = stats[sanitizedLevel];
    if (!entry) {
      return null;
    }
    const { bestTimeMs } = entry;
    if (bestTimeMs === null || bestTimeMs === undefined) {
      return null;
    }
    return bestTimeMs;
  }

  private parseSelectedLevels(data: unknown): Partial<Record<MapId, number>> {
    if (typeof data !== "object" || data === null) {
      return {};
    }
    const levels: Partial<Record<MapId, number>> = {};
    Object.entries(data as Record<string, unknown>).forEach(([mapId, value]) => {
      if (!isMapId(mapId)) {
        return;
      }
      levels[mapId] = sanitizeLevel(value);
    });
    return levels;
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
    const bestTimeMs = sanitizeDuration(data.bestTimeMs);
    return { success, failure, bestTimeMs };
  }

  private ensureLevelStats(mapId: MapId, level: number): MapLevelStats {
    if (!this.mapStats[mapId]) {
      this.mapStats[mapId] = {};
    }
    const sanitizedLevel = sanitizeLevel(level);
    const mapEntry = this.mapStats[mapId]!;
    if (!mapEntry[sanitizedLevel]) {
      mapEntry[sanitizedLevel] = { success: 0, failure: 0, bestTimeMs: null };
      return mapEntry[sanitizedLevel]!;
    }
    const entry = mapEntry[sanitizedLevel]!;
    if (entry.bestTimeMs === undefined) {
      entry.bestTimeMs = null;
    }
    return entry;
  }

  private cloneSelectedLevels(): Partial<Record<MapId, number>> {
    const clone: Partial<Record<MapId, number>> = {};
    Object.entries(this.mapSelectedLevels).forEach(([mapId, level]) => {
      if (!isMapId(mapId) || typeof level !== "number") {
        return;
      }
      clone[mapId as MapId] = sanitizeLevel(level);
    });
    return clone;
  }

  private cloneStats(): MapStats {
    if (!this.statsCloneDirty && this.statsCloneCache) {
      return this.statsCloneCache;
    }
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
        levelClone[level] = {
          success: stats.success,
          failure: stats.failure,
          bestTimeMs:
            stats.bestTimeMs === undefined ? null : stats.bestTimeMs,
        };
      });
      clone[mapId as MapId] = levelClone;
    });
    this.statsCloneCache = clone;
    this.statsCloneDirty = false;
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

const sanitizeDuration = (value: unknown): number | null => {
  if (!Number.isFinite(value as number)) {
    return null;
  }
  const duration = Math.floor(Number(value));
  if (duration < 0) {
    return null;
  }
  return duration;
};
