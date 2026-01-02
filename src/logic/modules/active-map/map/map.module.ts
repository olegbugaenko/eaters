import { GameModule } from "../../../core/types";
import { SceneSize, SceneVector2 } from "../../../services/SceneObjectManager";
import { BrickData } from "../bricks/bricks.module";
import { PlayerUnitSpawnData } from "../player-units/player-units.module";
import {
  MapConfig,
  MapId,
  MapListEntry as MapListEntryConfig,
  getMapConfig,
  getMapList,
  isMapId,
} from "../../../../db/maps-db";
import { buildBricksFromBlueprints } from "../../../services/BrickLayoutService";
import { MapSelectionState } from "./map.selection";
import { MapVisualEffects } from "./map.visual-effects";
import { MapRunLifecycle } from "./map.run-lifecycle";
import {
  MapAutoRestartState,
  MapLevelStats,
  MapListEntry,
  MapModuleOptions,
  MapRunResult,
  MapSaveData,
  MapStats,
} from "./map.types";
import { SkillId } from "../../../../db/skills-db";
import { MapRunEvent } from "./MapRunState";
import { MapSceneCleanup, MapSceneCleanupContract } from "./map.scene-cleanup";

export const MAP_LIST_BRIDGE_KEY = "maps/list";
export const MAP_SELECTED_BRIDGE_KEY = "maps/selected";
export const MAP_SELECTED_LEVEL_BRIDGE_KEY = "maps/selectedLevel";
export const MAP_CLEARED_LEVELS_BRIDGE_KEY = "maps/clearedLevelsTotal";
export const MAP_LAST_PLAYED_BRIDGE_KEY = "maps/lastPlayed";

export const MAP_AUTO_RESTART_BRIDGE_KEY = "maps/autoRestart";

export const DEFAULT_MAP_AUTO_RESTART_STATE: MapAutoRestartState = Object.freeze({
  unlocked: false,
  enabled: false,
});

const DEFAULT_MAP_ID: MapId = "foundations";
export const PLAYER_UNIT_SPAWN_SAFE_RADIUS = 150;
const AUTO_RESTART_SKILL_ID: SkillId = "autorestart_rituals";
const BONUS_CONTEXT_CLEARED_LEVELS = "clearedMapLevelsTotal";

export class MapModule implements GameModule {
  public readonly id = "maps";

  private readonly selection: MapSelectionState;
  private readonly runLifecycle: MapRunLifecycle;
  private readonly unlocks;
  private readonly getSkillLevel;
  private mapStats: MapStats = {};
  // Cached deep-clone of mapStats for read-only consumers (e.g., UnlockService)
  private statsCloneCache: MapStats | null = null;
  private statsCloneDirty = true;
  private autoRestartUnlocked = false;
  private autoRestartEnabled = false;
  private readonly options: MapModuleOptions;
  private readonly sceneCleanup: MapSceneCleanupContract;

  constructor(options: MapModuleOptions) {
    this.options = options;
    this.sceneCleanup = options.sceneCleanup;
    this.unlocks = options.unlocks;
    this.getSkillLevel = options.getSkillLevel;
    this.selection = new MapSelectionState(DEFAULT_MAP_ID);
    const visuals = new MapVisualEffects(options.scene);
    this.runLifecycle = new MapRunLifecycle({
      runState: options.runState,
      resources: options.resources,
      playerUnits: options.playerUnits,
      bricks: options.bricks,
      unitsAutomation: options.unitsAutomation,
      arcs: options.arcs,
      necromancer: options.necromancer,
      visuals,
      scene: options.scene,
    });

    options.runState.subscribe((event) => this.handleRunStateEvent(event));
  }

  public initialize(): void {
    this.runLifecycle.reset();
    this.refreshAutoRestartState();
    this.pushAutoRestartState();
    this.pushMapList();
    this.ensureSelection();
  }

  public reset(): void {
    this.runLifecycle.reset();
    this.autoRestartEnabled = false;
    this.refreshAutoRestartState();
    this.pushAutoRestartState();
    this.ensureSelection();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    this.mapStats = parsed?.stats ?? {};
    this.selection.loadFromSave(parsed);
    this.autoRestartEnabled = Boolean(parsed?.autoRestartEnabled);
    // stats changed from save → invalidate cached clone
    this.statsCloneDirty = true;
    this.refreshAutoRestartState();
    this.pushAutoRestartState();
    this.pushMapList();
    this.pushLastPlayedMap();

    this.selection.applySavedSelection(
      parsed?.mapId ?? null,
      parsed?.mapLevel,
      (mapId) => this.isMapSelectable(mapId),
      (mapId, level) => this.clampLevelToUnlocked(mapId, level)
    );
    this.ensureSelection();
  }

  public save(): unknown {
    return {
      mapId: this.selection.getSelectedMapId() ?? DEFAULT_MAP_ID,
      mapLevel: serializeLevel(this.selection.getSelectedMapLevel()),
      stats: this.cloneStatsForSave(),
      selectedLevels: this.cloneSelectedLevels(),
      autoRestartEnabled: this.autoRestartEnabled,
      lastPlayedMap: this.selection.getLastPlayedMap()
        ? {
            mapId: this.selection.getLastPlayedMap()!.mapId,
            level: serializeLevel(this.selection.getLastPlayedMap()!.level),
          }
        : undefined,
    } satisfies MapSaveData;
  }

  public tick(_deltaMs: number): void {
    if (!this.options.runState.shouldProcessTick()) {
      return;
    }
    this.runLifecycle.tick();
    const changed = this.refreshAutoRestartState();
    if (changed) {
      this.pushAutoRestartState();
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
    this.selection.setSelectedLevel(mapId, clamped);

    if (this.selection.getSelectedMapId() === mapId) {
      if (this.selection.getSelectedMapLevel() === clamped) {
        this.pushMapList();
        this.pushSelectedMapLevel();
        return;
      }
      this.selection.updateSelection(mapId, clamped);
      this.pushSelectedMapLevel();
      this.pushMapList();
      return;
    }

    this.pushMapList();
  }

  public restartSelectedMap(): void {
    if (!this.selection.getSelectedMapId()) {
      return;
    }
    this.runLifecycle.cleanupActiveMap();
    this.options.runState.reset();
    this.startSelectedMap({ generateBricks: true, generateUnits: true });
  }

  public leaveCurrentMap(): void {
    // Save last played map before leaving
    const selectedMapId = this.selection.getSelectedMapId();
    if (selectedMapId !== null) {
      const level =
        this.runLifecycle.getActiveMapLevel() > 0
          ? this.runLifecycle.getActiveMapLevel()
          : this.selection.getSelectedMapLevel();
      this.selection.recordLastPlayed(selectedMapId, level);
      this.pushLastPlayedMap();
    }
    this.runLifecycle.cleanupActiveMap();
    this.options.runState.reset();
    this.pushSelectedMap();
    this.pushSelectedMapLevel();
    this.pushMapList();
  }

  public isAutoRestartEnabled(): boolean {
    return this.autoRestartEnabled;
  }

  public pauseActiveMap(): void {
    this.runLifecycle.pause();
  }

  public resumeActiveMap(): void {
    this.runLifecycle.resume();
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

  public recordRunResult(result: MapRunResult): void {
    const mapId =
      result.mapId && isMapId(result.mapId) ? result.mapId : this.selection.getSelectedMapId();
    if (!mapId) {
      return;
    }
    const level =
      result.level !== undefined
        ? sanitizeLevel(result.level)
        : sanitizeLevel(this.getActiveLevelForMap(mapId));
    // Save last played map
    this.selection.recordLastPlayed(mapId, level);
    this.pushLastPlayedMap();
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
    this.runLifecycle.completeRun();
    this.pushMapList();
    this.pushSelectedMap();
    this.pushSelectedMapLevel();
  }

  public handleAllUnitsDefeated(): void {
    if (this.options.necromancer.isSanityDepleted()) {
      this.options.runState.complete(false);
    }
  }

  public getMapStats(): MapStats {
    return this.cloneStats();
  }

  public isRunActive(): boolean {
    return this.runLifecycle.isRunActive();
  }

  private ensureSelection(): void {
    const mapId = this.resolveSelectableMapId(this.selection.getSelectedMapId());
    if (!mapId) {
      this.selection.clearSelection();
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
    const mapId = this.selection.getSelectedMapId();
    if (!mapId) {
      return;
    }
    const { generateBricks, generateUnits } = options;
    const config = getMapConfig(mapId);
    const level = this.getSelectedLevel(mapId);
    this.selection.updateSelection(mapId, level);
    this.selection.recordLastPlayed(mapId, level);
    this.pushLastPlayedMap();
    const bricks = this.generateBricks(config, level);
    const spawnUnits = this.generatePlayerUnits(config);
    const spawnPoints = this.getSpawnPoints(config, spawnUnits);

    this.runLifecycle.startRun({
      level,
      sceneSize: config.size,
      bricks,
      spawnUnits,
      spawnPoints,
      generateBricks,
      generateUnits,
    });

    this.pushSelectedMap();
    this.pushSelectedMapLevel();
    this.pushMapList();
  }

  private handleMapRunCompleted(success: boolean): void {
    const { resources } = this.options;
    if (resources.isRunSummaryAvailable()) {
      return;
    }
    const durationMs = resources.getRunDurationMs();
    this.recordRunResult({ success, durationMs });
    resources.finishRun();
  }

  private handleRunStateEvent(event: MapRunEvent): void {
    if (event.type === "reset") {
      this.sceneCleanup.resetAfterRun();
      return;
    }
    if (event.type === "complete") {
      this.handleMapRunCompleted(event.success);
    }
  }

  private updateSelection(mapId: MapId): void {
    const level = this.getSelectedLevel(mapId);
    this.selection.updateSelection(mapId, level);
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

  private pushClearedLevelsTotal(): void {
    const total = this.getTotalClearedLevels();
    this.options.bridge.setValue<number>(MAP_CLEARED_LEVELS_BRIDGE_KEY, total);
    this.options.bonuses.setEffectContext({
      [BONUS_CONTEXT_CLEARED_LEVELS]: total,
    });
  }

  private pushMapList(): void {
    // Ensure unlock checks are fresh (map stats/skills may have just changed)
    this.unlocks.clearCache();
    const list = this.getAvailableMaps();
    this.pushClearedLevelsTotal();
    this.options.bridge.setValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY, list);
  }

  private pushSelectedMap(): void {
    this.options.bridge.setValue<MapId | null>(
      MAP_SELECTED_BRIDGE_KEY,
      this.selection.getSelectedMapId()
    );
  }

  private pushSelectedMapLevel(): void {
    const level = this.selection.getSelectedMapId() ? this.selection.getSelectedMapLevel() : 0;
    this.options.bridge.setValue<number>(MAP_SELECTED_LEVEL_BRIDGE_KEY, level);
  }

  private pushLastPlayedMap(): void {
    this.options.bridge.setValue<{ mapId: MapId; level: number } | null>(
      MAP_LAST_PLAYED_BRIDGE_KEY,
      this.selection.getLastPlayedMap()
    );
  }

  private parseSaveData(data: unknown): MapSaveData | undefined {
    if (typeof data !== "object" || data === null) {
      return undefined;
    }
    const raw = data as {
      mapId?: unknown;
      stats?: unknown;
      mapLevel?: unknown;
      selectedLevels?: unknown;
      autoRestartEnabled?: unknown;
      lastPlayedMap?: unknown;
    };
    if (!raw.mapId || !isMapId(raw.mapId)) {
      return undefined;
    }
    const stats = this.parseStats(raw.stats);
    const mapLevel = typeof raw.mapLevel === "number" ? deserializeLevel(raw.mapLevel) : undefined;
    const selectedLevels = this.parseSelectedLevels(raw.selectedLevels);
    const autoRestartEnabled = raw.autoRestartEnabled === true;
    const lastPlayedMap = this.parseLastPlayedMap(raw.lastPlayedMap);
    return { mapId: raw.mapId, mapLevel, stats, selectedLevels, autoRestartEnabled, lastPlayedMap };
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
    const config = getMapConfig(mapId);
    // Check mapsRequired first
    if (config.mapsRequired) {
      const mapsRequiredMet = Object.entries(config.mapsRequired).every(([requiredMapId, requiredLevel]) => {
        const requiredId = requiredMapId as MapId;
        const highestLevel = this.getHighestUnlockedLevel(requiredId);
        return highestLevel >= (requiredLevel ?? 0);
      });
      if (!mapsRequiredMet) {
        return false;
      }
    }
    // Also check unlockedBy for backward compatibility
    return this.unlocks.areConditionsMet(config.unlockedBy);
  }

  private getAvailableMaps(): MapListEntry[] {
    // First, get all selectable maps
    const selectableMaps = getMapList()
      .filter((map) => this.isMapSelectable(map.id))
      .map((map) => this.createListEntry(map, true));
    
    const selectableMapIds = new Set(selectableMaps.map((m) => m.id));
    const visibleMapIds = new Set<MapId>(selectableMapIds);
    
    // Find all maps that are required by selectable maps (show prerequisites)
    selectableMaps.forEach((map) => {
      const config = getMapConfig(map.id);
      if (config.mapsRequired) {
        Object.keys(config.mapsRequired).forEach((requiredId) => {
          const requiredMapId = requiredId as MapId;
          // Only include if not already selectable
          if (!selectableMapIds.has(requiredMapId)) {
            // Show the required map if it can be played (its requirements are met)
            // This allows players to see what will unlock after completing the requirement
            if (this.isMapSelectable(requiredMapId)) {
              visibleMapIds.add(requiredMapId);
            }
          }
        });
      }
    });
    
    // Find all maps that require selectable maps (show what unlocks after completing)
    getMapList().forEach((map) => {
      // Skip if already selectable or already visible
      if (visibleMapIds.has(map.id)) {
        return;
      }
      
      const config = getMapConfig(map.id);
      if (config.mapsRequired) {
        // Check if this map requires any selectable map
        const requiresSelectableMap = Object.entries(config.mapsRequired).some(([requiredId, requiredLevel]) => {
          const requiredMapId = requiredId as MapId;
          // If the required map is selectable, this map should be visible
          return selectableMapIds.has(requiredMapId);
        });
        
        if (requiresSelectableMap) {
          visibleMapIds.add(map.id);
        }
      }
    });
    
    // Create entries for all visible maps
    const allVisibleMaps = getMapList()
      .filter((map) => visibleMapIds.has(map.id))
      .map((map) => this.createListEntry(map, selectableMapIds.has(map.id)));
    
    return allVisibleMaps;
  }

  private createListEntry(map: MapListEntryConfig, selectable: boolean): MapListEntry {
    const config = getMapConfig(map.id);
    const currentLevel = this.getHighestUnlockedLevel(map.id);
    const selectedLevel = this.getSelectedLevel(map.id);
    const attempts = this.getAttemptsForLevel(map.id, selectedLevel);
    const bestTimeMs = this.getBestTimeForLevel(map.id, selectedLevel);
    const clearedLevels = Math.min(
      this.getClearedLevels(map.id),
      config.maxLevel
    );
    return {
      ...map,
      currentLevel,
      selectedLevel,
      attempts,
      bestTimeMs,
      clearedLevels,
      maxLevel: config.maxLevel,
      selectable,
    };
  }

  private getHighestUnlockedLevel(mapId: MapId): number {
    const config = getMapConfig(mapId);
    const maxLevel = config.maxLevel;
    let level = 0;
    for (let candidate = 1; candidate <= maxLevel; candidate += 1) {
      if (!this.unlocks.canAccessMapLevel(mapId, candidate)) {
        break;
      }
      level = candidate;
    }
    if (level === 0) {
      return 0;
    }
    // Ensure progression never skips more than one uncleared level even if cache glitches
    const clearedLevels = this.getClearedLevels(mapId);
    return Math.min(level, clearedLevels + 1);
  }

  private getSelectedLevel(mapId: MapId): number {
    const stored = this.selection.getSelectedLevels()[mapId];
    const storedLevel = typeof stored === "number" ? sanitizeLevel(stored) : undefined;
    const highest = this.getHighestUnlockedLevel(mapId);
    if (highest === 0) {
      return 0;
    }
    if (storedLevel === undefined) {
      return highest;
    }
    return clamp(storedLevel, 1, highest);
  }

  private clampLevelToUnlocked(mapId: MapId, level: number): number {
    const sanitized = sanitizeLevel(level);
    const highest = this.getHighestUnlockedLevel(mapId);
    if (highest === 0) {
      return 0;
    }
    return clamp(sanitized, 1, highest);
  }

  private getActiveLevelForMap(mapId: MapId): number {
    if (mapId === this.selection.getSelectedMapId()) {
      return this.runLifecycle.getActiveMapLevel();
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

  private getClearedLevels(mapId: MapId): number {
    return this.getClearedLevelCount(this.mapStats[mapId]);
  }

  private getTotalClearedLevels(): number {
    return Object.values(this.mapStats).reduce(
      (total, levels) => total + this.getClearedLevelCount(levels),
      0
    );
  }

  private getClearedLevelCount(levels: Record<number, MapLevelStats> | undefined): number {
    if (!levels) {
      return 0;
    }
    const successful = new Set<number>();
    Object.entries(levels).forEach(([rawLevel, stats]) => {
      const level = Number(rawLevel);
      if (Number.isFinite(level) && stats?.success > 0) {
        successful.add(sanitizeLevel(level));
      }
    });

    let cleared = 1;
    while (successful.has(cleared)) {
      cleared += 1;
    }
    return cleared - 1;
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
      levels[mapId] = deserializeLevel(value);
    });
    return levels;
  }

  private parseLastPlayedMap(
    data: unknown
  ): { mapId: MapId; level: number } | undefined {
    if (typeof data !== "object" || data === null) {
      return undefined;
    }
    const raw = data as { mapId?: unknown; level?: unknown };
    if (!raw.mapId || !isMapId(raw.mapId) || !Number.isFinite(raw.level as number)) {
      return undefined;
    }
    return { mapId: raw.mapId, level: deserializeLevel(raw.level) };
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
        const level = deserializeLevel(parsed);
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
    Object.entries(this.selection.getSelectedLevels()).forEach(([mapId, level]) => {
      if (!isMapId(mapId) || typeof level !== "number") {
        return;
      }
      clone[mapId as MapId] = serializeLevel(level);
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

  private cloneStatsForSave(): MapStats {
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
        const level = serializeLevel(sanitizeLevel(parsed));
        levelClone[level] = {
          success: stats.success,
          failure: stats.failure,
          bestTimeMs: stats.bestTimeMs === undefined ? null : stats.bestTimeMs,
        };
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
    return 1;
  }
  const level = Math.floor(Number(value));
  return Math.max(level, 1);
};

const deserializeLevel = (value: unknown): number => {
  if (!Number.isFinite(value as number)) {
    return 1;
  }
  const parsed = Math.floor(Number(value));
  return sanitizeLevel(parsed + 1);
};

const serializeLevel = (level: number): number => {
  if (!Number.isFinite(level as number)) {
    return 0;
  }
  return Math.max(Math.floor(Number(level)) - 1, 0);
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
