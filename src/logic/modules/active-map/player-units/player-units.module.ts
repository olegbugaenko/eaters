import { DataBridge } from "../../../core/DataBridge";
import { GameModule } from "../../../core/types";
import {
  SceneVector2,
  SceneFill,
  SceneColor,
  SceneStroke,
} from "../../../services/scene-object-manager/scene-object-manager.types";
import { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import { MovementService, MovementBodyState } from "../../../services/movement/MovementService";
import {
  VisualEffectState,
  createVisualEffectState,
  setVisualEffectFillOverlay,
  computeVisualEffectFillColor,
  computeVisualEffectStrokeColor,
} from "../../../visuals/VisualEffectState";
import {
  PlayerUnitType,
  PLAYER_UNIT_TYPES,
} from "@db/player-units-db";
import { UNIT_MODULE_IDS, UnitModuleId, getUnitModuleConfig } from "../../../../db/unit-modules-db";
import type { SkillId } from "../../../../db/skills-db";
import { clampNumber, clampProbability } from "@shared/helpers/numbers.helper";
import {
  PlayerUnitBlueprintStats,
  PlayerUnitRuntimeModifiers,
} from "@shared/types/player-units";
import { computePlayerUnitBlueprint } from "./player-units.blueprint";
import {
  addVectors,
  subtractVectors,
  scaleVector,
  vectorLength,
  vectorHasLength,
} from "../../../../shared/helpers/vector.helper";
import { cloneSceneColor, sceneColorsEqual } from "@shared/helpers/scene-color.helper";
import { roundStat, sanitizeNumber } from "../../../../shared/helpers/numbers.helper";
import { UnitStateFactory, UnitStateInput } from "./player-units.state-factory";
import {
  sanitizeRuntimeModifiers,
  sanitizeUnitType,
  cloneEmitter,
  cloneRendererConfigForScene,
} from "./player-units.helpers";
import { UnitTargetingMode } from "@shared/types/unit-targeting";
import { BricksModule } from "../bricks/bricks.module";
import type { BrickRuntimeState } from "../bricks/bricks.types";
import { BonusValueMap, BonusesModule } from "../../shared/bonuses/bonuses.module";
import { UnitDesignId } from "../../camp/unit-design/unit-design.types";
import { UnitDesignModule } from "../../camp/unit-design/unit-design.module";
import { ArcModule } from "../../scene/arc/arc.module";
import { EffectsModule } from "../../scene/effects/effects.module";
import { ExplosionModule } from "../../scene/explosion/explosion.module";
import { FireballModule } from "../../scene/fireball/fireball.module";
import { MapRunState } from "../map/MapRunState";
import type { StatisticsTracker } from "../../shared/statistics/statistics.module";
import {
  AbilitySoundPlayer,
  PlayerUnitAbilities,
  PheromoneAttackBonusState,
} from "./PlayerUnitAbilities";
import { AbilityVisualService } from "./abilities/AbilityVisualService";
import { UnitFactory, UnitCreationData } from "./units/UnitFactory";
import { UnitProjectileController } from "../projectiles/ProjectileController";
import { UnitRuntimeController } from "./units/UnitRuntimeController";
import { UnitStatisticsReporter } from "./units/UnitStatisticsReporter";
import type { PlayerUnitState } from "./units/UnitTypes";
import { TargetingService } from "../targeting/TargetingService";
import { isTargetOfType } from "../targeting/targeting.types";
import { BricksTargetingProvider } from "../targeting/BricksTargetingProvider";
import { PlayerUnitsTargetingProvider } from "./PlayerUnitsTargetingProvider";
import type { DamageService } from "../targeting/DamageService";
import type { EnemiesModule } from "../enemies/enemies.module";
import {
  ATTACK_DISTANCE_EPSILON,
  COLLISION_RESOLUTION_ITERATIONS,
  CRITICAL_HIT_EXPLOSION_RADIUS,
  INTERNAL_FURNACE_EFFECT_ID,
  INTERNAL_FURNACE_TINT_COLOR,
  INTERNAL_FURNACE_MAX_INTENSITY,
  INTERNAL_FURNACE_EFFECT_PRIORITY,
  PHEROMONE_TIMER_CAP_SECONDS,
  TARGETING_RADIUS_STEP,
  IDLE_WANDER_RADIUS,
  IDLE_WANDER_TARGET_EPSILON,
  IDLE_WANDER_RESEED_INTERVAL,
  IDLE_WANDER_SPEED_FACTOR,
  TARGETING_SCORE_EPSILON,
} from "./units/UnitTypes";
import { ZERO_VECTOR } from "../../../../shared/helpers/geometry.const";
import {
  PLAYER_UNIT_COUNT_BRIDGE_KEY,
  PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY,
  PLAYER_UNIT_BLUEPRINT_STATS_BRIDGE_KEY,
  PLAYER_UNIT_COUNTS_BY_DESIGN_BRIDGE_KEY,
} from "./player-units.const";
import type {
  PlayerUnitSpawnData,
  PlayerUnitsModuleOptions,
  PlayerUnitSaveData,
} from "./player-units.types";


export class PlayerUnitsModule implements GameModule {
  public readonly id = "playerUnits";

  private readonly scene: SceneObjectManager;
  private readonly bricks: BricksModule;
  private readonly bridge: DataBridge;
  private readonly movement: MovementService;
  private readonly bonuses: BonusesModule;
  private readonly explosions: ExplosionModule;
  private readonly targeting: TargetingService;
  private readonly damage?: DamageService;
  private readonly enemies?: EnemiesModule;
  private readonly arcs?: ArcModule;
  private readonly effects?: EffectsModule;
  private readonly fireballs?: FireballModule;
  private readonly onAllUnitsDefeated?: () => void;
  private readonly getModuleLevel: (id: UnitModuleId) => number;
  private readonly hasSkill: (id: SkillId) => boolean;
  private readonly getDesignTargetingMode: (
    designId: UnitDesignId | null,
    type: PlayerUnitType
  ) => UnitTargetingMode;
  private readonly unitDesign?: UnitDesignModule;
  private readonly abilities: PlayerUnitAbilities;
  private readonly statistics?: StatisticsTracker;
  private readonly unitFactory: UnitFactory;
  private readonly runtimeController: UnitRuntimeController;
  private readonly projectiles: UnitProjectileController;
  private readonly runState: MapRunState;
  private readonly unitStateFactory: UnitStateFactory;

  private units = new Map<string, PlayerUnitState>();
  private unitOrder: PlayerUnitState[] = [];
  private unitBlueprints = new Map<PlayerUnitType, PlayerUnitBlueprintStats>();
  private readonly statsReporter: UnitStatisticsReporter;
  private lastTickTimestampMs = performance.now();

  constructor(options: PlayerUnitsModuleOptions) {
    this.scene = options.scene;
    this.bricks = options.bricks;
    this.bridge = options.bridge;
    this.movement = options.movement;
    this.bonuses = options.bonuses;
    this.explosions = options.explosions;
    const targeting = options.targeting ?? new TargetingService();
    if (!options.targeting) {
      targeting.registerProvider(new BricksTargetingProvider(this.bricks));
    }
    targeting.registerProvider(new PlayerUnitsTargetingProvider(this));
    this.targeting = targeting;
    this.arcs = options.arcs;
    this.effects = options.effects;
    this.fireballs = options.fireballs;
    this.projectiles = options.projectiles;
    this.onAllUnitsDefeated = options.onAllUnitsDefeated;
    this.getModuleLevel = options.getModuleLevel;
    this.hasSkill = options.hasSkill;
    this.getDesignTargetingMode = options.getDesignTargetingMode;
    this.unitDesign = options.unitDesign;
    this.statistics = options.statistics;
    this.runState = options.runState;
    const abilitySceneService = new AbilityVisualService({
      scene: this.scene,
      explosions: this.explosions,
      getArcs: () => this.arcs,
      getEffects: () => this.effects,
      getFireballs: () => this.fireballs,
    });

    this.abilities = new PlayerUnitAbilities({
      sceneService: abilitySceneService,
      logEvent: (message: string) => this.logPheromoneEvent(message),
      formatUnitLabel: (unit) => this.formatUnitLogLabel(unit),
      getUnits: () => this.unitOrder,
      getUnitById: (id: string) => this.units.get(id),
      getBrickPosition: (brickId: string) => {
        const brick = this.getBrickTarget(brickId);
        return brick?.position || null;
      },
      damageBrick: (brickId: string, damage: number) => {
        const brick = this.bricks.getBrickState(brickId);
        if (brick) {
          this.bricks.applyDamage(brickId, damage, { x: 0, y: 0 }, {
            rewardMultiplier: 1,
            armorPenetration: 0,
          });
        }
      },
      getBricksInRadius: (position: SceneVector2, radius: number) => {
        return this.getBrickIdsInRadius(position, radius);
      },
      damageUnit: (unitId: string, damage: number) => {
        this.applyDamage(unitId, damage);
      },
      findNearestBrick: (position: SceneVector2) => {
        const brick = this.findNearestBrickTarget(position);
        return brick?.id || null;
      },
      audio: options.audio,
      projectiles: this.projectiles,
    });

    this.statsReporter = new UnitStatisticsReporter({ bridge: this.bridge });

    this.unitFactory = new UnitFactory({
      scene: this.scene,
      movement: this.movement,
      getModuleLevel: this.getModuleLevel,
      hasSkill: this.hasSkill,
      getDesignTargetingMode: this.getDesignTargetingMode,
    });

    this.damage = options.damage;
    this.enemies = options.enemies;

    this.runtimeController = new UnitRuntimeController({
      scene: this.scene,
      movement: this.movement,
      bricks: this.bricks,
      targeting: this.targeting,
      abilities: this.abilities,
      statistics: this.statistics,
      explosions: this.explosions,
      projectiles: this.projectiles,
      damage: this.damage,
      enemies: this.enemies,
      getDesignTargetingMode: this.getDesignTargetingMode,
      syncUnitTargetingMode: (unit) => this.syncUnitTargetingMode(unit),
      removeUnit: (unit) => this.removeUnit(unit),
      updateSceneState: (unit, options) => this.pushUnitSceneState(unit, options),
      updateInternalFurnaceEffect: (unit) => this.updateInternalFurnaceEffect(unit),
    });

    this.unitStateFactory = new UnitStateFactory({
      updateInternalFurnaceEffect: (unit) => this.updateInternalFurnaceEffect(unit),
      pushUnitSceneState: (unit, options) => this.pushUnitSceneState(unit, options),
    });
  }

  public getActiveUnitCount(): number {
    return this.unitOrder.length;
  }

  public getUnitCountByDesignId(designId: UnitDesignId): number {
    return this.unitOrder.filter(u => u.designId === designId && u.hp > 0).length;
  }

  public initialize(): void {
    // Units are spawned by the map module.
    this.pushBlueprintStats();
    this.pushStats();
  }

  public reset(): void {
    this.unitBlueprints.clear();
    this.pushBlueprintStats();
    this.projectiles.clear();
    this.applyUnits([]);
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed) {
      this.ensureBlueprints();
      this.applyUnits(parsed.units);
    }
  }

  public save(): unknown {
    return null;
  }

  public prepareForMap(): void {
    this.unitBlueprints = this.computeBlueprintStats();
    this.pushBlueprintStats();
    this.projectiles.clear();
    // Reset per-run ability state (e.g., mending heal charges)
    this.abilities.resetRun();
  }

  public tick(deltaMs: number): void {
    if (!this.runState.shouldProcessTick()) {
      return;
    }
    this.lastTickTimestampMs = performance.now();

    // Update positions FIRST so abilities use current positions
    const deltaSeconds = Math.max(deltaMs, 0) / 1000;
    const result = this.runtimeController.updateUnits(this.unitOrder, deltaSeconds);

    // Then evaluate abilities with updated positions
    this.abilities.update(deltaMs);

    if (result.statsChanged) {
      this.pushStats();
    }
  }

  public cleanupExpired(): void {
    // Clean up expired projectiles and rings that accumulated while tab was inactive
    this.projectiles.cleanupExpired();

    // Remove dead units and advance basic timers using real time to prevent buildup while inactive
    const now = performance.now();
    const elapsedSeconds = Math.max(0, (now - this.lastTickTimestampMs) / 1000);
    this.lastTickTimestampMs = now;

    let statsDirty = false;

    if (elapsedSeconds > 0 && this.unitOrder.length > 0) {
      const unitsSnapshot = [...this.unitOrder];
      unitsSnapshot.forEach((unit) => {
        if (unit.hp <= 0) {
          this.removeUnit(unit);
          statsDirty = true;
          return;
        }

        unit.attackCooldown = Math.max(unit.attackCooldown - elapsedSeconds, 0);
        unit.timeSinceLastAttack = Math.min(
          unit.timeSinceLastAttack + elapsedSeconds,
          PHEROMONE_TIMER_CAP_SECONDS,
        );
        unit.timeSinceLastSpecial = Math.min(
          unit.timeSinceLastSpecial + elapsedSeconds,
          PHEROMONE_TIMER_CAP_SECONDS,
        );
        unit.wanderCooldown = Math.max(unit.wanderCooldown - elapsedSeconds, 0);
      });
    }

    if (statsDirty) {
      this.pushStats();
    }

    // Ensure any pending scene removals for player units are flushed after a hidden tab
    this.scene.flushAllPendingRemovals();
  }

  public getUnitPositionIfAlive = (unitId: string): SceneVector2 | null => {
    const u = this.units.get(unitId);
    if (!u || u.hp <= 0) return null;
    return { ...u.position };
  };

  public setUnits(units: PlayerUnitSpawnData[]): void {
    this.applyUnits(units);
  }

  public spawnUnit(unit: PlayerUnitSpawnData): void {
    this.ensureBlueprints();
    const state = this.createUnitState(unit);
    this.units.set(state.id, state);
    this.unitOrder.push(state);
    this.pushStats();
  }

  private pushStats(): void {
    this.statsReporter.pushCounts(this.unitOrder, {
      countKey: PLAYER_UNIT_COUNT_BRIDGE_KEY,
      totalHpKey: PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY,
      countsByDesignKey: PLAYER_UNIT_COUNTS_BY_DESIGN_BRIDGE_KEY,
    });
  }

  private parseSaveData(data: unknown): PlayerUnitSaveData | null {
    if (
      typeof data !== "object" ||
      data === null ||
      !("units" in data) ||
      !Array.isArray((data as { units: unknown }).units)
    ) {
      return null;
    }

    const sanitized: PlayerUnitSpawnData[] = [];
    (data as PlayerUnitSaveData).units.forEach((unit) => {
      if (
        unit &&
        typeof unit === "object" &&
        "position" in unit &&
        typeof unit.position === "object" &&
        unit.position !== null &&
        typeof unit.position.x === "number" &&
        typeof unit.position.y === "number"
      ) {
        const type = sanitizeUnitType((unit as PlayerUnitSpawnData).type);
        sanitized.push({
          type,
          position: this.clampToMap(unit.position as SceneVector2),
          hp: sanitizeNumber((unit as PlayerUnitSpawnData).hp),
          attackCooldown: sanitizeNumber((unit as PlayerUnitSpawnData).attackCooldown),
        });
      }
    });

    return { units: sanitized };
  }

  private applyUnits(units: PlayerUnitSpawnData[]): void {
    this.ensureBlueprints();
    this.clearUnits();

    units.forEach((unit) => {
      const state = this.createUnitState(unit);
      this.units.set(state.id, state);
      this.unitOrder.push(state);
    });

    this.abilities.resetRun();
    this.pushStats();
  }

  private ensureBlueprints(): void {
    if (this.unitBlueprints.size > 0) {
      return;
    }
    this.unitBlueprints = this.computeBlueprintStats();
    this.pushBlueprintStats();
  }

  private computeBlueprintStats(): Map<PlayerUnitType, PlayerUnitBlueprintStats> {
    const values = this.bonuses.getAllValues();
    const blueprints = new Map<PlayerUnitType, PlayerUnitBlueprintStats>();

    PLAYER_UNIT_TYPES.forEach((type) => {
      blueprints.set(type, computePlayerUnitBlueprint(type, values));
    });

    return blueprints;
  }

  private pushBlueprintStats(): void {
    const payload = PLAYER_UNIT_TYPES
      .map((type) => this.unitBlueprints.get(type))
      .filter((stats): stats is PlayerUnitBlueprintStats => Boolean(stats));
    this.statsReporter.pushBlueprints(payload, PLAYER_UNIT_BLUEPRINT_STATS_BRIDGE_KEY);
  }

  private createUnitState(unit: PlayerUnitSpawnData): PlayerUnitState {
    const type = sanitizeUnitType(unit.type);
    
    // Try to get blueprint from design first (includes module multipliers)
    let blueprint: PlayerUnitBlueprintStats | undefined;
    if (unit.designId && this.unitDesign) {
      const design = this.unitDesign.getDesign(unit.designId);
      if (design && design.type === type) {
        blueprint = design.blueprint;
      }
    }
    
    // Fallback to base blueprint if no design blueprint found
    if (!blueprint) {
      blueprint = this.unitBlueprints.get(type);
    }
    
    if (!blueprint) {
      throw new Error(`Missing blueprint stats for unit type: ${type}`);
    }

    const unitId = this.unitFactory.createUnitId();
    const input: UnitStateInput = {
      unit,
      unitFactory: this.unitFactory,
      unitId,
      blueprint,
      getModuleLevel: (id) => this.getModuleLevel(id),
      getDesignTargetingMode: (designId, unitType) => this.getDesignTargetingMode(designId, unitType as PlayerUnitType),
      getAbilityCooldownSeconds: () => this.abilities.getAbilityCooldownSeconds(),
    };

    return this.unitStateFactory.createWithTransform(input);
  }

  private syncUnitTargetingMode(unit: PlayerUnitState): UnitTargetingMode {
    const mode = this.getDesignTargetingMode(unit.designId, unit.type);
    if (unit.targetingMode !== mode) {
      unit.targetingMode = mode;
      unit.targetBrickId = null;
      unit.wanderTarget = null;
      unit.wanderCooldown = 0;
    }
    return unit.targetingMode;
  }

  private formatUnitLogLabel(unit: { id: string; type: string }): string {
    return `${unit.type}(${unit.id})`;
  }

  private logPheromoneEvent(message: string): void {
    console.log(`[Pheromones] ${message}`);
  }

  private pushUnitSceneState(
    unit: PlayerUnitState,
    options: { forceFill?: boolean; forceStroke?: boolean } = {}
  ): void {
    const shouldUpdateFill = options.forceFill || unit.visualEffectsDirty;
    const shouldUpdateStroke =
      (options.forceStroke || unit.visualEffectsDirty) && Boolean(unit.baseStrokeColor);

    let fillUpdate: SceneFill | undefined;
    let strokeUpdate: SceneStroke | undefined;

    if (shouldUpdateFill) {
      const nextFillColor = computeVisualEffectFillColor(
        unit.baseFillColor,
        unit.visualEffects
      );
      if (!sceneColorsEqual(nextFillColor, unit.appliedFillColor)) {
        const sanitized = cloneSceneColor(nextFillColor);
        unit.appliedFillColor = sanitized;
        fillUpdate = {
          fillType: FILL_TYPES.SOLID,
          color: cloneSceneColor(sanitized),
        };
      }
    }

    if (shouldUpdateStroke && unit.renderer.stroke && unit.baseStrokeColor) {
      const nextStrokeColor = computeVisualEffectStrokeColor(
        unit.baseStrokeColor,
        unit.visualEffects
      );
      if (
        nextStrokeColor &&
        !sceneColorsEqual(nextStrokeColor, unit.appliedStrokeColor ?? unit.baseStrokeColor)
      ) {
        const sanitizedStroke = cloneSceneColor(nextStrokeColor);
        unit.appliedStrokeColor = sanitizedStroke;
        strokeUpdate = {
          color: cloneSceneColor(sanitizedStroke),
          width: unit.renderer.stroke.width,
        };
      }
    }

    if (shouldUpdateFill || shouldUpdateStroke) {
      unit.visualEffectsDirty = false;
    }

    this.scene.updateObject(unit.objectId, {
      position: { ...unit.position },
      rotation: unit.rotation,
      ...(fillUpdate ? { fill: fillUpdate } : {}),
      ...(strokeUpdate ? { stroke: strokeUpdate } : {}),
    });
  }

  private updateInternalFurnaceEffect(unit: PlayerUnitState): void {
    const hasStacks =
      unit.attackStackBonusPerHit > 0 && unit.attackStackBonusCap > 0 && unit.hp > 0;
    const cap = Math.max(unit.attackStackBonusCap, 1e-6);
    const ratio = hasStacks
      ? clampNumber(unit.currentAttackStackBonus / cap, 0, 1)
      : 0;
    let intensity = 0;
    if (ratio > 0) {
      const normalized = Math.sqrt(ratio);
      intensity = Math.min(
        normalized * INTERNAL_FURNACE_MAX_INTENSITY,
        INTERNAL_FURNACE_MAX_INTENSITY
      );
    }
    const overlayChanged = setVisualEffectFillOverlay(
      unit.visualEffects,
      INTERNAL_FURNACE_EFFECT_ID,
      intensity > 0
        ? {
            color: INTERNAL_FURNACE_TINT_COLOR,
            intensity,
            priority: INTERNAL_FURNACE_EFFECT_PRIORITY,
          }
        : null
    );
    if (overlayChanged) {
      unit.visualEffectsDirty = true;
    }
  }

  private spawnCriticalHitEffect(position: SceneVector2): void {
    this.explosions.spawnExplosionByType("criticalHit", {
      position: { ...position },
      initialRadius: CRITICAL_HIT_EXPLOSION_RADIUS,
    });
  }

  public getUnitState(unitId: string): PlayerUnitState | null {
    const unit = this.units.get(unitId);
    return unit ? this.cloneUnit(unit) : null;
  }

  public findNearestUnit(position: SceneVector2): PlayerUnitState | null {
    let best: PlayerUnitState | null = null;
    let bestDistanceSq = Number.POSITIVE_INFINITY;
    this.unitOrder.forEach((unit) => {
      const dx = unit.position.x - position.x;
      const dy = unit.position.y - position.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < bestDistanceSq) {
        best = unit;
        bestDistanceSq = distanceSq;
      }
    });
    return best ? this.cloneUnit(best) : null;
  }

  public findUnitsNear(position: SceneVector2, radius: number): PlayerUnitState[] {
    if (radius < 0) {
      return [];
    }
    const radiusSq = radius * radius;
    const found: PlayerUnitState[] = [];
    this.unitOrder.forEach((unit) => {
      const dx = unit.position.x - position.x;
      const dy = unit.position.y - position.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq <= radiusSq) {
        found.push(this.cloneUnit(unit));
      }
    });
    return found;
  }

  public forEachUnitNear(
    position: SceneVector2,
    radius: number,
    visitor: (unit: PlayerUnitState) => void,
  ): void {
    if (radius < 0) {
      return;
    }
    const radiusSq = radius * radius;
    this.unitOrder.forEach((unit) => {
      const dx = unit.position.x - position.x;
      const dy = unit.position.y - position.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq <= radiusSq) {
        visitor(this.cloneUnit(unit));
      }
    });
  }

  public applyDamage(
    unitId: string,
    damage: number,
    options?: { 
      armorPenetration?: number;
      knockBackDistance?: number;
      knockBackSpeed?: number;
      knockBackDirection?: SceneVector2;
    },
  ): number {
    if (damage <= 0) {
      return 0;
    }
    const unit = this.units.get(unitId);
    if (!unit) {
      return 0;
    }
    const armorPenetration = Math.max(options?.armorPenetration ?? 0, 0);
    const effectiveArmor = Math.max(unit.armor - armorPenetration, 0);
    const inflicted = Math.max(damage - effectiveArmor, 0);
    if (inflicted <= 0) {
      return 0;
    }
    const previousHp = unit.hp;
    unit.hp = Math.max(unit.hp - inflicted, 0);
    if (previousHp !== unit.hp) {
      this.statistics?.recordDamageTaken(previousHp - unit.hp);
      
      // Apply knockback from enemy attack if configured
      if (options?.knockBackDirection && (options.knockBackDistance ?? 0) > 0) {
        this.applyEnemyKnockBack(unit, options.knockBackDirection, options.knockBackDistance ?? 0, options.knockBackSpeed ?? 0);
      }
    }
    return previousHp - unit.hp;
  }

  private findNearestBrickTarget(position: SceneVector2): BrickRuntimeState | null {
    const target = this.targeting.findNearestTarget(position, { types: ["brick"] });
    if (target && isTargetOfType<"brick", BrickRuntimeState>(target, "brick")) {
      return target.data ?? this.bricks.getBrickState(target.id);
    }
    return null;
  }

  private getBrickTarget(brickId: string): BrickRuntimeState | null {
    const target = this.targeting.getTargetById(brickId, { types: ["brick"] });
    if (target && isTargetOfType<"brick", BrickRuntimeState>(target, "brick")) {
      return target.data ?? this.bricks.getBrickState(target.id);
    }
    return null;
  }

  private getBrickIdsInRadius(position: SceneVector2, radius: number): string[] {
    const targets = this.targeting.findTargetsNear(position, radius, { types: ["brick"] });
    return targets.map((target) => target.id);
  }

  private applyKnockBack(
    unit: PlayerUnitState,
    direction: SceneVector2,
    distance: number,
    brick: BrickRuntimeState
  ): void {
    const knockBackDistance = Math.max(brick.brickKnockBackDistance ?? 0, 0);
    const knockBackSpeedRaw = brick.brickKnockBackSpeed ?? 0;
    if (knockBackDistance <= 0 && knockBackSpeedRaw <= 0) {
      return;
    }

    let axis = direction;
    if (distance > 0) {
      axis = scaleVector(direction, 1 / distance);
    } else if (!vectorHasLength(axis)) {
      axis = { x: Math.cos(unit.rotation), y: Math.sin(unit.rotation) };
    }

    if (!vectorHasLength(axis)) {
      axis = { x: 0, y: -1 };
    }

    const knockBackSpeed = Math.max(knockBackSpeedRaw, knockBackDistance * 2);
    if (knockBackSpeed <= 0) {
      return;
    }

    const reduction = Math.max(unit.knockBackReduction, 1);
    const knockbackVelocity = scaleVector(axis, -knockBackSpeed / reduction);
    this.movement.applyKnockback(unit.movementId, knockbackVelocity, 1);
  }

  private applyEnemyKnockBack(
    unit: PlayerUnitState,
    direction: SceneVector2,
    knockBackDistance: number,
    knockBackSpeedRaw: number
  ): void {
    if (knockBackDistance <= 0 && knockBackSpeedRaw <= 0) {
      return;
    }

    let axis = direction;
    const distance = vectorLength(direction);
    if (distance > 0) {
      axis = scaleVector(direction, 1 / distance);
    } else if (!vectorHasLength(axis)) {
      axis = { x: Math.cos(unit.rotation), y: Math.sin(unit.rotation) };
    }

    if (!vectorHasLength(axis)) {
      axis = { x: 0, y: -1 };
    }

    const knockBackSpeed = Math.max(knockBackSpeedRaw, knockBackDistance * 2);
    if (knockBackSpeed <= 0) {
      return;
    }

    const reduction = Math.max(unit.knockBackReduction, 1);
    const knockbackVelocity = scaleVector(axis, -knockBackSpeed / reduction);
    this.movement.applyKnockback(unit.movementId, knockbackVelocity, 1);
  }

  private cloneUnit(unit: PlayerUnitState): PlayerUnitState {
    return {
      ...unit,
      position: { ...unit.position },
      spawnPosition: { ...unit.spawnPosition },
      preCollisionVelocity: { ...unit.preCollisionVelocity },
      lastNonZeroVelocity: { ...unit.lastNonZeroVelocity },
      wanderTarget: unit.wanderTarget ? { ...unit.wanderTarget } : null,
    };
  }

  private removeUnit(unit: PlayerUnitState): void {
    if (unit.hp <= 0) {
      this.statistics?.recordCreatureDeath();
    }
    this.scene.removeObject(unit.objectId);
    this.movement.removeBody(unit.movementId);
    this.units.delete(unit.id);
    this.unitOrder = this.unitOrder.filter((current) => current.id !== unit.id);
    this.arcs?.clearArcsForUnit(unit.id);
    if (this.unitOrder.length === 0) {
      this.onAllUnitsDefeated?.();
    }
  }

  private clearUnits(): void {
    this.abilities.clearArcEffects();
    this.effects?.clearAllEffects();
    this.unitOrder.forEach((unit) => {
      this.scene.removeObject(unit.objectId);
      this.movement.removeBody(unit.movementId);
      this.arcs?.clearArcsForUnit(unit.id);
    });
    this.unitOrder = [];
    this.units.clear();
    this.abilities.resetRun();
  }

  private clampToMap(position: SceneVector2): SceneVector2 {
    const mapSize = this.scene.getMapSize();
    return {
      x: clampNumber(position.x, 0, mapSize.width),
      y: clampNumber(position.y, 0, mapSize.height),
    };
  }
}
