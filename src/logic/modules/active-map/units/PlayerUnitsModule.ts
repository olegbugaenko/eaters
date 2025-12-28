import { GameModule } from "../../../core/types";
import { DataBridge } from "../../../core/DataBridge";
import {
  SceneObjectManager,
  SceneVector2,
  FILL_TYPES,
  SceneFill,
  SceneColor,
  SceneStroke,
} from "../../../services/SceneObjectManager";
import { BricksModule, BrickRuntimeState } from "../BricksModule";
import {
  BURNING_TAIL_DAMAGE_RATIO_PER_SECOND,
  BURNING_TAIL_DURATION_MS,
  FREEZING_TAIL_DURATION_MS,
} from "../BrickEffectsManager";
import {
  PlayerUnitType,
  PLAYER_UNIT_TYPES,
  getPlayerUnitConfig,
  PlayerUnitRendererConfig,
  PlayerUnitRendererLayerConfig,
  PlayerUnitRendererFillConfig,
  PlayerUnitRendererStrokeConfig,
  isPlayerUnitType,
  PlayerUnitEmitterConfig,
  PlayerUnitConfig,
} from "../../../../db/player-units-db";
import { MovementService, MovementBodyState } from "../../../services/MovementService";
import { BonusValueMap, BonusesModule } from "../../shared/BonusesModule";
import {
  PlayerUnitBlueprintStats,
  PlayerUnitRuntimeModifiers,
} from "../../../../types/player-units";
import { ExplosionModule } from "../../scene/ExplosionModule";
import { UNIT_MODULE_IDS, UnitModuleId, getUnitModuleConfig } from "../../../../db/unit-modules-db";
import type { SkillId } from "../../../../db/skills-db";
import { getBonusConfig } from "../../../../db/bonuses-db";
import {
  VisualEffectState,
  createVisualEffectState,
  setVisualEffectFillOverlay,
  computeVisualEffectFillColor,
  computeVisualEffectStrokeColor,
} from "../../../visuals/VisualEffectState";
import { clampNumber, clampProbability } from "@/utils/helpers/numbers";
import { UnitTargetingMode } from "../../../../types/unit-targeting";
import { UnitDesignId } from "../../camp/UnitDesignModule";
import { ArcModule } from "../../scene/ArcModule";
import { EffectsModule } from "../../scene/EffectsModule";
import { FireballModule } from "../../scene/FireballModule";
import {
  AbilitySoundPlayer,
  PlayerUnitAbilities,
  PheromoneAttackBonusState,
} from "../PlayerUnitAbilities";
import { AbilityVisualService } from "../abilities/AbilityVisualService";
import { MapRunState } from "../MapRunState";
import type { StatisticsTracker } from "../../shared/StatisticsModule";
import { UnitStatisticsReporter } from "./UnitStatisticsReporter";
import { UnitFactory, UnitCreationData } from "./UnitFactory";
import { UnitRuntimeController } from "./UnitRuntimeController";
import { UnitProjectileController } from "./UnitProjectileController";
import { spawnTailNeedleVolley } from "./TailNeedleVolley";
import type { PlayerUnitState } from "./UnitTypes";
import {
  ATTACK_DISTANCE_EPSILON,
  COLLISION_RESOLUTION_ITERATIONS,
  ZERO_VECTOR,
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
} from "./UnitTypes";

const DEFAULT_CRIT_MULTIPLIER_BONUS = getBonusConfig(
  "all_units_crit_mult"
).defaultValue;

export const PLAYER_UNIT_COUNT_BRIDGE_KEY = "playerUnits/count";
export const PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY = "playerUnits/totalHp";
export const PLAYER_UNIT_BLUEPRINT_STATS_BRIDGE_KEY = "playerUnits/blueprintStats";
export const PLAYER_UNIT_COUNTS_BY_DESIGN_BRIDGE_KEY = "playerUnits/countsByDesign";

export interface PlayerUnitSpawnData {
  readonly designId?: UnitDesignId;
  readonly type: PlayerUnitType;
  readonly position: SceneVector2;
  readonly hp?: number;
  readonly attackCooldown?: number;
  readonly runtimeModifiers?: PlayerUnitRuntimeModifiers;
  readonly equippedModules?: UnitModuleId[];
}

interface PlayerUnitsModuleOptions {
  scene: SceneObjectManager;
  bricks: BricksModule;
  bridge: DataBridge;
  movement: MovementService;
  bonuses: BonusesModule;
  explosions: ExplosionModule;
  arcs?: ArcModule;
  effects?: EffectsModule;
  fireballs?: FireballModule;
  onAllUnitsDefeated?: () => void;
  getModuleLevel: (id: UnitModuleId) => number;
  hasSkill: (id: SkillId) => boolean;
  getDesignTargetingMode: (
    designId: UnitDesignId | null,
    type: PlayerUnitType
  ) => UnitTargetingMode;
  statistics?: StatisticsTracker;
  audio?: AbilitySoundPlayer;
  runState: MapRunState;
}

interface PlayerUnitSaveData {
  readonly units: PlayerUnitSpawnData[];
}

export class PlayerUnitsModule implements GameModule {
  public readonly id = "playerUnits";

  private readonly scene: SceneObjectManager;
  private readonly bricks: BricksModule;
  private readonly bridge: DataBridge;
  private readonly movement: MovementService;
  private readonly bonuses: BonusesModule;
  private readonly explosions: ExplosionModule;
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
  private readonly abilities: PlayerUnitAbilities;
  private readonly statistics?: StatisticsTracker;
  private readonly unitFactory: UnitFactory;
  private readonly runtimeController: UnitRuntimeController;
  private readonly projectiles: UnitProjectileController;
  private readonly runState: MapRunState;

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
    this.arcs = options.arcs;
    this.effects = options.effects;
    this.fireballs = options.fireballs;
    this.onAllUnitsDefeated = options.onAllUnitsDefeated;
    this.getModuleLevel = options.getModuleLevel;
    this.hasSkill = options.hasSkill;
    this.getDesignTargetingMode = options.getDesignTargetingMode;
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
        const brick = this.bricks.getBrickState(brickId);
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
        const nearbyBricks = this.bricks.findBricksNear(position, radius);
        return nearbyBricks.map((brick: BrickRuntimeState) => brick.id);
      },
      damageUnit: (unitId: string, damage: number) => {
        const unit = this.units.get(unitId);
        if (unit) {
          const previousHp = unit.hp;
          unit.hp = Math.max(unit.hp - damage, 0);
          const taken = Math.max(0, previousHp - unit.hp);
          if (taken > 0) {
            this.statistics?.recordDamageTaken(taken);
          }
        }
      },
      findNearestBrick: (position: SceneVector2) => {
        const brick = this.bricks.findNearestBrick(position);
        return brick?.id || null;
      },
      audio: options.audio,
    });

    this.statsReporter = new UnitStatisticsReporter({ bridge: this.bridge });

    this.unitFactory = new UnitFactory({
      scene: this.scene,
      movement: this.movement,
      getModuleLevel: this.getModuleLevel,
      hasSkill: this.hasSkill,
      getDesignTargetingMode: this.getDesignTargetingMode,
    });

    this.projectiles = new UnitProjectileController({
      scene: this.scene,
      bricks: this.bricks,
    });

    this.runtimeController = new UnitRuntimeController({
      scene: this.scene,
      movement: this.movement,
      bricks: this.bricks,
      abilities: this.abilities,
      statistics: this.statistics,
      explosions: this.explosions,
      projectiles: this.projectiles,
      getDesignTargetingMode: this.getDesignTargetingMode,
      syncUnitTargetingMode: (unit) => this.syncUnitTargetingMode(unit),
      removeUnit: (unit) => this.removeUnit(unit),
      updateSceneState: (unit, options) => this.pushUnitSceneState(unit, options),
      updateInternalFurnaceEffect: (unit) => this.updateInternalFurnaceEffect(unit),
    });
  }

  public getCurrentUnitCount(strategyFilter?: UnitTargetingMode): number {
    return this.unitOrder.filter(u => !strategyFilter || u.targetingMode !== strategyFilter).length;
  }

  public getActiveUnitCount(): number {
    return this.unitOrder.length;
  }

  public getEffectiveUnitCount(): number {
    // Count units that can attack (either normally or at distance)
    return this.unitOrder.filter(u => {
      if (u.hp <= 0) return false;
      
      // If unit has targeting mode other than "none", it can attack normally
      if (u.targetingMode !== "none") return true;
      
      // If unit has "none" targeting mode but can attack distant targets, count it
      return u.canUnitAttackDistant;
    }).length;
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
    this.abilities.update(deltaMs);

    const deltaSeconds = Math.max(deltaMs, 0) / 1000;
    const result = this.runtimeController.updateUnits(this.unitOrder, deltaSeconds);

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

    if (elapsedSeconds === 0 || this.unitOrder.length === 0) {
      return;
    }

    let statsDirty = false;
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

    if (statsDirty) {
      this.pushStats();
    }
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

  public unitStressTest(): void {
    this.ensureBlueprints();
    const center: SceneVector2 = { x: 100, y: 100 };
    const spread = 100;
    const spawnCount = 100;
    const spawnUnits: PlayerUnitSpawnData[] = [];
    const availableTypes = PLAYER_UNIT_TYPES;

    if (availableTypes.length === 0) {
      return;
    }

    for (let index = 0; index < spawnCount; index += 1) {
      const unitType = availableTypes[index % availableTypes.length]!;
      const offsetX = (Math.random() * 2 - 1) * spread;
      const offsetY = (Math.random() * 2 - 1) * spread;
      const position = this.clampToMap({
        x: center.x + offsetX,
        y: center.y + offsetY,
      });

      spawnUnits.push({
        type: unitType,
        position,
      });
    }

    this.applyUnits(spawnUnits);
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
    const blueprint = this.unitBlueprints.get(type);
    if (!blueprint) {
      throw new Error(`Missing blueprint stats for unit type: ${type}`);
    }

    const unitId = this.unitFactory.createUnitId();
    const factoryResult = this.unitFactory.createUnit(
      {
        designId: unit.designId,
        type,
        position: unit.position,
        hp: unit.hp,
        attackCooldown: unit.attackCooldown,
        runtimeModifiers: unit.runtimeModifiers,
        equippedModules: unit.equippedModules,
      },
      blueprint,
      unitId,
    );

    const moduleLevels: Partial<Record<UnitModuleId, number>> = {};
    factoryResult.abilityContext.equippedModules.forEach((moduleId) => {
      const level = Math.max(this.getModuleLevel(moduleId), 0);
      if (level > 0) {
        moduleLevels[moduleId] = level;
      }
    });

    const state: PlayerUnitState = {
      id: factoryResult.id,
      designId: factoryResult.designId,
      type: factoryResult.type,
      position: { ...factoryResult.position },
      spawnPosition: { ...factoryResult.spawnPosition },
      movementId: factoryResult.movementId,
      rotation: 0,
      hp: factoryResult.hp,
      maxHp: factoryResult.maxHp,
      armor: factoryResult.armor,
      hpRegenPerSecond: factoryResult.hpRegenPerSecond,
      armorPenetration: factoryResult.armorPenetration,
      baseAttackDamage: factoryResult.baseAttackDamage,
      baseAttackInterval: factoryResult.baseAttackInterval,
      baseAttackDistance: factoryResult.baseAttackDistance,
      moveSpeed: factoryResult.moveSpeed,
      moveAcceleration: factoryResult.moveAcceleration,
      mass: factoryResult.mass,
      physicalSize: factoryResult.physicalSize,
      critChance: factoryResult.critChance,
      critMultiplier: factoryResult.critMultiplier,
      rewardMultiplier: factoryResult.rewardMultiplier,
      damageTransferPercent: factoryResult.damageTransferPercent,
      damageTransferRadius: factoryResult.damageTransferRadius,
      attackStackBonusPerHit: factoryResult.attackStackBonusPerHit,
      attackStackBonusCap: factoryResult.attackStackBonusCap,
      currentAttackStackBonus: 0,
      attackCooldown: factoryResult.attackCooldown,
      targetBrickId: null,
      objectId: factoryResult.objectId,
      renderer: factoryResult.renderer,
      emitter: factoryResult.emitter,
      baseFillColor: factoryResult.baseFillColor,
      baseStrokeColor: factoryResult.baseStrokeColor,
      appliedFillColor: { ...factoryResult.baseFillColor },
      appliedStrokeColor: factoryResult.baseStrokeColor ? { ...factoryResult.baseStrokeColor } : undefined,
      visualEffects: factoryResult.visualEffects,
      visualEffectsDirty: false,
      preCollisionVelocity: { ...ZERO_VECTOR },
      lastNonZeroVelocity: { ...ZERO_VECTOR },
      timeSinceLastAttack: 0,
      timeSinceLastSpecial: this.abilities.getAbilityCooldownSeconds(),
      pheromoneHealingMultiplier: factoryResult.pheromoneHealingMultiplier,
      pheromoneAggressionMultiplier: factoryResult.pheromoneAggressionMultiplier,
      pheromoneAttackBonuses: [],
      fireballDamageMultiplier: factoryResult.fireballDamageMultiplier,
      canUnitAttackDistant: factoryResult.canUnitAttackDistant,
      moduleLevels,
      equippedModules: factoryResult.abilityContext.equippedModules,
      ownedSkills: factoryResult.abilityContext.ownedSkills,
      targetingMode: factoryResult.targetingMode as UnitTargetingMode,
      wanderTarget: null,
      wanderCooldown: 0,
    };

    this.updateInternalFurnaceEffect(state);
    if (state.visualEffectsDirty) {
      this.pushUnitSceneState(state, { forceFill: true });
    }

    return state;
  }

  private resolveTarget(unit: PlayerUnitState): BrickRuntimeState | null {
    const mode = this.syncUnitTargetingMode(unit);
    if (mode === "none") {
      unit.targetBrickId = null;
      return null;
    }

    if (unit.targetBrickId) {
      const current = this.bricks.getBrickState(unit.targetBrickId);
      if (current && current.hp > 0) {
        return current;
      }
      unit.targetBrickId = null;
    }

    const selected = this.selectTargetForMode(unit, mode);
    unit.targetBrickId = selected?.id ?? null;
    return selected;
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

  private selectTargetForMode(
    unit: PlayerUnitState,
    mode: UnitTargetingMode
  ): BrickRuntimeState | null {
    if (mode === "nearest") {
      return this.bricks.findNearestBrick(unit.position);
    }
    return this.findBrickByCriterion(unit, mode);
  }

  private findBrickByCriterion(
    unit: PlayerUnitState,
    mode: UnitTargetingMode
  ): BrickRuntimeState | null {
    const mapSize = this.scene.getMapSize();
    const maxRadius = Math.max(Math.hypot(mapSize.width, mapSize.height), TARGETING_RADIUS_STEP);
    let radius = TARGETING_RADIUS_STEP;
    while (radius <= maxRadius + TARGETING_RADIUS_STEP) {
      const bricks = this.bricks.findBricksNear(unit.position, radius);
      const candidate = this.pickBestBrickCandidate(unit.position, bricks, mode);
      if (candidate) {
        return candidate;
      }
      radius += TARGETING_RADIUS_STEP;
    }
    return this.bricks.findNearestBrick(unit.position);
  }

  private pickBestBrickCandidate(
    origin: SceneVector2,
    bricks: BrickRuntimeState[],
    mode: UnitTargetingMode
  ): BrickRuntimeState | null {
    let best: BrickRuntimeState | null = null;
    let bestScore = 0;
    let bestDistanceSq = 0;
    bricks.forEach((brick: BrickRuntimeState) => {
      if (!brick || brick.hp <= 0) {
        return;
      }
      const score = this.computeBrickScore(brick, mode);
      if (score === null) {
        return;
      }
      const dx = brick.position.x - origin.x;
      const dy = brick.position.y - origin.y;
      const distanceSq = dx * dx + dy * dy;
      if (!Number.isFinite(distanceSq)) {
        return;
      }
      if (!best) {
        best = brick;
        bestScore = score;
        bestDistanceSq = distanceSq;
        return;
      }
      if (
        this.isCandidateBetter(mode, score, distanceSq, bestScore, bestDistanceSq)
      ) {
        best = brick;
        bestScore = score;
        bestDistanceSq = distanceSq;
      }
    });
    return best;
  }

  private computeBrickScore(
    brick: BrickRuntimeState,
    mode: UnitTargetingMode
  ): number | null {
    switch (mode) {
      case "highestHp":
      case "lowestHp":
        return Math.max(brick.hp, 0);
      case "highestDamage":
      case "lowestDamage":
        return Math.max(brick.baseDamage, 0);
      default:
        return null;
    }
  }

  private isCandidateBetter(
    mode: UnitTargetingMode,
    candidateScore: number,
    candidateDistanceSq: number,
    bestScore: number,
    bestDistanceSq: number
  ): boolean {
    const distanceImproved =
      candidateDistanceSq + TARGETING_SCORE_EPSILON < bestDistanceSq;
    if (mode === "highestHp" || mode === "highestDamage") {
      if (candidateScore > bestScore + TARGETING_SCORE_EPSILON) {
        return true;
      }
      if (Math.abs(candidateScore - bestScore) <= TARGETING_SCORE_EPSILON) {
        return distanceImproved;
      }
      return false;
    }
    if (mode === "lowestHp" || mode === "lowestDamage") {
      if (candidateScore + TARGETING_SCORE_EPSILON < bestScore) {
        return true;
      }
      if (Math.abs(candidateScore - bestScore) <= TARGETING_SCORE_EPSILON) {
        return distanceImproved;
      }
      return false;
    }
    return false;
  }

  private computeDesiredForce(
    unit: PlayerUnitState,
    movementState: MovementBodyState,
    target: BrickRuntimeState | null
  ): SceneVector2 {
    if (!target) {
      if (unit.targetingMode === "none") {
        return this.computeIdleWanderForce(unit, movementState);
      }
      return this.computeBrakingForce(unit, movementState);
    }

    const toTarget = subtractVectors(target.position, unit.position);
    const distance = vectorLength(toTarget);
    const attackRange = unit.baseAttackDistance + unit.physicalSize + target.physicalSize;
    const distanceOutsideRange = Math.max(distance - attackRange, 0);

    if (distanceOutsideRange <= 0) {
      return this.computeBrakingForce(unit, movementState);
    }

    const direction = distance > 0 ? scaleVector(toTarget, 1 / distance) : ZERO_VECTOR;
    if (!vectorHasLength(direction)) {
      return ZERO_VECTOR;
    }

    const desiredSpeed = Math.max(
      Math.min(unit.moveSpeed, distanceOutsideRange),
      unit.moveSpeed * 0.25
    );
    const desiredVelocity = scaleVector(direction, desiredSpeed);

    return this.computeSteeringForce(unit, movementState.velocity, desiredVelocity);
  }

  private computeBrakingForce(
    unit: PlayerUnitState,
    movementState: MovementBodyState
  ): SceneVector2 {
    if (!vectorHasLength(movementState.velocity)) {
      return ZERO_VECTOR;
    }
    return this.computeSteeringForce(unit, movementState.velocity, ZERO_VECTOR);
  }

  private computeIdleWanderForce(
    unit: PlayerUnitState,
    movementState: MovementBodyState
  ): SceneVector2 {
    const target = this.ensureIdleWanderTarget(unit);
    const toTarget = subtractVectors(target, unit.position);
    const distance = vectorLength(toTarget);
    if (distance <= IDLE_WANDER_TARGET_EPSILON) {
      unit.wanderTarget = null;
      unit.wanderCooldown = 0;
      return this.computeBrakingForce(unit, movementState);
    }
    const direction = distance > 0 ? scaleVector(toTarget, 1 / distance) : ZERO_VECTOR;
    if (!vectorHasLength(direction)) {
      unit.wanderTarget = null;
      return this.computeBrakingForce(unit, movementState);
    }
    const desiredSpeed = Math.max(unit.moveSpeed * IDLE_WANDER_SPEED_FACTOR, unit.moveSpeed * 0.2);
    const cappedSpeed = Math.min(desiredSpeed, Math.max(distance, unit.moveSpeed * 0.2));
    const desiredVelocity = scaleVector(direction, cappedSpeed);
    return this.computeSteeringForce(unit, movementState.velocity, desiredVelocity);
  }

  private ensureIdleWanderTarget(unit: PlayerUnitState): SceneVector2 {
    if (!unit.wanderTarget || unit.wanderCooldown <= 0) {
      unit.wanderTarget = this.createIdleWanderTarget(unit);
      unit.wanderCooldown = IDLE_WANDER_RESEED_INTERVAL;
    }
    return unit.wanderTarget ?? unit.position;
  }

  private createIdleWanderTarget(unit: PlayerUnitState): SceneVector2 {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * IDLE_WANDER_RADIUS;
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;
    const candidate = {
      x: unit.spawnPosition.x + offsetX,
      y: unit.spawnPosition.y + offsetY,
    };
    return this.clampToMap(candidate);
  }

  private resolveUnitCollisions(
    unit: PlayerUnitState,
    position: SceneVector2,
    velocity: SceneVector2
  ): {
    position: SceneVector2;
    velocity: SceneVector2;
    collidedBrickIds: string[];
  } {
    if (unit.physicalSize <= 0) {
      return { position, velocity, collidedBrickIds: [] };
    }

    let resolvedPosition = { ...position };
    let resolvedVelocity = { ...velocity };
    let adjusted = false;
    const collidedBrickIds = new Set<string>();

    for (let iteration = 0; iteration < COLLISION_RESOLUTION_ITERATIONS; iteration += 1) {
      let collided = false;
      this.bricks.forEachBrickNear(resolvedPosition, unit.physicalSize, (brick) => {
        const brickRadius = Math.max(brick.physicalSize, 0);
        const combinedRadius = unit.physicalSize + brickRadius;
        if (combinedRadius <= 0) {
          return;
        }

        const offset = subtractVectors(resolvedPosition, brick.position);
        const distance = vectorLength(offset);
        if (!Number.isFinite(distance) || distance >= combinedRadius) {
          return;
        }

        const normal = distance > 0 ? scaleVector(offset, 1 / distance) : { x: 1, y: 0 };
        const correction = combinedRadius - distance;
        resolvedPosition = addVectors(resolvedPosition, scaleVector(normal, correction));

        const velocityAlongNormal = resolvedVelocity.x * normal.x + resolvedVelocity.y * normal.y;
        if (velocityAlongNormal < 0) {
          resolvedVelocity = subtractVectors(
            resolvedVelocity,
            scaleVector(normal, velocityAlongNormal)
          );
        }

        collided = true;
        adjusted = true;
        collidedBrickIds.add(brick.id);
      });

      if (!collided) {
        break;
      }
    }

    if (!adjusted) {
      return { position, velocity, collidedBrickIds: [] };
    }

    resolvedPosition = this.clampToMap(resolvedPosition);
    return {
      position: resolvedPosition,
      velocity: resolvedVelocity,
      collidedBrickIds: [...collidedBrickIds],
    };
  }

  private computeSteeringForce(
    unit: PlayerUnitState,
    currentVelocity: SceneVector2,
    desiredVelocity: SceneVector2
  ): SceneVector2 {
    const steering = subtractVectors(desiredVelocity, currentVelocity);
    const magnitude = vectorLength(steering);
    const maxForce = Math.max(unit.moveAcceleration * unit.mass, 0);
    if (magnitude <= 0 || maxForce <= 0) {
      return ZERO_VECTOR;
    }

    if (magnitude > maxForce) {
      return scaleVector(steering, maxForce / magnitude);
    }

    return steering;
  }

  private computeRotation(
    unit: PlayerUnitState,
    target: BrickRuntimeState | null,
    velocity: SceneVector2
  ): number {
    if (target) {
      const toTarget = subtractVectors(target.position, unit.position);
      if (vectorHasLength(toTarget)) {
        return Math.atan2(toTarget.y, toTarget.x);
      }
    }

    if (vectorHasLength(velocity)) {
      return Math.atan2(velocity.y, velocity.x);
    }

    return unit.rotation;
  }

  private getAttackOutcome(
    unit: PlayerUnitState
  ): { damage: number; isCritical: boolean } {
    const cappedStack = Math.min(
      Math.max(unit.currentAttackStackBonus, 0),
      Math.max(unit.attackStackBonusCap, 0)
    );
    const stackMultiplier = 1 + cappedStack;
    const baseDamage = Math.max(unit.baseAttackDamage * stackMultiplier, 0);
    // Apply ±20% variance around the mean damage
    const variance = 0.2;
    const varianceMultiplier = 1 - variance + Math.random() * (variance * 2); // [0.8; 1.2]
    let damage = baseDamage * Math.max(varianceMultiplier, 0);
    const critChance = clampProbability(unit.critChance);
    const critMultiplier = Math.max(unit.critMultiplier, 1);
    const isCritical = critChance > 0 && Math.random() < critChance;
    if (isCritical) {
      damage *= critMultiplier;
    }
    return { damage: roundStat(damage), isCritical };
  }

  private performAttack(
    unit: PlayerUnitState,
    target: BrickRuntimeState,
    direction: SceneVector2,
    distance: number
  ): boolean {
    let hpChanged = false;
    unit.attackCooldown = unit.baseAttackInterval;
    unit.timeSinceLastAttack = 0;
    const { damage, isCritical } = this.getAttackOutcome(unit);
    const bonusDamage = this.abilities.consumeAttackBonuses(unit);
    const totalDamage = Math.max(damage + bonusDamage, 0);
    const result = this.bricks.applyDamage(target.id, totalDamage, direction, {
      rewardMultiplier: unit.rewardMultiplier,
      armorPenetration: unit.armorPenetration,
    });
    const surviving = result.brick ?? target;

    if (isCritical && totalDamage > 0) {
      const effectPosition = result.brick?.position ?? target.position;
      this.spawnCriticalHitEffect(effectPosition);
    }

    const inflictedDamage = result.inflictedDamage;
    const effectOrigin = result.brick?.position ?? target.position;
    const skipBrickId = !result.destroyed && surviving ? surviving.id : null;

    const meltingLevel = unit.moduleLevels?.burningTail ?? 0;
    if (meltingLevel > 0 && inflictedDamage > 0) {
      const meltingConfig = getUnitModuleConfig("burningTail");
      const meltingRadius = meltingConfig.meta?.areaRadius ?? 0;
      const base = Number.isFinite(meltingConfig.baseBonusValue) ? meltingConfig.baseBonusValue : 0;
      const perLevel = Number.isFinite(meltingConfig.bonusPerLevel) ? meltingConfig.bonusPerLevel : 0;
      const multiplier = Math.max(base + perLevel * Math.max(meltingLevel - 1, 0), 1);

      if (!result.destroyed && surviving) {
        this.bricks.applyEffect({
          type: "meltingTail",
          brickId: surviving.id,
          durationMs: BURNING_TAIL_DURATION_MS,
          multiplier,
        });
      }

      if (meltingRadius > 0) {
        this.bricks.forEachBrickNear(effectOrigin, meltingRadius, (brick) => {
          if (skipBrickId && brick.id === skipBrickId) {
            return;
          }
          this.bricks.applyEffect({
            type: "meltingTail",
            brickId: brick.id,
            durationMs: BURNING_TAIL_DURATION_MS,
            multiplier,
          });
        });
      }
    }

    const freezingLevel = unit.moduleLevels?.freezingTail ?? 0;
    if (freezingLevel > 0 && totalDamage > 0) {
      const divisor = 1.5 + 0.05 * freezingLevel;
      const freezingRadius = getUnitModuleConfig("freezingTail").meta?.areaRadius ?? 0;

      if (!result.destroyed && surviving) {
        this.bricks.applyEffect({
          type: "freezingTail",
          brickId: surviving.id,
          durationMs: FREEZING_TAIL_DURATION_MS,
          divisor,
        });
      }

      if (freezingRadius > 0) {
        this.bricks.forEachBrickNear(effectOrigin, freezingRadius, (brick) => {
          if (skipBrickId && brick.id === skipBrickId) {
            return;
          }
          this.bricks.applyEffect({
            type: "freezingTail",
            brickId: brick.id,
            durationMs: FREEZING_TAIL_DURATION_MS,
            divisor,
          });
        });
      }
    }

    spawnTailNeedleVolley({
      unit,
      attackDirection: direction,
      inflictedDamage,
      totalDamage,
      projectiles: this.projectiles,
    });

    if (totalDamage > 0 && unit.damageTransferPercent > 0) {
      const splashDamage = totalDamage * unit.damageTransferPercent;
      if (splashDamage > 0) {
        this.bricks.forEachBrickNear(target.position, unit.damageTransferRadius, (brick) => {
          if (brick.id === target.id) {
            return;
          }
          this.bricks.applyDamage(brick.id, splashDamage, direction, {
            rewardMultiplier: unit.rewardMultiplier,
            armorPenetration: unit.armorPenetration,
          });
        });
      }
    }

    if (surviving) {
      this.applyKnockBack(unit, direction, distance, surviving);
    }

    const counterSource = surviving ?? target;
    const outgoingMultiplier = this.bricks.getOutgoingDamageMultiplier(counterSource.id);
    const flatReduction = this.bricks.getOutgoingDamageFlatReduction(counterSource.id);
    const scaledBaseDamage = Math.max(counterSource.baseDamage * outgoingMultiplier - flatReduction, 0);
    const counterDamage = Math.max(scaledBaseDamage - unit.armor, 0);
    if (counterDamage > 0) {
      const previousHp = unit.hp;
      unit.hp = clampNumber(unit.hp - counterDamage, 0, unit.maxHp);
      const taken = Math.max(0, previousHp - unit.hp);
      if (taken > 0) {
        this.statistics?.recordDamageTaken(taken);
        hpChanged = true;
      }
    }

    if (unit.attackStackBonusPerHit > 0 && unit.attackStackBonusCap > 0) {
      const nextStack = unit.currentAttackStackBonus + unit.attackStackBonusPerHit;
      unit.currentAttackStackBonus = Math.min(nextStack, unit.attackStackBonusCap);
      this.updateInternalFurnaceEffect(unit);
    }

    if (result.destroyed) {
      unit.targetBrickId = null;
    }

    this.pushUnitSceneState(unit);
    return hpChanged;
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

    const impulse = scaleVector(axis, -knockBackSpeed);
    this.movement.applyImpulse(unit.movementId, impulse, 1);
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
  }

  private clampToMap(position: SceneVector2): SceneVector2 {
    const mapSize = this.scene.getMapSize();
    return {
      x: clampNumber(position.x, 0, mapSize.width),
      y: clampNumber(position.y, 0, mapSize.height),
    };
  }

  private computeFireballDamageMultiplier(equippedModules: UnitModuleId[]): number {
    const fireballLevel = equippedModules.includes("fireballOrgan")
      ? Math.max(this.getModuleLevel("fireballOrgan"), 0)
      : 0;
    return fireballLevel > 0 ? 1.75 + 0.075 * fireballLevel : 0;
  }
}

export const computePlayerUnitBlueprint = (
  type: PlayerUnitType,
  values: BonusValueMap
): PlayerUnitBlueprintStats => {
  const config = getPlayerUnitConfig(type);
  const baseAttack = Math.max(config.baseAttackDamage, 0);
  const baseHp = Math.max(config.maxHp, 0);
  const baseInterval = Math.max(config.baseAttackInterval, 0.01);
  const baseDistance = Math.max(config.baseAttackDistance, 0);
  const baseMoveSpeed = Math.max(config.moveSpeed, 0);
  const baseMoveAcceleration = Math.max(config.moveAcceleration, 0);
  const baseMass = Math.max(config.mass, 0.001);
  const baseSize = Math.max(config.physicalSize, 0);
  const baseCritChance = clampProbability(config.baseCritChance ?? 0);
  const baseCritMultiplier = Math.max(
    config.baseCritMultiplier ?? DEFAULT_CRIT_MULTIPLIER_BONUS,
    1
  );

  const globalAttackMultiplier = sanitizeMultiplier(
    values["all_units_attack_multiplier"],
    1
  );
  const globalHpMultiplier = sanitizeMultiplier(values["all_units_hp_multiplier"], 1);
  const globalArmorBonus = sanitizeAdditive(values["all_units_armor"], 0);
  const globalCritChanceBonus = sanitizeAdditive(values["all_units_crit_chance"], 0);
  const globalCritMultiplierRaw = sanitizeMultiplier(
    values["all_units_crit_mult"],
    DEFAULT_CRIT_MULTIPLIER_BONUS
  );
  const globalCritMultiplier = normalizeMultiplier(
    globalCritMultiplierRaw,
    DEFAULT_CRIT_MULTIPLIER_BONUS
  );
  const globalHpRegenPercentage = Math.max(
    sanitizeAdditive(values["all_units_hp_regen_percentage"], 0),
    0
  );
  const globalArmorPenetration = Math.max(
    sanitizeAdditive(values["all_units_armor_penetration"], 0),
    0
  );

  let specificAttackMultiplier = 1;
  let specificHpMultiplier = 1;
  let specificCritChanceBonus = 0;
  let specificCritMultiplier = 1;

  switch (type) {
    case "bluePentagon":
      specificAttackMultiplier = sanitizeMultiplier(
        values["blue_vanguard_attack_multiplier"],
        1
      );
      specificHpMultiplier = sanitizeMultiplier(
        values["blue_vanguard_hp_multiplier"],
        1
      );
      break;
    default:
      break;
  }

  const attackMultiplier = Math.max(globalAttackMultiplier, 0) * Math.max(specificAttackMultiplier, 0);
  const hpMultiplier = Math.max(globalHpMultiplier, 0) * Math.max(specificHpMultiplier, 0);
  const critMultiplierMultiplier =
    Math.max(globalCritMultiplier, 0) * Math.max(specificCritMultiplier, 0);
  const totalCritChanceBonus = globalCritChanceBonus + specificCritChanceBonus;

  const effectiveAttack = roundStat(baseAttack * attackMultiplier);
  const effectiveHp = roundStat(baseHp * hpMultiplier);
  const effectiveCritMultiplier = roundStat(
    baseCritMultiplier * Math.max(critMultiplierMultiplier, 0)
  );
  const effectiveCritChance = clampProbability(baseCritChance + totalCritChanceBonus);
  const hpRegenPerSecond = roundStat(
    Math.max(effectiveHp, 0) * (globalHpRegenPercentage * 0.01)
  );

  return {
    type,
    name: config.name,
    base: {
      attackDamage: baseAttack,
      maxHp: baseHp,
    },
    damageVariance: { minMultiplier: 0.8, maxMultiplier: 1.2 },
    effective: {
      attackDamage: effectiveAttack,
      maxHp: Math.max(effectiveHp, 1),
    },
    multipliers: {
      attackDamage: attackMultiplier,
      maxHp: hpMultiplier,
    },
    critChance: {
      base: baseCritChance,
      bonus: effectiveCritChance - baseCritChance,
      effective: effectiveCritChance,
    },
    critMultiplier: {
      base: baseCritMultiplier,
      multiplier: Math.max(critMultiplierMultiplier, 0),
      effective: Math.max(effectiveCritMultiplier, 1),
    },
    armor: Math.max(config.armor, 0) + globalArmorBonus,
    hpRegenPerSecond,
    hpRegenPercentage: globalHpRegenPercentage,
    armorPenetration: globalArmorPenetration,
    baseAttackInterval: baseInterval,
    baseAttackDistance: baseDistance,
    moveSpeed: baseMoveSpeed,
    moveAcceleration: baseMoveAcceleration,
    mass: baseMass,
    physicalSize: baseSize,
  };
};

export const sanitizeMultiplier = (value: number | undefined, fallback = 1): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  if (value < 0) {
    return 0;
  }
  return value;
};

export const sanitizeAdditive = (value: number | undefined, fallback = 0): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
};

export const normalizeMultiplier = (value: number, baseline: number): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  if (!Number.isFinite(baseline) || Math.abs(baseline) < 1e-9) {
    return Math.max(value, 0);
  }
  return Math.max(value, 0) / Math.max(baseline, 1e-9);
};

export const roundStat = (value: number): number => Math.round(value * 100) / 100;

export { clampProbability, clampNumber } from "@/utils/helpers/numbers";

const sanitizeNumber = (value: number | undefined): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
};

const sanitizeRuntimeModifiers = (
  modifiers: PlayerUnitRuntimeModifiers | undefined
): PlayerUnitRuntimeModifiers => ({
  rewardMultiplier: Math.max(modifiers?.rewardMultiplier ?? 1, 0),
  damageTransferPercent: Math.max(modifiers?.damageTransferPercent ?? 0, 0),
  damageTransferRadius: Math.max(modifiers?.damageTransferRadius ?? 0, 0),
  attackStackBonusPerHit: Math.max(modifiers?.attackStackBonusPerHit ?? 0, 0),
  attackStackBonusCap: Math.max(modifiers?.attackStackBonusCap ?? 0, 0),
});

const sanitizeUnitType = (value: PlayerUnitType | undefined): PlayerUnitType => {
  if (isPlayerUnitType(value)) {
    return value;
  }
  return "bluePentagon";
};

const cloneEmitter = (
  config: PlayerUnitEmitterConfig
): PlayerUnitEmitterConfig => ({
  particlesPerSecond: config.particlesPerSecond,
  particleLifetimeMs: config.particleLifetimeMs,
  fadeStartMs: config.fadeStartMs,
  baseSpeed: config.baseSpeed,
  speedVariation: config.speedVariation,
  sizeRange: { min: config.sizeRange.min, max: config.sizeRange.max },
  spread: config.spread,
  offset: { x: config.offset.x, y: config.offset.y },
  color: {
    r: config.color.r,
    g: config.color.g,
    b: config.color.b,
    a: config.color.a,
  },
  fill: config.fill ? cloneFill(config.fill) : undefined,
  shape: config.shape,
  maxParticles: config.maxParticles,
});

const cloneSceneColor = (color: SceneColor): SceneColor => ({
  r: color.r,
  g: color.g,
  b: color.b,
  a: typeof color.a === "number" ? color.a : 1,
});

const sceneColorsEqual = (
  a: SceneColor | undefined,
  b: SceneColor | undefined,
  epsilon = 1e-3
): boolean => {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    Math.abs(a.r - b.r) <= epsilon &&
    Math.abs(a.g - b.g) <= epsilon &&
    Math.abs(a.b - b.b) <= epsilon &&
    Math.abs((a.a ?? 1) - (b.a ?? 1)) <= epsilon
  );
};

const cloneRendererConfigForScene = (
  renderer: PlayerUnitRendererConfig
): PlayerUnitRendererConfig => ({
  kind: renderer.kind,
  fill: { ...renderer.fill },
  stroke: renderer.stroke
    ? {
        color: { ...renderer.stroke.color },
        width: renderer.stroke.width,
      }
    : undefined,
  layers: renderer.layers.map((layer: PlayerUnitRendererLayerConfig) => cloneRendererLayer(layer)),
});

const cloneRendererLayer = (
  layer: PlayerUnitRendererLayerConfig
): PlayerUnitRendererLayerConfig => {
  if (layer.shape === "polygon") {
    return {
      shape: "polygon",
      vertices: layer.vertices.map((vertex: { x: number; y: number }) => ({ x: vertex.x, y: vertex.y })),
      offset: layer.offset ? { ...layer.offset } : undefined,
      fill: cloneRendererFill(layer.fill),
      stroke: cloneRendererStroke(layer.stroke),
      // preserve conditional visibility flags
      requiresModule: (layer as any).requiresModule,
      requiresSkill: (layer as any).requiresSkill,
      requiresEffect: (layer as any).requiresEffect,
      // animation/meta
      anim: (layer as any).anim,
      spine: (layer as any).spine,
      segmentIndex: (layer as any).segmentIndex,
      buildOpts: (layer as any).buildOpts,
      groupId: (layer as any).groupId,
    };
  }
  return {
    shape: "circle",
    radius: layer.radius,
    segments: layer.segments,
    offset: layer.offset ? { ...layer.offset } : undefined,
    fill: cloneRendererFill(layer.fill),
    stroke: cloneRendererStroke(layer.stroke),
    // preserve conditional visibility flags
    requiresModule: (layer as any).requiresModule,
    requiresSkill: (layer as any).requiresSkill,
    requiresEffect: (layer as any).requiresEffect,
    // animation/meta
    anim: (layer as any).anim,
    groupId: (layer as any).groupId,
  };
};

const cloneRendererFill = (
  fill: PlayerUnitRendererFillConfig | undefined
): PlayerUnitRendererFillConfig | undefined => {
  if (!fill) {
    return undefined;
  }
  if (fill.type === "solid") {
    return {
      type: "solid",
      color: { ...fill.color },
      ...(fill.noise ? { noise: { ...fill.noise } } : {}),
      ...(fill.filaments ? { filaments: { ...fill.filaments } } : {}),
    };
  }
  if (fill.type === "gradient") {
    return { type: "gradient", fill: cloneFill(fill.fill) };
  }
  return {
    type: "base",
    brightness: fill.brightness,
    alphaMultiplier: fill.alphaMultiplier,
  };
};

const cloneRendererStroke = (
  stroke: PlayerUnitRendererStrokeConfig | undefined
): PlayerUnitRendererStrokeConfig | undefined => {
  if (!stroke) {
    return undefined;
  }
  if (stroke.type === "solid") {
    return {
      type: "solid",
      width: stroke.width,
      color: { ...stroke.color },
    };
  }
  return {
    type: "base",
    width: stroke.width,
    brightness: stroke.brightness,
    alphaMultiplier: stroke.alphaMultiplier,
  };
};

const cloneFill = (fill: SceneFill): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID:
      return {
        fillType: FILL_TYPES.SOLID,
        color: { ...fill.color },
        ...(fill.noise ? { noise: { ...fill.noise } } : {}),
        ...(fill.filaments ? { filaments: { ...fill.filaments } } : {}),
      };
    case FILL_TYPES.LINEAR_GRADIENT:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
        ...(fill.noise ? { noise: { ...fill.noise } } : {}),
        ...(fill.filaments ? { filaments: { ...fill.filaments } } : {}),
      };
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT:
      return {
        fillType: fill.fillType,
        start: fill.start ? { ...fill.start } : undefined,
        end: typeof fill.end === "number" ? fill.end : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
        ...(fill.noise ? { noise: { ...fill.noise } } : {}),
        ...(fill.filaments ? { filaments: { ...fill.filaments } } : {}),
      } as SceneFill;
    default:
      return fill;
  }
};

const cloneVector = (vector: SceneVector2): SceneVector2 => ({ x: vector.x, y: vector.y });

const addVectors = (a: SceneVector2, b: SceneVector2): SceneVector2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

const subtractVectors = (a: SceneVector2, b: SceneVector2): SceneVector2 => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

const scaleVector = (vector: SceneVector2, scalar: number): SceneVector2 => ({
  x: vector.x * scalar,
  y: vector.y * scalar,
});

const vectorLength = (vector: SceneVector2): number => Math.hypot(vector.x, vector.y);

const vectorHasLength = (vector: SceneVector2, epsilon = 0.0001): boolean =>
  Math.abs(vector.x) > epsilon || Math.abs(vector.y) > epsilon;

const vectorEquals = (a: SceneVector2, b: SceneVector2, epsilon = 0.0001): boolean =>
  Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
