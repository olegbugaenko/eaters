import { GameModule } from "../core/types";
import { DataBridge } from "../core/DataBridge";
import {
  SceneObjectManager,
  SceneVector2,
  FILL_TYPES,
  SceneFill,
} from "../services/SceneObjectManager";
import { BricksModule, BrickRuntimeState } from "./BricksModule";
import {
  PlayerUnitType,
  PLAYER_UNIT_TYPES,
  getPlayerUnitConfig,
  PlayerUnitRendererConfig,
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
import { getBonusConfig } from "../../db/bonuses-db";

const ATTACK_DISTANCE_EPSILON = 0.001;
const COLLISION_RESOLUTION_ITERATIONS = 4;
const ZERO_VECTOR: SceneVector2 = { x: 0, y: 0 };
const CRITICAL_HIT_EXPLOSION_RADIUS = 12;
const DEFAULT_CRIT_MULTIPLIER_BONUS = getBonusConfig(
  "all_units_crit_mult"
).defaultValue;

export const PLAYER_UNIT_COUNT_BRIDGE_KEY = "playerUnits/count";
export const PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY = "playerUnits/totalHp";
export const PLAYER_UNIT_BLUEPRINT_STATS_BRIDGE_KEY = "playerUnits/blueprintStats";

export interface PlayerUnitSpawnData {
  readonly type: PlayerUnitType;
  readonly position: SceneVector2;
  readonly hp?: number;
  readonly attackCooldown?: number;
  readonly runtimeModifiers?: PlayerUnitRuntimeModifiers;
}

interface PlayerUnitsModuleOptions {
  scene: SceneObjectManager;
  bricks: BricksModule;
  bridge: DataBridge;
  movement: MovementService;
  bonuses: BonusesModule;
  explosions: ExplosionModule;
  onAllUnitsDefeated?: () => void;
}

interface PlayerUnitSaveData {
  readonly units: PlayerUnitSpawnData[];
}

interface PlayerUnitState {
  id: string;
  type: PlayerUnitType;
  position: SceneVector2;
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
  objectId: string;
  renderer: PlayerUnitRendererConfig;
  emitter?: PlayerUnitEmitterConfig;
}

export class PlayerUnitsModule implements GameModule {
  public readonly id = "playerUnits";

  private readonly scene: SceneObjectManager;
  private readonly bricks: BricksModule;
  private readonly bridge: DataBridge;
  private readonly movement: MovementService;
  private readonly bonuses: BonusesModule;
  private readonly explosions: ExplosionModule;
  private readonly onAllUnitsDefeated?: () => void;

  private units = new Map<string, PlayerUnitState>();
  private unitOrder: PlayerUnitState[] = [];
  private idCounter = 0;
  private unitBlueprints = new Map<PlayerUnitType, PlayerUnitBlueprintStats>();

  constructor(options: PlayerUnitsModuleOptions) {
    this.scene = options.scene;
    this.bricks = options.bricks;
    this.bridge = options.bridge;
    this.movement = options.movement;
    this.bonuses = options.bonuses;
    this.explosions = options.explosions;
    this.onAllUnitsDefeated = options.onAllUnitsDefeated;
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
      this.scene.updateObject(unit.objectId, {
        position: { ...unit.position },
        rotation,
      });

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

    const objectId = this.scene.addObject("playerUnit", {
      position,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { ...config.renderer.fill },
      },
      stroke: config.renderer.stroke
        ? {
            color: { ...config.renderer.stroke.color },
            width: config.renderer.stroke.width,
          }
        : undefined,
      rotation: 0,
      customData: {
        renderer: {
          kind: config.renderer.kind,
          vertices: config.renderer.vertices.map((vertex) => ({ ...vertex })),
          offset: config.renderer.offset ? { ...config.renderer.offset } : undefined,
        },
        emitter,
        physicalSize,
      },
    });

    const id = this.createUnitId();

    return {
      id,
      type,
      position: { ...position },
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
      preCollisionVelocity: { ...ZERO_VECTOR },
      lastNonZeroVelocity: { ...ZERO_VECTOR },
    };
  }

  private resolveTarget(unit: PlayerUnitState): BrickRuntimeState | null {
    if (unit.targetBrickId) {
      const current = this.bricks.getBrickState(unit.targetBrickId);
      if (current) {
        return current;
      }
      unit.targetBrickId = null;
    }

    const nearest = this.bricks.findNearestBrick(unit.position);
    unit.targetBrickId = nearest?.id ?? null;
    return nearest ?? null;
  }

  private computeDesiredForce(
    unit: PlayerUnitState,
    movementState: MovementBodyState,
    target: BrickRuntimeState | null
  ): SceneVector2 {
    if (!target) {
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
    const critChance = clampProbability(unit.critChance);
    const critMultiplier = Math.max(unit.critMultiplier, 1);
    const isCritical = critChance > 0 && Math.random() < critChance;
    const damage = isCritical ? baseDamage * critMultiplier : baseDamage;
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
    const { damage, isCritical } = this.getAttackOutcome(unit);
    const result = this.bricks.applyDamage(target.id, damage, direction, {
      rewardMultiplier: unit.rewardMultiplier,
      armorPenetration: unit.armorPenetration,
    });
    const surviving = result.brick ?? target;

    if (isCritical && damage > 0) {
      const effectPosition = result.brick?.position ?? target.position;
      this.spawnCriticalHitEffect(effectPosition);
    }

    if (damage > 0 && unit.damageTransferPercent > 0) {
      const splashDamage = damage * unit.damageTransferPercent;
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

    if (unit.hp <= 0) {
      this.removeUnit(unit);
      return true;
    }

    if (unit.attackStackBonusPerHit > 0 && unit.attackStackBonusCap > 0) {
      const nextStack = unit.currentAttackStackBonus + unit.attackStackBonusPerHit;
      unit.currentAttackStackBonus = Math.min(nextStack, unit.attackStackBonusCap);
    }

    if (result.destroyed) {
      unit.targetBrickId = null;
    }

    this.scene.updateObject(unit.objectId, {
      position: { ...unit.position },
      rotation: unit.rotation,
    });
    return hpChanged;
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
