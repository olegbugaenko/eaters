import { GameModule } from "../core/types";
import { DataBridge } from "../core/DataBridge";
import {
  SceneObjectManager,
  SceneVector2,
  FILL_TYPES,
  SceneFill,
  SceneColor,
  SceneStroke,
} from "../services/SceneObjectManager";
import { BricksModule, BrickRuntimeState } from "./BricksModule";
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
} from "../../db/player-units-db";
import { MovementService, MovementBodyState } from "../services/MovementService";
import { BonusValueMap, BonusesModule } from "./BonusesModule";
import {
  PlayerUnitBlueprintStats,
  PlayerUnitRuntimeModifiers,
} from "../../types/player-units";
import { ExplosionModule } from "./ExplosionModule";
import { UNIT_MODULE_IDS, UnitModuleId, getUnitModuleConfig } from "../../db/unit-modules-db";
import type { SkillId } from "../../db/skills-db";
import { getBonusConfig } from "../../db/bonuses-db";
import {
  VisualEffectState,
  createVisualEffectState,
  setVisualEffectFillOverlay,
  computeVisualEffectFillColor,
  computeVisualEffectStrokeColor,
} from "../visuals/VisualEffectState";
import { UnitTargetingMode } from "../../types/unit-targeting";
import { UnitDesignId } from "./UnitDesignModule";
import { getArcConfig } from "../../db/arcs-db";
import { ArcModule } from "./ArcModule";
import { EffectsModule } from "./EffectsModule";

const ATTACK_DISTANCE_EPSILON = 0.001;
const COLLISION_RESOLUTION_ITERATIONS = 4;
const ZERO_VECTOR: SceneVector2 = { x: 0, y: 0 };
const CRITICAL_HIT_EXPLOSION_RADIUS = 12;
const DEFAULT_CRIT_MULTIPLIER_BONUS = getBonusConfig(
  "all_units_crit_mult"
).defaultValue;
const INTERNAL_FURNACE_EFFECT_ID = "internalFurnace/heat";
const INTERNAL_FURNACE_TINT_COLOR: SceneColor = {
  r: 0.98,
  g: 0.35,
  b: 0.32,
  a: 1,
};
const INTERNAL_FURNACE_MAX_INTENSITY = 0.75;
const INTERNAL_FURNACE_EFFECT_PRIORITY = 50;
const DEFAULT_PHEROMONE_IDLE_THRESHOLD_SECONDS = 2;
const PHEROMONE_TIMER_CAP_SECONDS = 60;
const DEFAULT_PHEROMONE_BUFF_ATTACKS = 4;
const PHEROMONE_HEAL_EXPLOSION_RADIUS = 14;
const PHEROMONE_FRENZY_EXPLOSION_RADIUS = 12;
const TARGETING_RADIUS_STEP = 250;
const IDLE_WANDER_RADIUS = 160;
const IDLE_WANDER_TARGET_EPSILON = 12;
const IDLE_WANDER_RESEED_INTERVAL = 3;
const IDLE_WANDER_SPEED_FACTOR = 0.55;
const TARGETING_SCORE_EPSILON = 1e-3;

export const PLAYER_UNIT_COUNT_BRIDGE_KEY = "playerUnits/count";
export const PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY = "playerUnits/totalHp";
export const PLAYER_UNIT_BLUEPRINT_STATS_BRIDGE_KEY = "playerUnits/blueprintStats";

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
  onAllUnitsDefeated?: () => void;
  getModuleLevel: (id: UnitModuleId) => number;
  hasSkill: (id: SkillId) => boolean;
  getDesignTargetingMode: (
    designId: UnitDesignId | null,
    type: PlayerUnitType
  ) => UnitTargetingMode;
}

interface PlayerUnitSaveData {
  readonly units: PlayerUnitSpawnData[];
}

interface PheromoneAttackBonusState {
  bonusDamage: number;
  remainingAttacks: number;
}

interface PlayerUnitState {
  id: string;
  designId: UnitDesignId | null;
  type: PlayerUnitType;
  position: SceneVector2;
  spawnPosition: SceneVector2;
  movementId: string;
  rotation: number;
  hp: number;
  maxHp: number;
  armor: number;
  hpRegenPerSecond: number;
  armorPenetration: number;
  baseAttackDamage: number;
  baseAttackInterval: number;
  baseAttackDistance: number;
  moveSpeed: number;
  moveAcceleration: number;
  mass: number;
  physicalSize: number;
  critChance: number;
  critMultiplier: number;
  rewardMultiplier: number;
  damageTransferPercent: number;
  damageTransferRadius: number;
  attackStackBonusPerHit: number;
  attackStackBonusCap: number;
  currentAttackStackBonus: number;
  attackCooldown: number;
  preCollisionVelocity: SceneVector2;
  lastNonZeroVelocity: SceneVector2;
  targetBrickId: string | null;
  targetingMode: UnitTargetingMode;
  wanderTarget: SceneVector2 | null;
  wanderCooldown: number;
  objectId: string;
  renderer: PlayerUnitRendererConfig;
  emitter?: PlayerUnitEmitterConfig;
  baseFillColor: SceneColor;
  baseStrokeColor?: SceneColor;
  appliedFillColor: SceneColor;
  appliedStrokeColor?: SceneColor;
  visualEffects: VisualEffectState;
  visualEffectsDirty: boolean;
  timeSinceLastAttack: number;
  timeSinceLastSpecial: number;
  pheromoneHealingMultiplier: number;
  pheromoneAggressionMultiplier: number;
  pheromoneAttackBonuses: PheromoneAttackBonusState[];
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
  private readonly onAllUnitsDefeated?: () => void;
  private readonly getModuleLevel: (id: UnitModuleId) => number;
  private readonly hasSkill: (id: SkillId) => boolean;
  private readonly getDesignTargetingMode: (
    designId: UnitDesignId | null,
    type: PlayerUnitType
  ) => UnitTargetingMode;

  private units = new Map<string, PlayerUnitState>();
  private unitOrder: PlayerUnitState[] = [];
  private idCounter = 0;
  private unitBlueprints = new Map<PlayerUnitType, PlayerUnitBlueprintStats>();
  private activeArcEffects: {
    id: string;
    remainingMs: number;
    sourceUnitId: string;
    targetUnitId: string;
    arcType: "heal" | "frenzy";
  }[] = [];

  constructor(options: PlayerUnitsModuleOptions) {
    this.scene = options.scene;
    this.bricks = options.bricks;
    this.bridge = options.bridge;
    this.movement = options.movement;
    this.bonuses = options.bonuses;
    this.explosions = options.explosions;
    this.arcs = options.arcs;
    this.effects = options.effects;
    this.onAllUnitsDefeated = options.onAllUnitsDefeated;
    this.getModuleLevel = options.getModuleLevel;
    this.hasSkill = options.hasSkill;
    this.getDesignTargetingMode = options.getDesignTargetingMode;
  }

  public getCurrentUnitCount(): number {
    return this.unitOrder.length;
  }

  public initialize(): void {
    // Units are spawned by the map module.
    this.pushBlueprintStats();
    this.pushStats();
  }

  public reset(): void {
    this.unitBlueprints.clear();
    this.pushBlueprintStats();
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
  }

  public tick(deltaMs: number): void {
    // legacy local arcs (will be empty once ArcModule is fully used)
    this.updateArcEffects(deltaMs);
    if (this.unitOrder.length === 0) {
      return;
    }
    
    const deltaSeconds = Math.max(deltaMs, 0) / 1000;
    const unitsSnapshot = [...this.unitOrder];
    const plannedTargets = new Map<string, string | null>();
    let statsDirty = false;

    unitsSnapshot.forEach((unit) => {
      if (!this.units.has(unit.id)) {
        return;
      }

      unit.attackCooldown = Math.max(unit.attackCooldown - deltaSeconds, 0);
      unit.timeSinceLastAttack = Math.min(
        unit.timeSinceLastAttack + deltaSeconds,
        PHEROMONE_TIMER_CAP_SECONDS
      );
      unit.timeSinceLastSpecial = Math.min(
        unit.timeSinceLastSpecial + deltaSeconds,
        PHEROMONE_TIMER_CAP_SECONDS
      );
      unit.wanderCooldown = Math.max(unit.wanderCooldown - deltaSeconds, 0);

      if (unit.hpRegenPerSecond > 0 && unit.hp < unit.maxHp) {
        const previousHp = unit.hp;
        unit.hp = clampNumber(
          unit.hp + unit.hpRegenPerSecond * deltaSeconds,
          0,
          unit.maxHp
        );
        if (unit.hp !== previousHp) {
          statsDirty = true;
        }
      }

      if (this.tryTriggerPheromoneAbilities(unit)) {
        statsDirty = true;
      }

      const movementState = this.movement.getBodyState(unit.movementId);
      if (!movementState) {
        return;
      }

      unit.position = cloneVector(movementState.position);

      if (vectorHasLength(movementState.velocity)) {
        unit.lastNonZeroVelocity = cloneVector(movementState.velocity);
      }

      const target = this.resolveTarget(unit);
      plannedTargets.set(unit.id, target?.id ?? null);

      const force = this.computeDesiredForce(unit, movementState, target);
      this.movement.setForce(unit.movementId, force);
    });

    this.movement.update(deltaSeconds);

    unitsSnapshot.forEach((unit) => {
      if (!this.units.has(unit.id)) {
        return;
      }

      const movementState = this.movement.getBodyState(unit.movementId);
      if (!movementState) {
        return;
      }

      const clampedPosition = this.clampToMap(movementState.position);
      let resolvedPosition = clampedPosition;
      let resolvedVelocity = movementState.velocity;

      unit.preCollisionVelocity = cloneVector(movementState.velocity);

      const collisionResolution = this.resolveUnitCollisions(
        unit,
        resolvedPosition,
        resolvedVelocity
      );
      resolvedPosition = collisionResolution.position;
      resolvedVelocity = collisionResolution.velocity;
      const collidedBrickIds = collisionResolution.collidedBrickIds;

      if (!vectorEquals(resolvedPosition, movementState.position)) {
        this.movement.setBodyPosition(unit.movementId, resolvedPosition);
      }

      if (!vectorEquals(resolvedVelocity, movementState.velocity)) {
        this.movement.setBodyVelocity(unit.movementId, resolvedVelocity);
      }

      unit.position = { ...resolvedPosition };

      let targetId = plannedTargets.get(unit.id) ?? null;
      let target: BrickRuntimeState | null = null;
      if (targetId) {
        target = this.bricks.getBrickState(targetId);
        if (!target) {
          targetId = null;
          plannedTargets.set(unit.id, null);
        }
      }
      if (!target) {
        target = this.resolveTarget(unit);
        plannedTargets.set(unit.id, target?.id ?? null);
      }

      if (collidedBrickIds.length > 0) {
        for (const brickId of collidedBrickIds) {
          const collidedBrick = this.bricks.getBrickState(brickId);
          if (!collidedBrick) {
            continue;
          }
          target = collidedBrick;
          unit.targetBrickId = collidedBrick.id;
          plannedTargets.set(unit.id, collidedBrick.id);
          break;
        }
      }

      const rotation = this.computeRotation(unit, target, resolvedVelocity);
      unit.rotation = rotation;
      this.pushUnitSceneState(unit);

      if (!target) {
        return;
      }

      const direction = subtractVectors(target.position, unit.position);
      const distance = Math.hypot(direction.x, direction.y);
      const attackRange = unit.baseAttackDistance + unit.physicalSize + target.physicalSize;

      if (
        distance <= attackRange + ATTACK_DISTANCE_EPSILON &&
        unit.attackCooldown <= 0
      ) {
        const hpChanged = this.performAttack(unit, target, direction, distance);
        if (hpChanged) {
          statsDirty = true;
        }
      }
    });

    if (statsDirty) {
      this.pushStats();
    }
  }

  private updateArcEffects(deltaMs: number): void {
    if (this.activeArcEffects.length === 0) return;
    const survivors: typeof this.activeArcEffects = [];
    const decrement = Math.max(0, deltaMs);
    for (let i = 0; i < this.activeArcEffects.length; i += 1) {
      const entry = this.activeArcEffects[i]!;
      const next = entry.remainingMs - decrement;
      const source = this.units.get(entry.sourceUnitId);
      const target = this.units.get(entry.targetUnitId);
      if (!source || !target || source.hp <= 0 || target.hp <= 0) {
        this.scene.removeObject(entry.id);
        continue;
      }
      // Update endpoints to follow units
      this.scene.updateObject(entry.id, {
        position: { ...source.position },
        fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } },
        customData: {
          arcType: entry.arcType,
          from: { ...source.position },
          to: { ...target.position },
        },
      });
      if (next <= 0) {
        this.scene.removeObject(entry.id);
      } else {
        survivors.push({ ...entry, remainingMs: next });
      }
    }
    this.activeArcEffects = survivors;
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
    const units = this.unitOrder;
    const totalHp = units.reduce((sum, unit) => sum + unit.hp, 0);
    this.bridge.setValue(PLAYER_UNIT_COUNT_BRIDGE_KEY, units.length);
    this.bridge.setValue(PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY, totalHp);
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
    this.idCounter = 0;

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
    const payload = PLAYER_UNIT_TYPES.map((type) => this.unitBlueprints.get(type)).filter(
      (stats): stats is PlayerUnitBlueprintStats => Boolean(stats)
    );
    this.bridge.setValue(PLAYER_UNIT_BLUEPRINT_STATS_BRIDGE_KEY, payload);
  }

  private createUnitState(unit: PlayerUnitSpawnData): PlayerUnitState {
    const type = sanitizeUnitType(unit.type);
    const config = getPlayerUnitConfig(type);
    const blueprint = this.unitBlueprints.get(type);
    if (!blueprint) {
      throw new Error(`Missing blueprint stats for unit type: ${type}`);
    }

    const position = this.clampToMap(unit.position);
    const maxHp = Math.max(blueprint.effective.maxHp, 1);
    const hp = clampNumber(unit.hp ?? maxHp, 0, maxHp);
    const attackCooldown = clampNumber(
      unit.attackCooldown ?? 0,
      0,
      blueprint.baseAttackInterval
    );
    const critChance = clampProbability(blueprint.critChance.effective);
    const critMultiplier = Math.max(blueprint.critMultiplier.effective, 1);
    const runtime = sanitizeRuntimeModifiers(unit.runtimeModifiers);

    const mass = Math.max(blueprint.mass, 0.001);
    const moveAcceleration = Math.max(blueprint.moveAcceleration, 0);
    const physicalSize = Math.max(blueprint.physicalSize, 0);
    const movementId = this.movement.createBody({
      position,
      mass,
      maxSpeed: Math.max(blueprint.moveSpeed, 0),
    });

    const emitter = config.emitter ? cloneEmitter(config.emitter) : undefined;
    const baseFillColor: SceneColor = {
      r: config.renderer.fill.r,
      g: config.renderer.fill.g,
      b: config.renderer.fill.b,
      a: typeof config.renderer.fill.a === "number" ? config.renderer.fill.a : 1,
    };
    const baseStrokeColor = config.renderer.stroke
      ? {
          r: config.renderer.stroke.color.r,
          g: config.renderer.stroke.color.g,
          b: config.renderer.stroke.color.b,
          a:
            typeof config.renderer.stroke.color.a === "number"
              ? config.renderer.stroke.color.a
              : 1,
        }
      : undefined;
    const visualEffects = createVisualEffectState();

    const ownedModuleIds = Array.isArray(unit.equippedModules)
      ? unit.equippedModules.filter((id): id is UnitModuleId => UNIT_MODULE_IDS.includes(id))
      : [];
    const ownedSkills: SkillId[] = [];
    if (this.hasSkill("void_modules")) {
      ownedSkills.push("void_modules");
    }
    if (this.hasSkill("pheromones")) {
      ownedSkills.push("pheromones");
    }

    const mendingLevel = ownedModuleIds.includes("mendingGland")
      ? Math.max(this.getModuleLevel("mendingGland"), 0)
      : 0;
    const pheromoneHealingMultiplier = mendingLevel > 0 ? 1 + 0.1 * mendingLevel : 0;
    const frenzyLevel = ownedModuleIds.includes("frenzyGland")
      ? Math.max(this.getModuleLevel("frenzyGland"), 0)
      : 0;
    const pheromoneAggressionMultiplier = frenzyLevel > 0 ? 1 + 0.1 * frenzyLevel : 0;

    const objectId = this.scene.addObject("playerUnit", {
      position,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { ...baseFillColor },
      },
      stroke: config.renderer.stroke
        ? {
            color: { ...config.renderer.stroke.color },
            width: config.renderer.stroke.width,
          }
        : undefined,
      rotation: 0,
      customData: {
        renderer: cloneRendererConfigForScene(config.renderer),
        emitter,
        physicalSize,
        baseFillColor: { ...baseFillColor },
        baseStrokeColor: baseStrokeColor ? { ...baseStrokeColor } : undefined,
        modules: ownedModuleIds,
        skills: ownedSkills,
      },
    });

    const state: PlayerUnitState = {
      id: this.createUnitId(),
      designId: unit.designId ?? null,
      type,
      position: { ...position },
      spawnPosition: { ...position },
      movementId,
      rotation: 0,
      hp,
      maxHp,
      armor: Math.max(blueprint.armor, 0),
      hpRegenPerSecond: Math.max(blueprint.hpRegenPerSecond, 0),
      armorPenetration: Math.max(blueprint.armorPenetration, 0),
      baseAttackDamage: Math.max(blueprint.effective.attackDamage, 0),
      baseAttackInterval: Math.max(blueprint.baseAttackInterval, 0.01),
      baseAttackDistance: Math.max(blueprint.baseAttackDistance, 0),
      moveSpeed: Math.max(blueprint.moveSpeed, 0),
      moveAcceleration,
      mass,
      physicalSize,
      critChance,
      critMultiplier,
      rewardMultiplier: runtime.rewardMultiplier,
      damageTransferPercent: runtime.damageTransferPercent,
      damageTransferRadius: runtime.damageTransferRadius,
      attackStackBonusPerHit: runtime.attackStackBonusPerHit,
      attackStackBonusCap: runtime.attackStackBonusCap,
      currentAttackStackBonus: 0,
      attackCooldown,
      targetBrickId: null,
      objectId,
      renderer: config.renderer,
      emitter,
      baseFillColor,
      baseStrokeColor,
      appliedFillColor: { ...baseFillColor },
      appliedStrokeColor: baseStrokeColor ? { ...baseStrokeColor } : undefined,
      visualEffects,
      visualEffectsDirty: false,
      preCollisionVelocity: { ...ZERO_VECTOR },
      lastNonZeroVelocity: { ...ZERO_VECTOR },
      timeSinceLastAttack: 0,
      timeSinceLastSpecial: this.getMendingIntervalSeconds(),
      pheromoneHealingMultiplier,
      pheromoneAggressionMultiplier,
      pheromoneAttackBonuses: [],
      targetingMode: this.getDesignTargetingMode(unit.designId ?? null, type),
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

  private formatUnitLogLabel(unit: PlayerUnitState): string {
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
    bricks.forEach((brick) => {
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
      const nearbyBricks = this.bricks.findBricksNear(resolvedPosition, unit.physicalSize);
      if (nearbyBricks.length === 0) {
        break;
      }

      nearbyBricks.forEach((brick) => {
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
    const bonusDamage = this.consumePheromoneAttackBonuses(unit);
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

    if (totalDamage > 0 && unit.damageTransferPercent > 0) {
      const splashDamage = totalDamage * unit.damageTransferPercent;
      if (splashDamage > 0) {
        const nearby = this.bricks
          .findBricksNear(target.position, unit.damageTransferRadius)
          .filter((brick) => brick.id !== target.id);
        nearby.forEach((brick) => {
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
    const counterDamage = Math.max(counterSource.baseDamage - unit.armor, 0);
    if (counterDamage > 0) {
      unit.hp = clampNumber(unit.hp - counterDamage, 0, unit.maxHp);
      hpChanged = true;
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

  private tryTriggerPheromoneAbilities(unit: PlayerUnitState): boolean {
    if (!this.canUsePheromoneAbility(unit)) {
      return false;
    }

    let abilityUsed = false;
    let healed = false;

    if (unit.pheromoneHealingMultiplier > 0) {
      const target = this.findPheromoneHealingTarget(unit);
      if (target) {
        healed = this.applyPheromoneHealing(unit, target);
        if (healed) {
          abilityUsed = true;
          unit.timeSinceLastSpecial = 0;
        }
      }
    }

    if (!abilityUsed && unit.pheromoneAggressionMultiplier > 0) {
      const target = this.findPheromoneAggressionTarget(unit);
      if (target && this.applyPheromoneAggression(unit, target)) {
        abilityUsed = true;
        unit.timeSinceLastSpecial = 0;
      }
    }

    return healed;
  }

  private canUsePheromoneAbility(unit: PlayerUnitState): boolean {
    if (unit.hp <= 0) {
      return false;
    }
    if (
      unit.pheromoneHealingMultiplier <= 0 &&
      unit.pheromoneAggressionMultiplier <= 0
    ) {
      return false;
    }
    if (unit.timeSinceLastAttack < this.getMendingIntervalSeconds()) {
      return false;
    }
    if (unit.timeSinceLastSpecial < this.getMendingIntervalSeconds()) {
      return false;
    }
    return true;
  }

  private findPheromoneHealingTarget(
    source: PlayerUnitState
  ): PlayerUnitState | null {
    let best: PlayerUnitState | null = null;
    let bestRatio = Number.POSITIVE_INFINITY;
    this.unitOrder.forEach((candidate) => {
      if (candidate.id === source.id || candidate.hp <= 0) {
        return;
      }
      if (candidate.maxHp <= 0) {
        return;
      }
      const ratio = candidate.hp / candidate.maxHp;
      if (ratio >= 1) {
        return;
      }
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = candidate;
      }
    });
    return best;
  }

  private applyPheromoneHealing(
    source: PlayerUnitState,
    target: PlayerUnitState
  ): boolean {
    const healAmount =
      Math.max(source.baseAttackDamage, 0) * Math.max(source.pheromoneHealingMultiplier, 0);
    if (healAmount <= 0) {
      return false;
    }
    const previousHp = target.hp;
    const nextHp = clampNumber(previousHp + healAmount, 0, target.maxHp);
    if (nextHp <= previousHp) {
      return false;
    }
    target.hp = nextHp;
    const healedAmount = nextHp - previousHp;
    this.explosions.spawnExplosionByType("healWave", {
      position: { ...target.position },
      initialRadius: PHEROMONE_HEAL_EXPLOSION_RADIUS,
    });
    // visual arc: source -> target
    try {
      if (this.arcs) {
        this.arcs.spawnArcBetweenUnits("heal", source.id, target.id);
      } else {
        const cfg = getArcConfig("heal");
        const arcId = this.scene.addObject("arc", {
          position: { ...source.position },
          fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } },
          customData: {
            arcType: "heal",
            from: { ...source.position },
            to: { ...target.position },
            lifetimeMs: cfg.lifetimeMs,
            fadeStartMs: cfg.fadeStartMs,
          },
        });
        this.activeArcEffects.push({
          id: arcId,
          remainingMs: cfg.lifetimeMs,
          sourceUnitId: source.id,
          targetUnitId: target.id,
          arcType: "heal",
        });
      }
    } catch {}
    const multiplier = Math.max(source.pheromoneHealingMultiplier, 0);
    const attackPower = Math.max(source.baseAttackDamage, 0);
    this.logPheromoneEvent(
      `${this.formatUnitLogLabel(source)} healed ${this.formatUnitLogLabel(target)} for ${healedAmount.toFixed(
        1
      )} HP (${previousHp.toFixed(1)} -> ${nextHp.toFixed(1)}) using ${attackPower.toFixed(
        1
      )} attack × ${multiplier.toFixed(2)} multiplier`
    );
    return true;
  }

  private findPheromoneAggressionTarget(
    source: PlayerUnitState
  ): PlayerUnitState | null {
    const candidates = this.unitOrder.filter(
      (candidate) => candidate.id !== source.id && candidate.hp > 0
    );
    if (candidates.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index] ?? null;
  }

  private applyPheromoneAggression(
    source: PlayerUnitState,
    target: PlayerUnitState
  ): boolean {
    const bonusDamage =
      Math.max(source.baseAttackDamage, 0) * Math.max(source.pheromoneAggressionMultiplier, 0);
    if (bonusDamage <= 0) {
      return false;
    }
    target.pheromoneAttackBonuses.push({
      bonusDamage,
      remainingAttacks: this.getFrenzyAttacks(),
    });
    // Spawn aura via EffectsModule
    this.effects?.applyEffect(target.id, "frenzyAura");
    this.explosions.spawnExplosionByType("magnetic", {
      position: { ...target.position },
      initialRadius: PHEROMONE_FRENZY_EXPLOSION_RADIUS,
    });
    // visual arc: source -> target
    try {
      if (this.arcs) {
        this.arcs.spawnArcBetweenUnits("frenzy", source.id, target.id);
      } else {
        const cfg = getArcConfig("frenzy");
        const arcId = this.scene.addObject("arc", {
          position: { ...source.position },
          fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } },
          customData: {
            arcType: "frenzy",
            from: { ...source.position },
            to: { ...target.position },
            lifetimeMs: cfg.lifetimeMs,
            fadeStartMs: cfg.fadeStartMs,
          },
        });
        this.activeArcEffects.push({
          id: arcId,
          remainingMs: cfg.lifetimeMs,
          sourceUnitId: source.id,
          targetUnitId: target.id,
          arcType: "frenzy",
        });
      }
    } catch {}
    const multiplier = Math.max(source.pheromoneAggressionMultiplier, 0);
    const attackPower = Math.max(source.baseAttackDamage, 0);
    this.logPheromoneEvent(
      `${this.formatUnitLogLabel(source)} empowered ${this.formatUnitLogLabel(target)} with +${bonusDamage.toFixed(
        1
      )} damage (${attackPower.toFixed(1)} attack × ${multiplier.toFixed(
        2
      )} multiplier) for ${this.getFrenzyAttacks()} attacks`
    );
    return true;
  }

  private getMendingIntervalSeconds(): number {
    // Use generic cooldownSeconds from active organs; take min across owned active organs
    const activeIds = ["mendingGland", "frenzyGland"] as const;
    let best = Number.POSITIVE_INFINITY;
    activeIds.forEach((id) => {
      try {
        const meta = getUnitModuleConfig(id as any)?.meta;
        const cd = typeof meta?.cooldownSeconds === "number" ? meta.cooldownSeconds : NaN;
        if (Number.isFinite(cd) && cd > 0 && cd < best) best = cd;
      } catch {}
    });
    return Number.isFinite(best) ? best : DEFAULT_PHEROMONE_IDLE_THRESHOLD_SECONDS;
  }

  private getFrenzyAttacks(): number {
    try {
      const v = getUnitModuleConfig("frenzyGland").meta?.frenzyAttacks;
      return typeof v === "number" && v > 0 ? v : DEFAULT_PHEROMONE_BUFF_ATTACKS;
    } catch {
      return DEFAULT_PHEROMONE_BUFF_ATTACKS;
    }
  }

  private consumePheromoneAttackBonuses(unit: PlayerUnitState): number {
    if (unit.pheromoneAttackBonuses.length === 0) {
      return 0;
    }
    let total = 0;
    const survivors: PheromoneAttackBonusState[] = [];
    unit.pheromoneAttackBonuses.forEach((entry) => {
      if (entry.remainingAttacks <= 0 || entry.bonusDamage <= 0) {
        return;
      }
      total += entry.bonusDamage;
      const next = entry.remainingAttacks - 1;
      if (next > 0) {
        survivors.push({ bonusDamage: entry.bonusDamage, remainingAttacks: next });
      }
    });
    unit.pheromoneAttackBonuses = survivors;
    if (survivors.length === 0) {
      this.effects?.removeEffect(unit.id, "frenzyAura");
    }
    return total;
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
    this.scene.removeObject(unit.objectId);
    this.movement.removeBody(unit.movementId);
    this.units.delete(unit.id);
    this.unitOrder = this.unitOrder.filter((current) => current.id !== unit.id);
    if (this.unitOrder.length === 0) {
      this.onAllUnitsDefeated?.();
    }
  }

  private clearUnits(): void {
    this.unitOrder.forEach((unit) => {
      this.scene.removeObject(unit.objectId);
      this.movement.removeBody(unit.movementId);
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

  private createUnitId(): string {
    this.idCounter += 1;
    return `player-unit-${this.idCounter}`;
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

export const clampProbability = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
};

export const roundStat = (value: number): number => Math.round(value * 100) / 100;

export const clampNumber = (value: number | undefined, min: number, max: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return min;
  }
  if (min > max) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

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
  layers: renderer.layers.map((layer) => cloneRendererLayer(layer)),
});

const cloneRendererLayer = (
  layer: PlayerUnitRendererLayerConfig
): PlayerUnitRendererLayerConfig => {
  if (layer.shape === "polygon") {
    return {
      shape: "polygon",
      vertices: layer.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })),
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
    return { type: "solid", color: { ...fill.color } };
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
