import { DataBridge } from "../core/DataBridge";
import { GameModule } from "../core/types";
import { BrickConfig, BrickType, getBrickConfig, isBrickType } from "../../db/bricks-db";
import type { ExplosionType } from "../../db/explosions-db";
import type { DestructubleExplosionConfig } from "../interfaces/destructuble";
import {
  FILL_TYPES,
  SceneObjectManager,
  SceneVector2,
} from "../services/SceneObjectManager";
import type { ExplosionModule } from "./ExplosionModule";
import { SpatialGrid } from "../utils/SpatialGrid";

const DEFAULT_BRICK_TYPE: BrickType = "classic";

const createBrickFill = (config: BrickConfig) => {
  const fill = config.fill;
  switch (fill.type) {
    case "solid":
      return {
        fillType: FILL_TYPES.SOLID,
        color: { ...fill.color },
      };
    case "radial":
      return {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: fill.center ? { ...fill.center } : undefined,
        end: fill.radius,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
      };
    case "linear":
    default:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
      };
  }
};

export const BRICK_COUNT_BRIDGE_KEY = "bricks/count";
export const BRICK_TOTAL_HP_BRIDGE_KEY = "bricks/totalHp";

export interface BrickData {
  position: SceneVector2;
  rotation: number;
  type: BrickType;
  hp?: number;
}

export interface BrickRuntimeState {
  id: string;
  type: BrickType;
  position: SceneVector2;
  rotation: number;
  hp: number;
  maxHp: number;
  armor: number;
  baseDamage: number;
  brickKnockBackDistance: number;
  brickKnockBackSpeed: number;
  physicalSize: number;
}

interface BricksModuleOptions {
  scene: SceneObjectManager;
  bridge: DataBridge;
  explosions: ExplosionModule;
}

interface BrickSaveData {
  bricks: BrickData[];
}

interface InternalBrickState extends BrickRuntimeState {
  sceneObjectId: string;
  damageExplosion?: BrickExplosionState;
  destructionExplosion?: BrickExplosionState;
}

interface BrickExplosionState {
  type: ExplosionType;
  initialRadius: number;
}

export class BricksModule implements GameModule {
  public readonly id = "bricks";

  private bricks = new Map<string, InternalBrickState>();
  private brickOrder: InternalBrickState[] = [];
  private brickIdCounter = 0;
  private readonly spatialIndex = new SpatialGrid<InternalBrickState>(10);

  constructor(private readonly options: BricksModuleOptions) {}

  public initialize(): void {
    this.pushStats();
  }

  public reset(): void {
    this.applyBricks([]);
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed) {
      this.applyBricks(parsed);
      return;
    }
    this.pushStats();
  }

  public save(): unknown {
    return {
      bricks: this.brickOrder.map((brick) => ({
        position: { ...brick.position },
        rotation: brick.rotation,
        type: brick.type,
        hp: brick.hp,
      })),
    } satisfies BrickSaveData;
  }

  public tick(_deltaMs: number): void {
    // Bricks are static for now.
  }

  public setBricks(bricks: BrickData[]): void {
    this.applyBricks(bricks);
  }

  public getBrickStates(): BrickRuntimeState[] {
    return this.brickOrder.map((brick) => this.cloneState(brick));
  }

  public getBrickState(brickId: string): BrickRuntimeState | null {
    const state = this.bricks.get(brickId);
    if (!state) {
      return null;
    }
    return this.cloneState(state);
  }

  public findNearestBrick(position: SceneVector2): BrickRuntimeState | null {
    let best: InternalBrickState | null = null;
    let bestDistSq = Infinity;
    this.brickOrder.forEach((brick) => {
      const dx = brick.position.x - position.x;
      const dy = brick.position.y - position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = brick;
      }
    });
    return best ? this.cloneState(best) : null;
  }

  public findBricksNear(position: SceneVector2, radius: number): BrickRuntimeState[] {
    if (radius < 0) {
      return [];
    }

    const bricks = this.spatialIndex.queryCircle(position, radius);
    if (bricks.length === 0) {
      return [];
    }

    return bricks.map((brick) => this.cloneState(brick));
  }

  public applyDamage(
    brickId: string,
    rawDamage: number
  ): { destroyed: boolean; brick: BrickRuntimeState | null } {
    const brick = this.bricks.get(brickId);
    if (!brick) {
      return { destroyed: false, brick: null };
    }

    const effectiveDamage = Math.max(rawDamage - brick.armor, 0);
    if (effectiveDamage <= 0) {
      return { destroyed: false, brick: this.cloneState(brick) };
    }

    brick.hp = clamp(brick.hp - effectiveDamage, 0, brick.maxHp);

    if (brick.hp <= 0) {
      this.spawnBrickExplosion(brick.destructionExplosion, brick);
      this.destroyBrick(brick);
      return { destroyed: true, brick: null };
    }

    this.spawnBrickExplosion(brick.damageExplosion, brick);
    this.pushStats();
    return { destroyed: false, brick: this.cloneState(brick) };
  }

  private parseSaveData(data: unknown): BrickData[] | null {
    if (
      typeof data !== "object" ||
      data === null ||
      !("bricks" in data) ||
      !Array.isArray((data as { bricks: unknown }).bricks)
    ) {
      return null;
    }

    const bricksInput = (data as BrickSaveData).bricks;
    const sanitized: BrickData[] = [];

    bricksInput.forEach((brick) => {
      if (
        brick &&
        typeof brick === "object" &&
        "position" in brick &&
        typeof brick.position === "object" &&
        brick.position !== null &&
        typeof brick.position.x === "number" &&
        typeof brick.position.y === "number"
      ) {
        const type = sanitizeBrickType((brick as BrickData).type);
        const config = getBrickConfig(type);
        const maxHp = Math.max(config.destructubleData?.maxHp ?? 1, 1);
        const hp = sanitizeHp((brick as BrickData).hp, maxHp);
        sanitized.push({
          position: this.clampToMap(brick.position),
          rotation: sanitizeRotation((brick as BrickData).rotation),
          type,
          hp,
        });
      }
    });

    return sanitized;
  }

  private applyBricks(bricks: BrickData[]): void {
    this.clearSceneObjects();
    this.brickIdCounter = 0;

    bricks.forEach((brick) => {
      const state = this.createBrickState(brick);
      this.bricks.set(state.id, state);
      this.brickOrder.push(state);
      this.spatialIndex.set(state.id, state.position, state.physicalSize, state);
    });

    this.pushStats();
  }

  private createBrickState(brick: BrickData): InternalBrickState {
    const type = sanitizeBrickType(brick.type);
    const config = getBrickConfig(type);
    const destructuble = config.destructubleData;
    const maxHp = Math.max(destructuble?.maxHp ?? 1, 1);
    const baseDamage = Math.max(destructuble?.baseDamage ?? 0, 0);
    const brickKnockBackDistance = Math.max(destructuble?.brickKnockBackDistance ?? 0, 0);
    const brickKnockBackSpeed = sanitizeKnockBackSpeed(
      destructuble?.brickKnockBackSpeed,
      brickKnockBackDistance
    );
    const armor = Math.max(destructuble?.armor ?? 0, 0);
    const physicalSize = Math.max(
      destructuble?.physicalSize ?? Math.max(config.size.width, config.size.height) / 2,
      0
    );
    const hp = sanitizeHp(brick.hp ?? destructuble?.hp ?? maxHp, maxHp);
    const position = this.clampToMap(brick.position);
    const rotation = sanitizeRotation(brick.rotation);

    const id = this.createBrickId();
    const sceneObjectId = this.options.scene.addObject("brick", {
      position,
      size: { ...config.size },
      fill: createBrickFill(config),
      rotation,
      stroke: config.stroke
        ? {
            color: { ...config.stroke.color },
            width: config.stroke.width,
          }
        : undefined,
    });

    return {
      id,
      type,
      position,
      rotation,
      hp,
      maxHp,
      armor,
      baseDamage,
      brickKnockBackDistance,
      brickKnockBackSpeed,
      physicalSize,
      sceneObjectId,
      damageExplosion: resolveBrickExplosion(
        destructuble?.damageExplosion,
        config,
        physicalSize
      ),
      destructionExplosion: resolveBrickExplosion(
        destructuble?.destructionExplosion,
        config,
        physicalSize
      ),
    };
  }

  private destroyBrick(brick: InternalBrickState): void {
    this.options.scene.removeObject(brick.sceneObjectId);
    this.bricks.delete(brick.id);
    this.brickOrder = this.brickOrder.filter((item) => item.id !== brick.id);
    this.spatialIndex.delete(brick.id);
    this.pushStats();
  }

  private clearSceneObjects(): void {
    this.brickOrder.forEach((brick) => {
      this.options.scene.removeObject(brick.sceneObjectId);
    });
    this.bricks.clear();
    this.brickOrder = [];
    this.spatialIndex.clear();
  }

  private pushStats(): void {
    let totalHp = 0;
    this.brickOrder.forEach((brick) => {
      totalHp += brick.hp;
    });
    this.options.bridge.setValue(BRICK_COUNT_BRIDGE_KEY, this.bricks.size);
    this.options.bridge.setValue(BRICK_TOTAL_HP_BRIDGE_KEY, totalHp);
  }

  private clampToMap(position: SceneVector2): SceneVector2 {
    const { width, height } = this.options.scene.getMapSize();
    return {
      x: clamp(position.x, 0, width),
      y: clamp(position.y, 0, height),
    };
  }

  private createBrickId(): string {
    this.brickIdCounter += 1;
    return `brick-${this.brickIdCounter}`;
  }

  private cloneState(state: InternalBrickState): BrickRuntimeState {
    return {
      id: state.id,
      type: state.type,
      position: { ...state.position },
      rotation: state.rotation,
      hp: state.hp,
      maxHp: state.maxHp,
      armor: state.armor,
      baseDamage: state.baseDamage,
      brickKnockBackDistance: state.brickKnockBackDistance,
      brickKnockBackSpeed: state.brickKnockBackSpeed,
      physicalSize: state.physicalSize,
    };
  }

  private spawnBrickExplosion(
    config: BrickExplosionState | undefined,
    brick: InternalBrickState
  ): void {
    if (!config) {
      return;
    }

    this.options.explosions.spawnExplosionByType(config.type, {
      position: { ...brick.position },
      initialRadius: Math.max(1, config.initialRadius),
    });
  }
}

const sanitizeKnockBackSpeed = (
  value: number | undefined,
  distance: number
): number => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (distance > 0) {
    return distance * 2;
  }
  return 0;
};

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return min;
  }
  if (min > max) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const sanitizeHp = (value: number | undefined, maxHp: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp(value, 0, maxHp);
  }
  return clamp(maxHp, 0, maxHp);
};

const sanitizeRotation = (value: number | undefined): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return Math.random() * Math.PI * 2;
};

const sanitizeBrickType = (value: BrickType | undefined): BrickType => {
  if (isBrickType(value)) {
    return value;
  }
  return DEFAULT_BRICK_TYPE;
};

const resolveBrickExplosion = (
  config: DestructubleExplosionConfig | undefined,
  brickConfig: BrickConfig,
  physicalSize: number
): BrickExplosionState | undefined => {
  const baseRadius = Math.max(
    Math.max(brickConfig.size.width, brickConfig.size.height) / 2,
    physicalSize
  );

  const type = config?.type;
  if (!type) {
    return undefined;
  }

  if (
    config &&
    typeof config.initialRadius === "number" &&
    Number.isFinite(config.initialRadius)
  ) {
    const radius = Math.max(1, config.initialRadius);
    return { type, initialRadius: radius };
  }

  const multiplier =
    config && typeof config.radiusMultiplier === "number" && Number.isFinite(config.radiusMultiplier)
      ? config.radiusMultiplier
      : 1;
  const offset =
    config && typeof config.radiusOffset === "number" && Number.isFinite(config.radiusOffset)
      ? config.radiusOffset
      : 0;

  const initialRadius = Math.max(1, baseRadius * multiplier + offset);
  return { type, initialRadius };
};
