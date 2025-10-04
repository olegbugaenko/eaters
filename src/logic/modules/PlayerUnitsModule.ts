import { GameModule } from "../core/types";
import { DataBridge } from "../core/DataBridge";
import { SceneObjectManager, SceneVector2, FILL_TYPES } from "../services/SceneObjectManager";
import { BricksModule, BrickRuntimeState } from "./BricksModule";
import {
  PlayerUnitType,
  getPlayerUnitConfig,
  PlayerUnitRendererConfig,
  isPlayerUnitType,
} from "../../db/player-units-db";
import { MovementService, MovementBodyState } from "../services/MovementService";

const ATTACK_DISTANCE_EPSILON = 0.001;
const ZERO_VECTOR: SceneVector2 = { x: 0, y: 0 };

export const PLAYER_UNIT_COUNT_BRIDGE_KEY = "playerUnits/count";
export const PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY = "playerUnits/totalHp";

export interface PlayerUnitSpawnData {
  readonly type: PlayerUnitType;
  readonly position: SceneVector2;
  readonly hp?: number;
  readonly attackCooldown?: number;
}

interface PlayerUnitsModuleOptions {
  scene: SceneObjectManager;
  bricks: BricksModule;
  bridge: DataBridge;
  movement: MovementService;
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
  baseAttackDamage: number;
  baseAttackInterval: number;
  baseAttackDistance: number;
  moveSpeed: number;
  moveAcceleration: number;
  mass: number;
  attackCooldown: number;
  targetBrickId: string | null;
  objectId: string;
  renderer: PlayerUnitRendererConfig;
}

export class PlayerUnitsModule implements GameModule {
  public readonly id = "playerUnits";

  private readonly scene: SceneObjectManager;
  private readonly bricks: BricksModule;
  private readonly bridge: DataBridge;
  private readonly movement: MovementService;

  private units = new Map<string, PlayerUnitState>();
  private unitOrder: PlayerUnitState[] = [];
  private idCounter = 0;

  constructor(options: PlayerUnitsModuleOptions) {
    this.scene = options.scene;
    this.bricks = options.bricks;
    this.bridge = options.bridge;
    this.movement = options.movement;
  }

  public initialize(): void {
    // Units are spawned by the map module.
    this.pushStats();
  }

  public reset(): void {
    this.applyUnits([]);
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed) {
      this.applyUnits(parsed.units);
    }
  }

  public save(): unknown {
    return {
      units: this.unitOrder.map((unit) => ({
        type: unit.type,
        position: { ...unit.position },
        hp: unit.hp,
        attackCooldown: unit.attackCooldown,
      })),
    } satisfies PlayerUnitSaveData;
  }

  public tick(deltaMs: number): void {
    if (this.unitOrder.length === 0) {
      return;
    }

    const deltaSeconds = Math.max(deltaMs, 0) / 1000;
    const unitsSnapshot = [...this.unitOrder];
    const plannedTargets = new Map<string, string | null>();

    unitsSnapshot.forEach((unit) => {
      if (!this.units.has(unit.id)) {
        return;
      }

      unit.attackCooldown = Math.max(unit.attackCooldown - deltaSeconds, 0);

      const movementState = this.movement.getBodyState(unit.movementId);
      if (!movementState) {
        return;
      }

      unit.position = cloneVector(movementState.position);

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
      if (!vectorEquals(clampedPosition, movementState.position)) {
        this.movement.setBodyPosition(unit.movementId, clampedPosition);
      }

      unit.position = { ...clampedPosition };

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

      const rotation = this.computeRotation(unit, target, movementState.velocity);
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

      if (
        distance <= unit.baseAttackDistance + ATTACK_DISTANCE_EPSILON &&
        unit.attackCooldown <= 0
      ) {
        this.performAttack(unit, target, direction, distance);
      }
    });
  }

  public setUnits(units: PlayerUnitSpawnData[]): void {
    this.applyUnits(units);
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
    this.clearUnits();
    this.idCounter = 0;

    units.forEach((unit) => {
      const state = this.createUnitState(unit);
      this.units.set(state.id, state);
      this.unitOrder.push(state);
    });

    this.pushStats();
  }

  private createUnitState(unit: PlayerUnitSpawnData): PlayerUnitState {
    const type = sanitizeUnitType(unit.type);
    const config = getPlayerUnitConfig(type);

    const position = this.clampToMap(unit.position);
    const maxHp = Math.max(config.maxHp, 1);
    const hp = clampNumber(unit.hp ?? maxHp, 0, maxHp);
    const attackCooldown = clampNumber(unit.attackCooldown ?? 0, 0, config.baseAttackInterval);

    const mass = Math.max(config.mass, 0.001);
    const moveAcceleration = Math.max(config.moveAcceleration, 0);
    const movementId = this.movement.createBody({
      position,
      mass,
      maxSpeed: Math.max(config.moveSpeed, 0),
    });

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
      armor: Math.max(config.armor, 0),
      baseAttackDamage: Math.max(config.baseAttackDamage, 0),
      baseAttackInterval: Math.max(config.baseAttackInterval, 0.01),
      baseAttackDistance: Math.max(config.baseAttackDistance, 0),
      moveSpeed: Math.max(config.moveSpeed, 0),
      moveAcceleration,
      mass,
      attackCooldown,
      targetBrickId: null,
      objectId,
      renderer: config.renderer,
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
    const distanceOutsideRange = Math.max(distance - unit.baseAttackDistance, 0);

    if (distanceOutsideRange <= 0) {
      return this.computeBrakingForce(unit, movementState);
    }

    const direction = distance > 0 ? scaleVector(toTarget, 1 / distance) : ZERO_VECTOR;
    const slowRadius = Math.max(unit.moveSpeed, unit.baseAttackDistance * 2);
    const speedFactor = clampNumber(distanceOutsideRange / slowRadius, 0, 1);
    const desiredSpeed = unit.moveSpeed * speedFactor;
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

  private computeSteeringForce(
    unit: PlayerUnitState,
    currentVelocity: SceneVector2,
    desiredVelocity: SceneVector2
  ): SceneVector2 {
    const steering = subtractVectors(desiredVelocity, currentVelocity);
    const magnitude = vectorLength(steering);
    const maxForce = Math.max(unit.moveAcceleration, 0);
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

  private performAttack(
    unit: PlayerUnitState,
    target: BrickRuntimeState,
    direction: SceneVector2,
    distance: number
  ): void {
    unit.attackCooldown = unit.baseAttackInterval;
    const result = this.bricks.applyDamage(target.id, unit.baseAttackDamage);

    if (result.destroyed) {
      unit.targetBrickId = null;
      return;
    }

    const surviving = result.brick ?? target;
    const counterDamage = Math.max(surviving.baseDamage - unit.armor, 0);
    if (counterDamage > 0) {
      unit.hp = clampNumber(unit.hp - counterDamage, 0, unit.maxHp);
      this.pushStats();
    }

    this.applyKnockBack(unit, direction, distance, surviving);

    if (unit.hp <= 0) {
      this.removeUnit(unit);
      return;
    }

    this.scene.updateObject(unit.objectId, {
      position: { ...unit.position },
      rotation: unit.rotation,
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
    this.pushStats();
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

const clampNumber = (value: number | undefined, min: number, max: number): number => {
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

const sanitizeUnitType = (value: PlayerUnitType | undefined): PlayerUnitType => {
  if (isPlayerUnitType(value)) {
    return value;
  }
  return "bluePentagon";
};

const cloneVector = (vector: SceneVector2): SceneVector2 => ({ x: vector.x, y: vector.y });

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
