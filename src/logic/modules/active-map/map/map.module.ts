import { GameModule } from "@core/logic/types";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { BrickData } from "../bricks/bricks.types";
import type { PlayerUnitSpawnData } from "../player-units/player-units.types";
import type { EnemySpawnData } from "../enemies/enemies.types";
import {
  MapConfig,
  MapId,
  MapListEntry as MapListEntryConfig,
  getMapConfig,
  getMapList,
  isMapId,
} from "../../../../db/maps/maps-db";
import { getBrickConfig } from "../../../../db/bricks-db";
import { getEnemyConfig, type EnemyType } from "../../../../db/enemies-db";
import {
  createEmptyResourceStockpile,
  RESOURCE_IDS,
  type ResourceStockpile,
} from "../../../../db/resources-db";
import type { BonusEffectMap } from "@shared/types/bonuses";
import { buildBricksFromBlueprints } from "../../../services/brick-layout/BrickLayoutService";
import { MapSelectionState } from "./map.selection";
import { MapVisualEffects } from "./map.visual-effects";
import { MapRunLifecycle } from "./map.run-lifecycle";
import { MapEffectsModule } from "../map-effects/map-effects.module";
import {
  MapAutoRestartState,
  MapEffectsBridgeState,
  MapLevelStats,
  MapListEntry,
  MapModuleOptions,
  MapResourcePreview,
  MapResourcePreviewCache,
  MapRunResult,
  MapSaveData,
  MapStats,
} from "./map.types";
import { clampNumber } from "@shared/helpers/numbers.helper";
import { MapRunEvent } from "./MapRunState";
import { MapSceneCleanup, MapSceneCleanupContract } from "./map.scene-cleanup";
import type { BrickRuntimeState } from "../bricks/bricks.types";
import type { EnemyRuntimeState } from "../enemies/enemies.types";
import type { PlayerUnitState } from "../player-units/units/UnitTypes";
import type { ActiveEffectInfo, TargetSnapshot } from "../targeting/targeting.types";
import { getStatusEffectConfig } from "../../../../db/status-effects-db";
import {
  MAP_LIST_BRIDGE_KEY,
  MAP_SELECTED_BRIDGE_KEY,
  MAP_SELECTED_LEVEL_BRIDGE_KEY,
  MAP_CLEARED_LEVELS_BRIDGE_KEY,
  MAP_LAST_PLAYED_BRIDGE_KEY,
  MAP_AUTO_RESTART_BRIDGE_KEY,
  MAP_SELECT_VIEW_TRANSFORM_BRIDGE_KEY,
  MAP_CONTROL_HINTS_COLLAPSED_BRIDGE_KEY,
  MAP_INSPECTED_TARGET_BRIDGE_KEY,
  MAP_EFFECTS_BRIDGE_KEY,
  DEFAULT_MAP_AUTO_RESTART_STATE,
  DEFAULT_MAP_CONTROL_HINTS_COLLAPSED,
  DEFAULT_MAP_ID,
  PLAYER_UNIT_SPAWN_SAFE_RADIUS,
  PLAYER_UNIT_SPAWN_JITTER_RADIUS,
  AUTO_RESTART_SKILL_ID,
  BONUS_CONTEXT_CLEARED_LEVELS,
  MAP_RESOURCE_PREVIEW_BRIDGE_KEY,
  INSPECT_TARGET_TOOLTIP_THROTTLE_MS,
} from "./map.const";
import {
  sanitizeLevel,
  deserializeLevel,
  serializeLevel,
  sanitizeCount,
  sanitizeDuration,
} from "./map.helpers";
import { isDemoBuild } from "@shared/helpers/demo.helper";
import { trackAnalyticsEvent } from "@shared/helpers/google-analytics.helper";
import { calculateBrickStatsForLevel } from "../bricks/bricks.helpers";
import { calculateEnemyStatsForLevel, sanitizeEnemyLevel } from "../enemies/enemies.helpers";
import { ObjectiveIntegrityService } from "../objective-integrity/objective-integrity.service";

export class MapModule implements GameModule {
  public readonly id = "maps";

  private inspectedTarget: { type: "brick" | "enemy" | "playerUnit"; id: string } | null = null;
  private inspectedTargetElapsedMs = 0;
  private inspectedTargetLastPublishMs = 0;
  private readonly selection: MapSelectionState;
  private readonly runLifecycle: MapRunLifecycle;
  private readonly mapEffects: MapEffectsModule;
  private readonly unlocks;
  private readonly getSkillLevel;
  private readonly newUnlocks;
  private mapStats: MapStats = {};
  // Cached deep-clone of mapStats for read-only consumers (e.g., UnlockService)
  private statsCloneCache: MapStats | null = null;
  private statsCloneDirty = true;
  private autoRestartUnlocked = false;
  private autoRestartEnabled = false;
  private controlHintsCollapsed = DEFAULT_MAP_CONTROL_HINTS_COLLAPSED;
  private mapSelectViewTransform: { scale: number; worldX: number; worldY: number } | null = null;
  private readonly options: MapModuleOptions;
  private readonly sceneCleanup: MapSceneCleanupContract;
  private currentMapBonusSourceId: string | null = null;
  private hasRegisteredUnlocks = false;
  private mapEffectsElapsedMs = 0;
  private mapEffectsLastPublishMs = 0;
  private lastMapEffectsSnapshot: MapEffectsBridgeState | null = null;
  private mapResourcePreviewCache: MapResourcePreviewCache | null = null;
  private readonly objectiveIntegrity: ObjectiveIntegrityService;

  constructor(options: MapModuleOptions) {
    this.options = options;
    this.sceneCleanup = options.sceneCleanup;
    this.unlocks = options.unlocks;
    this.getSkillLevel = options.getSkillLevel;
    this.newUnlocks = options.newUnlocks;
    this.selection = new MapSelectionState(DEFAULT_MAP_ID);
    this.objectiveIntegrity = new ObjectiveIntegrityService(
      options.bridge,
      options.bricks,
      options.enemies
    );
    const mapEffects = new MapEffectsModule({
      playerUnits: options.playerUnits,
      enemies: options.enemies,
    });
    this.mapEffects = mapEffects;
    const visuals = new MapVisualEffects(options.scene, mapEffects);
    this.runLifecycle = new MapRunLifecycle({
      runState: options.runState,
      resources: options.resources,
      playerUnits: options.playerUnits,
      enemies: options.enemies,
      bricks: options.bricks,
      unitsAutomation: options.unitsAutomation,
      arcs: options.arcs,
      necromancer: options.necromancer,
      visuals,
      scene: options.scene,
      mapEffects,
    });

    options.runState.subscribe((event) => this.handleRunStateEvent(event));
  }

  public initialize(): void {
    this.registerUnlockNotifications();
    this.runLifecycle.reset();
    this.refreshAutoRestartState();
    this.pushAutoRestartState();
    this.pushMapList();
    this.pushMapResourcePreviewCache();
    this.pushMapSelectViewTransform();
    this.pushControlHintsState();
    this.objectiveIntegrity.reset();
    this.resetInspectedTargetState();
    this.resetMapEffectsState();
    this.ensureSelection();
  }

  public reset(): void {
    this.unregisterMapResourceBonus();
    this.runLifecycle.reset();
    this.autoRestartEnabled = false;
    this.refreshAutoRestartState();
    this.pushAutoRestartState();
    this.objectiveIntegrity.reset();
    this.resetInspectedTargetState();
    this.resetMapEffectsState();
    this.ensureSelection();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    this.mapStats = parsed?.stats ?? {};
    this.selection.loadFromSave(parsed);
    this.autoRestartEnabled = Boolean(parsed?.autoRestartEnabled);
    this.controlHintsCollapsed =
      parsed?.controlHintsCollapsed ?? DEFAULT_MAP_CONTROL_HINTS_COLLAPSED;
    this.mapSelectViewTransform = parsed?.mapSelectViewTransform ?? null;
    // stats changed from save → invalidate cached clone
    this.statsCloneDirty = true;
    this.options.achievements.syncFromMapStats(this.mapStats);
    this.refreshAutoRestartState();
    this.pushAutoRestartState();
    this.pushMapList();
    this.pushLastPlayedMap();
    this.pushMapResourcePreviewCache();
    this.pushMapSelectViewTransform();
    this.pushControlHintsState();

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
      controlHintsCollapsed: this.controlHintsCollapsed,
      lastPlayedMap: this.selection.getLastPlayedMap()
        ? {
            mapId: this.selection.getLastPlayedMap()!.mapId,
            level: serializeLevel(this.selection.getLastPlayedMap()!.level),
          }
        : undefined,
      mapSelectViewTransform: this.mapSelectViewTransform ?? undefined,
    } satisfies MapSaveData;
  }

  public tick(deltaMs: number): void {
    if (!this.options.runState.shouldProcessTick()) {
      return;
    }
    this.inspectedTargetElapsedMs += Math.max(deltaMs, 0);
    this.mapEffectsElapsedMs += Math.max(deltaMs, 0);
    this.runLifecycle.tick(deltaMs);
    const objectiveSnapshot = this.objectiveIntegrity.refresh();
    if (
      this.runLifecycle.isRunActive() &&
      !objectiveSnapshot.bricksRemaining &&
      !objectiveSnapshot.requiredEnemiesRemaining
    ) {
      this.options.runState.complete(true);
    }
    this.publishInspectedTarget();
    this.publishMapEffects();
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
    this.startSelectedMap({ generateBricks: true, generateUnits: false, generateEnemies: true });
  }

  public leaveCurrentMap(): void {
    this.resetInspectedTargetState();
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
    // Unregister map resource bonus
    this.unregisterMapResourceBonus();
    this.runLifecycle.cleanupActiveMap();
    this.options.runState.reset();
    this.pushSelectedMap();
    this.pushSelectedMapLevel();
    this.pushMapList();
  }

  public inspectTargetAtPosition(
    position: SceneVector2,
    radius = 32
  ): TargetSnapshot<"brick" | "enemy" | "playerUnit", BrickRuntimeState | EnemyRuntimeState | PlayerUnitState> | null {
    const brick = this.options.bricks.findNearestBrick(position);
    const enemy = this.options.enemies.findNearestEnemyForInspection(position);
    const playerUnit = this.options.playerUnits.findNearestUnit(position);

    const candidates: Array<{
      target: TargetSnapshot<"brick" | "enemy" | "playerUnit", BrickRuntimeState | EnemyRuntimeState | PlayerUnitState>;
      distanceSq: number;
    }> = [];

    if (brick) {
      const distanceSq = this.getDistanceSq(position, brick.position);
      const allowedRadius = Math.max(radius, brick.physicalSize);
      if (distanceSq <= allowedRadius * allowedRadius) {
        candidates.push({ target: this.toBrickTarget(brick), distanceSq });
      }
    }

    if (enemy) {
      const distanceSq = this.getDistanceSq(position, enemy.position);
      const allowedRadius = Math.max(radius, enemy.physicalSize);
      if (distanceSq <= allowedRadius * allowedRadius) {
        candidates.push({ target: this.toEnemyTarget(enemy), distanceSq });
      }
    }

    if (playerUnit) {
      const distanceSq = this.getDistanceSq(position, playerUnit.position);
      const allowedRadius = Math.max(radius, playerUnit.physicalSize);
      if (distanceSq <= allowedRadius * allowedRadius) {
        candidates.push({ target: this.toPlayerUnitTarget(playerUnit), distanceSq });
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => a.distanceSq - b.distanceSq);
    return candidates[0]?.target ?? null;
  }

  public setInspectedTargetAtPosition(position: SceneVector2, radius = 32): void {
    const target = this.inspectTargetAtPosition(position, radius);
    if (!target) {
      this.clearInspectedTarget();
      return;
    }
    if (this.inspectedTarget?.id === target.id && this.inspectedTarget?.type === target.type) {
      this.publishInspectedTarget(true);
      return;
    }
    this.inspectedTarget = { id: target.id, type: target.type };
    this.publishInspectedTarget(true);
  }

  public clearInspectedTarget(): void {
    this.inspectedTarget = null;
    this.publishInspectedTarget(true);
  }

  private toBrickTarget(brick: BrickRuntimeState): TargetSnapshot<"brick", BrickRuntimeState> {
    const rewardMultiplier = this.getRewardMultiplier();
    const activeEffects = this.getBrickActiveEffects(brick.id);
    const outgoingMultiplier = this.options.statusEffects?.getBrickOutgoingDamageMultiplier(brick.id) ?? 1;
    const flatReduction = this.options.statusEffects?.getBrickOutgoingDamageFlatReduction(brick.id) ?? 0;
    const effectiveDamage = Math.max(0, Math.round(brick.baseDamage * outgoingMultiplier - flatReduction));
    return {
      id: brick.id,
      type: "brick",
      position: { ...brick.position },
      hp: brick.hp,
      maxHp: brick.maxHp,
      armor: brick.armor,
      baseDamage: brick.baseDamage,
      effectiveDamage,
      physicalSize: brick.physicalSize,
      rewardMultiplier,
      activeEffects,
      data: brick,
    };
  }

  private toEnemyTarget(enemy: EnemyRuntimeState): TargetSnapshot<"enemy", EnemyRuntimeState> {
    const rewardMultiplier = this.getRewardMultiplier();
    const activeEffects = this.getEnemyActiveEffects(enemy.id);
    // Currently enemies don't have outgoing damage modifiers
    return {
      id: enemy.id,
      type: "enemy",
      position: { ...enemy.position },
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      armor: enemy.armor,
      baseDamage: enemy.baseDamage,
      effectiveDamage: enemy.baseDamage,
      physicalSize: enemy.physicalSize,
      rewardMultiplier,
      activeEffects,
      data: enemy,
    };
  }

  private toPlayerUnitTarget(unit: PlayerUnitState): TargetSnapshot<"playerUnit", PlayerUnitState> {
    const activeEffects = this.getUnitActiveEffects(unit.id);
    // Calculate effective damage with Internal Furnace and Frenzy bonuses
    const attackMultiplier = this.options.statusEffects?.getUnitAttackMultiplier(unit.id) ?? 1;
    const effectiveDamage = Math.round(unit.baseAttackDamage * attackMultiplier);
    return {
      id: unit.id,
      type: "playerUnit",
      position: { ...unit.position },
      hp: unit.hp,
      maxHp: unit.maxHp,
      armor: unit.armor,
      baseDamage: unit.baseAttackDamage,
      effectiveDamage,
      physicalSize: unit.physicalSize,
      activeEffects,
      data: unit,
    };
  }

  private getUnitActiveEffects(unitId: string): ActiveEffectInfo[] {
    return this.getTargetActiveEffects({ type: "unit", id: unitId });
  }

  private getEnemyActiveEffects(enemyId: string): ActiveEffectInfo[] {
    return this.getTargetActiveEffects({ type: "enemy", id: enemyId });
  }

  private getBrickActiveEffects(brickId: string): ActiveEffectInfo[] {
    return this.getTargetActiveEffects({ type: "brick", id: brickId });
  }

  private getTargetActiveEffects(target: { type: string; id: string }): ActiveEffectInfo[] {
    const statusEffects = this.options.statusEffects;
    if (!statusEffects) {
      return [];
    }
    const effects = statusEffects.getActiveEffectsForTarget(target as any);
    return effects.map((effect) => {
      const config = getStatusEffectConfig(effect.id);
      return {
        id: effect.id,
        name: config.displayName,
        stacks: effect.stacks,
        maxStacks: effect.maxStacks,
        remainingMs: effect.remainingMs,
        damagePerSecond: effect.damagePerSecond,
      };
    });
  }

  private getRewardMultiplier(): number {
    const multiplierRaw = this.options.bonuses.getBonusValue("brick_rewards");
    const multiplier = Number.isFinite(multiplierRaw) ? multiplierRaw : 1;
    return Math.max(multiplier, 0);
  }

  private resetInspectedTargetState(): void {
    this.inspectedTarget = null;
    this.inspectedTargetElapsedMs = 0;
    this.inspectedTargetLastPublishMs = 0;
    this.publishInspectedTarget(true);
  }

  private publishInspectedTarget(force = false): void {
    if (!force && !this.inspectedTarget) {
      return;
    }
    const interval = Math.max(INSPECT_TARGET_TOOLTIP_THROTTLE_MS, 0);
    const elapsed = this.inspectedTargetElapsedMs - this.inspectedTargetLastPublishMs;
    if (!force && elapsed < interval) {
      return;
    }
    this.inspectedTargetLastPublishMs = this.inspectedTargetElapsedMs;
    const snapshot = this.getInspectedTargetSnapshot();
    DataBridgeHelpers.pushState(
      this.options.bridge,
      MAP_INSPECTED_TARGET_BRIDGE_KEY,
      snapshot
    );
  }

  private getInspectedTargetSnapshot():
    | TargetSnapshot<"brick" | "enemy" | "playerUnit", BrickRuntimeState | EnemyRuntimeState | PlayerUnitState>
    | null {
    if (!this.inspectedTarget) {
      return null;
    }
    if (this.inspectedTarget.type === "brick") {
      const brick = this.options.bricks.getBrickState(this.inspectedTarget.id);
      if (!brick) {
        this.inspectedTarget = null;
        return null;
      }
      return this.toBrickTarget(brick);
    }
    if (this.inspectedTarget.type === "playerUnit") {
      const unit = this.options.playerUnits.getUnitState(this.inspectedTarget.id);
      if (!unit) {
        this.inspectedTarget = null;
        return null;
      }
      return this.toPlayerUnitTarget(unit);
    }
    const enemy = this.options.enemies.getEnemyState(this.inspectedTarget.id);
    if (!enemy) {
      this.inspectedTarget = null;
      return null;
    }
    return this.toEnemyTarget(enemy);
  }

  private getDistanceSq(a: SceneVector2, b: SceneVector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
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
      trackAnalyticsEvent("map_completed", { mapId, level, durationMs: result.durationMs });
      const isFirstSuccess = stats.success === 0;
      stats.success += 1;
      const duration = sanitizeDuration(result.durationMs);
      if (duration !== null) {
        if (stats.bestTimeMs === null || duration < stats.bestTimeMs) {
          stats.bestTimeMs = duration;
        }
      }
      if (isFirstSuccess) {
        const config = getMapConfig(mapId);
        this.options.eventLog.registerEvent(
          "map-cleared",
          `Map ${config.name} cleared (Level ${level})`
        );
      }
    } else {
      stats.failure += 1;
    }
    // stats mutated → invalidate cached clone
    this.statsCloneDirty = true;
    this.options.achievements.syncFromMapStats(this.mapStats);
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
    generateEnemies: boolean;
  }): void {
    this.resetInspectedTargetState();
    const mapId = this.selection.getSelectedMapId();
    if (!mapId) {
      return;
    }
    const { generateBricks, generateUnits, generateEnemies } = options;
    const config = getMapConfig(mapId);
    const level = this.getSelectedLevel(mapId);
    this.selection.updateSelection(mapId, level);
    this.selection.recordLastPlayed(mapId, level);
    this.pushLastPlayedMap();

    if (this.isFirstMapEntry(mapId, level)) {
      trackAnalyticsEvent("map_first_enter", { mapId, level });
    }
    
    // Register map resource multiplier bonus if configured
    this.registerMapResourceBonus(mapId, config);
    
    const bricks = this.generateBricks(config, level);
    const spawnUnits = this.generatePlayerUnits(config);
    const spawnPoints = this.getSpawnPoints(config, spawnUnits);
    const enemySpawnPoints = config.enemySpawnPoints ?? [];
    const staticEnemies = this.generateEnemies(config, level);

    this.runLifecycle.startRun({
      level,
      sceneSize: config.size,
      bricks,
      spawnUnits,
      spawnPoints,
      enemySpawnPoints,
      staticEnemies,
      generateBricks,
      generateUnits,
      generateEnemies,
      mapEffects: config.mapEffects ?? [],
      visualEffects: config.visualEffects,
    });
    this.objectiveIntegrity.refresh();

    this.pushSelectedMap();
    this.pushSelectedMapLevel();
    this.pushMapList();
  }

  private handleMapRunCompleted(success: boolean): void {
    this.resetInspectedTargetState();
    const { resources } = this.options;
    if (resources.isRunSummaryAvailable()) {
      return;
    }
    const durationMs = resources.getRunDurationMs();
    this.recordRunResult({ success, durationMs });
    resources.finishRun(success);
  }

  private handleRunStateEvent(event: MapRunEvent): void {
    if (event.type === "reset") {
      this.resetInspectedTargetState();
      this.resetMapEffectsState();
      this.objectiveIntegrity.reset();
      this.sceneCleanup.resetAfterRun();
      return;
    }
    if (event.type === "complete") {
      this.handleMapRunCompleted(event.success);
    }
  }

  private resetMapEffectsState(): void {
    this.mapEffectsElapsedMs = 0;
    this.mapEffectsLastPublishMs = 0;
    this.lastMapEffectsSnapshot = null;
    DataBridgeHelpers.pushState(this.options.bridge, MAP_EFFECTS_BRIDGE_KEY, {
      radioactivity: null,
    });
  }

  private publishMapEffects(force = false): void {
    const intervalMs = 100;
    const elapsed = this.mapEffectsElapsedMs - this.mapEffectsLastPublishMs;
    if (!force && elapsed < intervalMs) {
      return;
    }
    this.mapEffectsLastPublishMs = this.mapEffectsElapsedMs;
    const radioactivity = this.mapEffects.getEffectSnapshot("radioactivity");
    const snapshot: MapEffectsBridgeState = {
      radioactivity: radioactivity
        ? {
            level: radioactivity.level,
            maxLevel: radioactivity.maxLevel,
            postProcess: radioactivity.postProcess,
          }
        : null,
    };
    if (!force && this.isMapEffectsSnapshotEqual(this.lastMapEffectsSnapshot, snapshot)) {
      return;
    }
    this.lastMapEffectsSnapshot = snapshot;
    DataBridgeHelpers.pushState(this.options.bridge, MAP_EFFECTS_BRIDGE_KEY, snapshot);
  }

  private isMapEffectsSnapshotEqual(
    left: MapEffectsBridgeState | null,
    right: MapEffectsBridgeState
  ): boolean {
    if (!left) {
      return false;
    }
    if (!left.radioactivity && !right.radioactivity) {
      return true;
    }
    if (!left.radioactivity || !right.radioactivity) {
      return false;
    }
    const leftPost = left.radioactivity.postProcess;
    const rightPost = right.radioactivity.postProcess;
    return (
      left.radioactivity.level === right.radioactivity.level &&
      left.radioactivity.maxLevel === right.radioactivity.maxLevel &&
      leftPost?.waveAmplitude === rightPost?.waveAmplitude &&
      leftPost?.waveFrequency === rightPost?.waveFrequency &&
      leftPost?.waveSpeed === rightPost?.waveSpeed &&
      leftPost?.jitterStrength === rightPost?.jitterStrength &&
      leftPost?.jitterFrequency === rightPost?.jitterFrequency &&
      leftPost?.bandSpeed === rightPost?.bandSpeed &&
      leftPost?.bandWidth === rightPost?.bandWidth &&
      leftPost?.bandIntensity === rightPost?.bandIntensity
    );
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
    const payload: MapAutoRestartState = {
      unlocked: this.autoRestartUnlocked,
      enabled: this.autoRestartUnlocked && this.autoRestartEnabled,
    };
    DataBridgeHelpers.pushState(this.options.bridge, MAP_AUTO_RESTART_BRIDGE_KEY, payload);
  }

  private pushMapSelectViewTransform(): void {
    DataBridgeHelpers.pushState(
      this.options.bridge,
      MAP_SELECT_VIEW_TRANSFORM_BRIDGE_KEY,
      this.mapSelectViewTransform
    );
  }

  private pushControlHintsState(): void {
    DataBridgeHelpers.pushState(
      this.options.bridge,
      MAP_CONTROL_HINTS_COLLAPSED_BRIDGE_KEY,
      this.controlHintsCollapsed
    );
  }

  public setMapSelectViewTransform(transform: { scale: number; worldX: number; worldY: number } | null): void {
    this.mapSelectViewTransform = transform;
    this.pushMapSelectViewTransform();
  }

  public setControlHintsCollapsed(collapsed: boolean): void {
    if (this.controlHintsCollapsed === collapsed) {
      return;
    }
    this.controlHintsCollapsed = collapsed;
    this.pushControlHintsState();
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

  private generateEnemies(config: MapConfig, mapLevel: number): EnemySpawnData[] {
    if (!config.enemies) {
      return [];
    }
    return [...config.enemies({ mapLevel })];
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
      const basePosition = spawnPoint ?? fallback;
      return {
        type: unit.type,
        position: this.applySpawnJitter(basePosition, config.size),
      };
    });
  }

  private applySpawnJitter(position: SceneVector2, size: SceneSize): SceneVector2 {
    const radius = Math.max(0, PLAYER_UNIT_SPAWN_JITTER_RADIUS);
    if (radius <= 0) {
      return { ...position };
    }
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * radius;
    return this.clampToMap(
      {
        x: position.x + Math.cos(angle) * distance,
        y: position.y + Math.sin(angle) * distance,
      },
      size
    );
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
    if (config.playerUnits && config.playerUnits.length > 0) {
      return config.playerUnits.map((unit) =>
        this.clampToMap(unit.position, config.size)
      );
    }
    return units.map((unit) => unit.position);
  }

  private clampToMap(position: SceneVector2, size: SceneSize): SceneVector2 {
    return {
      x: clampNumber(position.x, 0, size.width),
      y: clampNumber(position.y, 0, size.height),
    };
  }

  private pushClearedLevelsTotal(): void {
    const total = this.getTotalClearedLevels();
    DataBridgeHelpers.pushState(this.options.bridge, MAP_CLEARED_LEVELS_BRIDGE_KEY, total);
    this.options.bonuses.setEffectContext({
      [BONUS_CONTEXT_CLEARED_LEVELS]: total,
    });
  }

  private pushMapList(): void {
    // Ensure unlock checks are fresh (map stats/skills may have just changed)
    this.unlocks.clearCache();
    const list = this.getAvailableMaps();
    this.pushClearedLevelsTotal();
    DataBridgeHelpers.pushState(this.options.bridge, MAP_LIST_BRIDGE_KEY, list);
    this.newUnlocks.invalidate("maps");
  }

  private pushMapResourcePreviewCache(): void {
    const cache = this.ensureMapResourcePreviewCache();
    DataBridgeHelpers.pushState(this.options.bridge, MAP_RESOURCE_PREVIEW_BRIDGE_KEY, cache);
  }

  private ensureMapResourcePreviewCache(): MapResourcePreviewCache {
    if (this.mapResourcePreviewCache) {
      return this.mapResourcePreviewCache;
    }
    const cache: MapResourcePreviewCache = {};
    getMapList().forEach((map) => {
      const config = getMapConfig(map.id);
      cache[map.id] = this.buildMapResourcePreview(config);
    });
    this.mapResourcePreviewCache = cache;
    return cache;
  }

  private buildMapResourcePreview(config: MapConfig): MapResourcePreview {
    const mapLevel = 1;
    const brickTotalsLevel1 = this.computeBrickTotalsForLevel(config, mapLevel);
    const enemyRewardsLevel1 = this.computeEnemyRewardsForLevel(config, mapLevel);
    const multiplier =
      config.resourceMultiplier !== undefined && config.resourceMultiplier > 0
        ? Math.max(config.resourceMultiplier, 0)
        : 1;
    const scaledBrickTotals =
      multiplier !== 1
        ? this.scaleResourceStockpilePreview(brickTotalsLevel1, multiplier)
        : brickTotalsLevel1;
    const scaledEnemyRewards: Partial<Record<EnemyType, ResourceStockpile>> = {};
    Object.entries(enemyRewardsLevel1).forEach(([type, rewards]) => {
      scaledEnemyRewards[type as EnemyType] =
        multiplier !== 1
          ? this.scaleResourceStockpilePreview(rewards ?? createEmptyResourceStockpile(), multiplier)
          : rewards ?? createEmptyResourceStockpile();
    });

    const resourceIds = RESOURCE_IDS.filter((id) => {
      if ((scaledBrickTotals[id] ?? 0) > 0) {
        return true;
      }
      return Object.values(scaledEnemyRewards).some((reward) => (reward?.[id] ?? 0) > 0);
    });

    return {
      resourceIds,
      brickTotalsLevel1: scaledBrickTotals,
      enemyRewardsLevel1: scaledEnemyRewards,
    };
  }

  private computeBrickTotalsForLevel(config: MapConfig, mapLevel: number): ResourceStockpile {
    const totals = createEmptyResourceStockpile();
    const bricks = buildBricksFromBlueprints(config.bricks({ mapLevel }));
    bricks.forEach((brick) => {
      const brickConfig = getBrickConfig(brick.type);
      const stats = calculateBrickStatsForLevel(brickConfig, brick.level);
      this.addResourceStockpile(totals, stats.rewards);
    });
    return totals;
  }

  private computeEnemyRewardsForLevel(
    config: MapConfig,
    mapLevel: number
  ): Partial<Record<EnemyType, ResourceStockpile>> {
    const levelsByType = new Map<EnemyType, number>();
    if (config.enemies) {
      config.enemies({ mapLevel }).forEach((spawn) => {
        const level = sanitizeEnemyLevel(spawn.level ?? mapLevel);
        this.setEnemyLevelPreview(levelsByType, spawn.type, level);
      });
    }
    config.enemySpawnPoints?.forEach((spawnPoint) => {
      if (spawnPoint.enabled === false) {
        return;
      }
      const levelOffset = spawnPoint.levelOffset ?? 0;
      const enemyLevel = sanitizeEnemyLevel(mapLevel + levelOffset);
      const validTypes = spawnPoint.enemyTypes.filter((enemyType) => {
        if (enemyType.minLevel !== undefined && mapLevel < enemyType.minLevel) {
          return false;
        }
        if (enemyType.maxLevel !== undefined && mapLevel > enemyType.maxLevel) {
          return false;
        }
        return true;
      });
      if (validTypes.length === 0) {
        return;
      }
      const weightedTypes = validTypes.filter((enemyType) => Math.max(enemyType.weight, 0) > 0);
      const previewTypes = weightedTypes.length > 0 ? weightedTypes : [validTypes[0]!];
      previewTypes.forEach((enemyType) => {
        this.setEnemyLevelPreview(levelsByType, enemyType.type, enemyLevel);
      });
    });

    const rewards: Partial<Record<EnemyType, ResourceStockpile>> = {};
    levelsByType.forEach((level, type) => {
      const stats = calculateEnemyStatsForLevel(getEnemyConfig(type), level);
      rewards[type] = stats.rewards;
    });
    return rewards;
  }

  private setEnemyLevelPreview(
    levelsByType: Map<EnemyType, number>,
    type: EnemyType,
    level: number
  ): void {
    const stored = levelsByType.get(type);
    if (!stored || level > stored) {
      levelsByType.set(type, level);
    }
  }

  private addResourceStockpile(target: ResourceStockpile, source: ResourceStockpile): void {
    RESOURCE_IDS.forEach((id) => {
      const base = target[id] ?? 0;
      const add = source[id] ?? 0;
      target[id] = base + add;
    });
  }

  private scaleResourceStockpilePreview(
    source: ResourceStockpile,
    multiplier: number
  ): ResourceStockpile {
    const scaled = createEmptyResourceStockpile();
    RESOURCE_IDS.forEach((id) => {
      const base = source[id] ?? 0;
      const value = Math.round(base * multiplier * 100) / 100;
      scaled[id] = value > 0 ? value : 0;
    });
    return scaled;
  }

  private registerUnlockNotifications(): void {
    if (this.hasRegisteredUnlocks) {
      return;
    }
    this.hasRegisteredUnlocks = true;
    getMapList().forEach((map) => {
      this.newUnlocks.registerUnlock(`maps.${map.id}`, () => this.isMapSelectable(map.id));
    });
  }

  private pushSelectedMap(): void {
    DataBridgeHelpers.pushState(
      this.options.bridge,
      MAP_SELECTED_BRIDGE_KEY,
      this.selection.getSelectedMapId()
    );
  }

  private pushSelectedMapLevel(): void {
    const level = this.selection.getSelectedMapId() ? this.selection.getSelectedMapLevel() : 0;
    DataBridgeHelpers.pushState(this.options.bridge, MAP_SELECTED_LEVEL_BRIDGE_KEY, level);
  }

  private pushLastPlayedMap(): void {
    DataBridgeHelpers.pushState(
      this.options.bridge,
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
      controlHintsCollapsed?: unknown;
      lastPlayedMap?: unknown;
      mapSelectViewTransform?: unknown;
    };
    if (!raw.mapId || !isMapId(raw.mapId)) {
      return undefined;
    }
    const stats = this.parseStats(raw.stats);
    const mapLevel = typeof raw.mapLevel === "number" ? deserializeLevel(raw.mapLevel) : undefined;
    const selectedLevels = this.parseSelectedLevels(raw.selectedLevels);
    const autoRestartEnabled = raw.autoRestartEnabled === true;
    const controlHintsCollapsed = raw.controlHintsCollapsed === true;
    const lastPlayedMap = this.parseLastPlayedMap(raw.lastPlayedMap);
    const mapSelectViewTransform = this.parseViewTransform(raw.mapSelectViewTransform);
    return {
      mapId: raw.mapId,
      mapLevel,
      stats,
      selectedLevels,
      autoRestartEnabled,
      controlHintsCollapsed,
      lastPlayedMap,
      mapSelectViewTransform,
    };
  }

  private parseViewTransform(data: unknown): { scale: number; worldX: number; worldY: number } | undefined {
    if (typeof data !== "object" || data === null) {
      return undefined;
    }
    const raw = data as { scale?: unknown; worldX?: unknown; worldY?: unknown };
    if (
      typeof raw.scale === "number" &&
      typeof raw.worldX === "number" &&
      typeof raw.worldY === "number"
    ) {
      return { scale: raw.scale, worldX: raw.worldX, worldY: raw.worldY };
    }
    return undefined;
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
    if (isDemoBuild() && config.lockedForDemo) {
      return false;
    }
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

    if (isDemoBuild()) {
      getMapList().forEach((map) => {
        if (getMapConfig(map.id).lockedForDemo) {
          visibleMapIds.add(map.id);
        }
      });
    }
    
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
      name: this.options.localization?.getMapName(map.id, map.name) ?? map.name,
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
    return clampNumber(storedLevel, 1, highest);
  }

  private clampLevelToUnlocked(mapId: MapId, level: number): number {
    const sanitized = sanitizeLevel(level);
    const highest = this.getHighestUnlockedLevel(mapId);
    if (highest === 0) {
      return 0;
    }
    return clampNumber(sanitized, 1, highest);
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

  private isFirstMapEntry(mapId: MapId, level: number): boolean {
    const entry = this.mapStats[mapId]?.[sanitizeLevel(level)];
    if (!entry) {
      return true;
    }
    return entry.success + entry.failure === 0;
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

  private registerMapResourceBonus(mapId: MapId, config: MapConfig): void {
    // Unregister previous bonus if any
    this.unregisterMapResourceBonus();

    // Register new bonus if multiplier is configured
    if (config.resourceMultiplier !== undefined && config.resourceMultiplier > 0) {
      const sourceId = `map_${mapId}`;
      const multiplier = Math.max(config.resourceMultiplier, 0);
      
      const effects: BonusEffectMap = {
        brick_rewards: {
          multiplier: () => multiplier,
        },
      };

      this.options.bonuses.registerSource(sourceId, effects);
      this.currentMapBonusSourceId = sourceId;
    }
  }

  private unregisterMapResourceBonus(): void {
    if (this.currentMapBonusSourceId !== null) {
      this.options.bonuses.unregisterSource(this.currentMapBonusSourceId);
      this.currentMapBonusSourceId = null;
    }
  }
}
