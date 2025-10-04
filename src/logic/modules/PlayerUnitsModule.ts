import { GameModule } from "../core/types";
import { SceneObjectManager, SceneVector2, FILL_TYPES } from "../services/SceneObjectManager";
import { BricksModule, BrickRuntimeState } from "./BricksModule";
import {
  PlayerUnitType,
  getPlayerUnitConfig,
  PlayerUnitRendererConfig,
  isPlayerUnitType,
} from "../../db/player-units-db";

export interface PlayerUnitSpawnData {
  readonly type: PlayerUnitType;
  readonly position: SceneVector2;
  readonly hp?: number;
  readonly attackCooldown?: number;
}

interface PlayerUnitsModuleOptions {
  scene: SceneObjectManager;
  bricks: BricksModule;
}

interface PlayerUnitSaveData {
  readonly units: PlayerUnitSpawnData[];
}

interface PlayerUnitState {
  id: string;
  type: PlayerUnitType;
  position: SceneVector2;
  hp: number;
  maxHp: number;
  armor: number;
  baseAttackDamage: number;
  baseAttackInterval: number;
  baseAttackDistance: number;
  moveSpeed: number;
  attackCooldown: number;
  targetBrickId: string | null;
  objectId: string;
  renderer: PlayerUnitRendererConfig;
}

export class PlayerUnitsModule implements GameModule {
  public readonly id = "playerUnits";

  private readonly scene: SceneObjectManager;
  private readonly bricks: BricksModule;

  private units = new Map<string, PlayerUnitState>();
  private unitOrder: PlayerUnitState[] = [];
  private idCounter = 0;

  constructor(options: PlayerUnitsModuleOptions) {
    this.scene = options.scene;
    this.bricks = options.bricks;
  }

  public initialize(): void {
    // Units are spawned by the map module.
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
    unitsSnapshot.forEach((unit) => {
      if (!this.units.has(unit.id)) {
        return;
      }
      this.updateUnit(unit, deltaSeconds);
    });
  }

  public setUnits(units: PlayerUnitSpawnData[]): void {
    this.applyUnits(units);
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
  }

  private createUnitState(unit: PlayerUnitSpawnData): PlayerUnitState {
    const type = sanitizeUnitType(unit.type);
    const config = getPlayerUnitConfig(type);

    const position = this.clampToMap(unit.position);
    const maxHp = Math.max(config.maxHp, 1);
    const hp = clampNumber(unit.hp ?? maxHp, 0, maxHp);
    const attackCooldown = clampNumber(unit.attackCooldown ?? 0, 0, config.baseAttackInterval);

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
      hp,
      maxHp,
      armor: Math.max(config.armor, 0),
      baseAttackDamage: Math.max(config.baseAttackDamage, 0),
      baseAttackInterval: Math.max(config.baseAttackInterval, 0.01),
      baseAttackDistance: Math.max(config.baseAttackDistance, 0),
      moveSpeed: Math.max(config.moveSpeed, 0),
      attackCooldown,
      targetBrickId: null,
      objectId,
      renderer: config.renderer,
    };
  }

  private updateUnit(unit: PlayerUnitState, deltaSeconds: number): void {
    unit.attackCooldown = Math.max(unit.attackCooldown - deltaSeconds, 0);

    const target = this.resolveTarget(unit);
    if (!target) {
      this.scene.updateObject(unit.objectId, {
        position: { ...unit.position },
      });
      return;
    }

    const direction = {
      x: target.position.x - unit.position.x,
      y: target.position.y - unit.position.y,
    };
    const distance = Math.hypot(direction.x, direction.y);

    if (distance > unit.baseAttackDistance) {
      this.moveTowards(unit, direction, distance, deltaSeconds);
      this.scene.updateObject(unit.objectId, {
        position: { ...unit.position },
        rotation: Math.atan2(direction.y, direction.x),
      });
      return;
    }

    if (unit.attackCooldown > 0) {
      this.scene.updateObject(unit.objectId, {
        position: { ...unit.position },
        rotation: Math.atan2(direction.y, direction.x),
      });
      return;
    }

    this.performAttack(unit, target, direction, distance);
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

  private moveTowards(
    unit: PlayerUnitState,
    direction: SceneVector2,
    distance: number,
    deltaSeconds: number
  ): void {
    const availableDistance = unit.moveSpeed * deltaSeconds;
    if (availableDistance <= 0 || distance <= 0) {
      return;
    }

    const distanceToCover = Math.max(distance - unit.baseAttackDistance, 0);
    const step = Math.min(distanceToCover, availableDistance);
    if (step <= 0) {
      return;
    }

    const factor = step / distance;
    unit.position = this.clampToMap({
      x: unit.position.x + direction.x * factor,
      y: unit.position.y + direction.y * factor,
    });
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
      this.scene.updateObject(unit.objectId, {
        position: { ...unit.position },
        rotation: Math.atan2(direction.y, direction.x),
      });
      return;
    }

    const surviving = result.brick ?? target;
    const counterDamage = Math.max(surviving.baseDamage - unit.armor, 0);
    if (counterDamage > 0) {
      unit.hp = clampNumber(unit.hp - counterDamage, 0, unit.maxHp);
    }

    if (surviving.brickKnockBack > 0) {
      this.applyKnockBack(unit, direction, distance, surviving.brickKnockBack);
    }

    if (unit.hp <= 0) {
      this.removeUnit(unit);
      return;
    }

    this.scene.updateObject(unit.objectId, {
      position: { ...unit.position },
      rotation: Math.atan2(direction.y, direction.x),
    });
  }

  private applyKnockBack(
    unit: PlayerUnitState,
    direction: SceneVector2,
    distance: number,
    knockBack: number
  ): void {
    if (knockBack <= 0) {
      return;
    }

    let scale = 1;
    if (distance > 0) {
      scale = knockBack / distance;
    }

    if (!Number.isFinite(scale) || scale <= 0) {
      scale = 1;
    }

    const offset = {
      x: -direction.x * scale,
      y: -direction.y * scale,
    };

    if (offset.x === 0 && offset.y === 0) {
      offset.y = -knockBack;
    }

    unit.position = this.clampToMap({
      x: unit.position.x + offset.x,
      y: unit.position.y + offset.y,
    });
  }

  private removeUnit(unit: PlayerUnitState): void {
    this.scene.removeObject(unit.objectId);
    this.units.delete(unit.id);
    this.unitOrder = this.unitOrder.filter((current) => current.id !== unit.id);
  }

  private clearUnits(): void {
    this.unitOrder.forEach((unit) => {
      this.scene.removeObject(unit.objectId);
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
