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
import { BonusesModule } from "./BonusesModule";
import { SpatialGrid } from "../utils/SpatialGrid";
import {
  ResourceStockpile,
  RESOURCE_IDS,
  normalizeResourceAmount,
  hasAnyResources,
  cloneResourceStockpile,
  createEmptyResourceStockpile,
} from "../../db/resources-db";

interface ResourceCollector {
  grantResources(amount: ResourceStockpile): void;
  notifyBrickDestroyed(): void;
}

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
  level: number;
  hp?: number;
}

export interface BrickRuntimeState {
  id: string;
  type: BrickType;
  position: SceneVector2;
  rotation: number;
  level: number;
  hp: number;
  maxHp: number;
  armor: number;
  baseDamage: number;
  brickKnockBackDistance: number;
  brickKnockBackSpeed: number;
  brickKnockBackAmplitude: number;
  physicalSize: number;
  rewards: ResourceStockpile;
}

interface BricksModuleOptions {
  scene: SceneObjectManager;
  bridge: DataBridge;
  explosions: ExplosionModule;
  resources: ResourceCollector;
  bonuses: BonusesModule;
  onAllBricksDestroyed?: () => void;
}

interface BrickSaveData {
  bricks: BrickData[];
}

interface InternalBrickState extends BrickRuntimeState {
  sceneObjectId: string;
  damageExplosion?: BrickExplosionState;
  destructionExplosion?: BrickExplosionState;
  knockback: BrickKnockbackState | null;
}

interface BrickExplosionState {
  type: ExplosionType;
  initialRadius: number;
}

interface BrickKnockbackState {
  initialOffset: SceneVector2;
  currentOffset: SceneVector2;
  elapsed: number;
}

const BRICK_KNOCKBACK_DURATION_MS = 500;
const KNOCKBACK_EPSILON = 0.001;
const ZERO_VECTOR: SceneVector2 = { x: 0, y: 0 };

export class BricksModule implements GameModule {
  public readonly id = "bricks";

  private bricks = new Map<string, InternalBrickState>();
  private brickOrder: InternalBrickState[] = [];
  private brickIdCounter = 0;
  private readonly spatialIndex = new SpatialGrid<InternalBrickState>(10);
  private readonly bricksWithKnockback = new Set<string>();

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
    return null;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0 || this.bricksWithKnockback.size === 0) {
      return;
    }

    const finished: string[] = [];

    this.bricksWithKnockback.forEach((brickId) => {
      const brick = this.bricks.get(brickId);
      if (!brick || !brick.knockback) {
        finished.push(brickId);
        return;
      }

      const state = brick.knockback;
      state.elapsed = Math.min(state.elapsed + deltaMs, BRICK_KNOCKBACK_DURATION_MS);
      const progress = clamp(state.elapsed / BRICK_KNOCKBACK_DURATION_MS, 0, 1);
      const remaining = 1 - progress;
      const eased = remaining * remaining;

      if (eased <= KNOCKBACK_EPSILON) {
        brick.knockback = null;
        finished.push(brickId);
        this.updateBrickSceneObject(brick, ZERO_VECTOR);
        return;
      }

      const offset = scaleVector(state.initialOffset, eased);
      state.currentOffset = offset;
      this.updateBrickSceneObject(brick, offset);
    });

    if (finished.length > 0) {
      finished.forEach((brickId) => this.bricksWithKnockback.delete(brickId));
    }
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
    rawDamage: number,
    hitDirection?: SceneVector2,
    options?: { rewardMultiplier?: number; armorPenetration?: number }
  ): { destroyed: boolean; brick: BrickRuntimeState | null } {
    const brick = this.bricks.get(brickId);
    if (!brick) {
      return { destroyed: false, brick: null };
    }

    const rewardMultiplier = Math.max(options?.rewardMultiplier ?? 1, 0);
    const armorPenetration = Math.max(options?.armorPenetration ?? 0, 0);
    const effectiveArmor = Math.max(brick.armor - armorPenetration, 0);
    const effectiveDamage = Math.max(rawDamage - effectiveArmor, 0);
    if (effectiveDamage <= 0) {
      return { destroyed: false, brick: this.cloneState(brick) };
    }

    brick.hp = clamp(brick.hp - effectiveDamage, 0, brick.maxHp);

    if (brick.hp <= 0) {
      this.spawnBrickExplosion(brick.destructionExplosion, brick);
      this.destroyBrick(brick, rewardMultiplier);
      return { destroyed: true, brick: null };
    }

    this.spawnBrickExplosion(brick.damageExplosion, brick);
    this.applyBrickKnockback(brick, hitDirection);
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
        const level = sanitizeBrickLevel((brick as BrickData).level);
        const stats = calculateBrickStatsForLevel(config, level);
        const hp = sanitizeHp((brick as BrickData).hp, stats.maxHp);
        sanitized.push({
          position: this.clampToMap(brick.position),
          rotation: sanitizeRotation((brick as BrickData).rotation),
          type,
          hp,
          level,
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
    const level = sanitizeBrickLevel(brick.level);
    const stats = calculateBrickStatsForLevel(config, level);
    const maxHp = stats.maxHp;
    const baseDamage = stats.baseDamage;
    const brickKnockBackDistance = Math.max(destructuble?.brickKnockBackDistance ?? 0, 0);
    const brickKnockBackSpeed = sanitizeKnockBackSpeed(
      destructuble?.brickKnockBackSpeed,
      brickKnockBackDistance
    );
    const armor = stats.armor;
    const physicalSize = Math.max(
      destructuble?.physicalSize ?? Math.max(config.size.width, config.size.height) / 2,
      0
    );
    const brickKnockBackAmplitude = sanitizeKnockBackAmplitude(
      destructuble?.brickKnockBackAmplitude,
      brickKnockBackDistance,
      config,
      physicalSize
    );
    const baseHp =
      typeof destructuble?.hp === "number"
        ? scaleBrickStat(destructuble.hp, getBrickLevelStatMultiplier(level), true)
        : maxHp;
    const hp = sanitizeHp(brick.hp ?? baseHp, maxHp);
    const position = this.clampToMap(brick.position);
    const rotation = sanitizeRotation(brick.rotation);
    const rewards = stats.rewards;

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
      level,
      hp,
      maxHp,
      armor,
      baseDamage,
      brickKnockBackDistance,
      brickKnockBackSpeed,
      brickKnockBackAmplitude,
      physicalSize,
      rewards,
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
      knockback: null,
    };
  }

  private destroyBrick(brick: InternalBrickState, rewardMultiplier = 1): void {
    this.options.resources.notifyBrickDestroyed();
    if (hasAnyResources(brick.rewards)) {
      let rewards = this.applyBrickRewardBonuses(brick.rewards);
      if (rewardMultiplier >= 0 && rewardMultiplier !== 1) {
        rewards = scaleResourceStockpile(rewards, rewardMultiplier);
      }
      if (hasAnyResources(rewards)) {
        this.options.resources.grantResources(rewards);
      }
    }
    this.options.scene.removeObject(brick.sceneObjectId);
    this.bricks.delete(brick.id);
    this.brickOrder = this.brickOrder.filter((item) => item.id !== brick.id);
    this.spatialIndex.delete(brick.id);
    this.bricksWithKnockback.delete(brick.id);
    this.pushStats();
    if (this.bricks.size === 0) {
      this.options.onAllBricksDestroyed?.();
    }
  }

  private clearSceneObjects(): void {
    this.brickOrder.forEach((brick) => {
      this.options.scene.removeObject(brick.sceneObjectId);
    });
    this.bricks.clear();
    this.brickOrder = [];
    this.spatialIndex.clear();
    this.bricksWithKnockback.clear();
  }

  private applyBrickKnockback(
    brick: InternalBrickState,
    hitDirection: SceneVector2 | undefined
  ): void {
    const direction = normalizeVector(hitDirection ?? ZERO_VECTOR) ?? {
      x: 0,
      y: -1,
    };

    const amplitude = Math.max(brick.brickKnockBackAmplitude, 0);
    if (amplitude <= KNOCKBACK_EPSILON) {
      return;
    }

    const offset = scaleVector(direction, amplitude);

    if (vectorHasLength(offset)) {
      let combinedOffset = offset;

      if (brick.knockback) {
        const retained = scaleVector(brick.knockback.currentOffset, 0.35);
        combinedOffset = addVectors(retained, offset);
      }

      brick.knockback = {
        initialOffset: combinedOffset,
        currentOffset: combinedOffset,
        elapsed: 0,
      };
      this.bricksWithKnockback.add(brick.id);
      this.updateBrickSceneObject(brick, combinedOffset);
    }
  }

  private updateBrickSceneObject(
    brick: InternalBrickState,
    offset: SceneVector2
  ): void {
    const position = addVectors(brick.position, offset);
    this.options.scene.updateObject(brick.sceneObjectId, {
      position,
      rotation: brick.rotation,
    });
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
      level: state.level,
      hp: state.hp,
      maxHp: state.maxHp,
      armor: state.armor,
      baseDamage: state.baseDamage,
      brickKnockBackDistance: state.brickKnockBackDistance,
      brickKnockBackSpeed: state.brickKnockBackSpeed,
      brickKnockBackAmplitude: state.brickKnockBackAmplitude,
      physicalSize: state.physicalSize,
      rewards: cloneResourceStockpile(state.rewards),
    };
  }

  private applyBrickRewardBonuses(rewards: ResourceStockpile): ResourceStockpile {
    const multiplierRaw = this.options.bonuses.getBonusValue("brick_rewards");
    const multiplier = Number.isFinite(multiplierRaw) ? multiplierRaw : 1;
    if (Math.abs(multiplier - 1) < 1e-9) {
      return cloneResourceStockpile(rewards);
    }

    const scaled = createEmptyResourceStockpile();
    RESOURCE_IDS.forEach((id) => {
      const base = rewards[id] ?? 0;
      const value = Math.round(base * multiplier * 100) / 100;
      scaled[id] = value > 0 ? value : 0;
    });
    return scaled;
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

const addVectors = (a: SceneVector2, b: SceneVector2): SceneVector2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

const scaleVector = (vector: SceneVector2, scalar: number): SceneVector2 => ({
  x: vector.x * scalar,
  y: vector.y * scalar,
});

const vectorLength = (vector: SceneVector2): number => Math.hypot(vector.x, vector.y);

const vectorHasLength = (vector: SceneVector2, epsilon = 0.0001): boolean =>
  Math.abs(vector.x) > epsilon || Math.abs(vector.y) > epsilon;

const normalizeVector = (vector: SceneVector2): SceneVector2 | null => {
  const length = vectorLength(vector);
  if (length <= 0.0001) {
    return null;
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
};

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

const sanitizeKnockBackAmplitude = (
  value: number | undefined,
  distance: number,
  config: BrickConfig,
  physicalSize: number
): number => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (distance > 0) {
    return clamp(distance * 0.15, 4, 12);
  }

  const fallbackSize = Math.max(physicalSize, Math.max(config.size.width, config.size.height) / 2);
  return clamp(fallbackSize * 0.35, 4, 10);
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

const sanitizeBrickLevel = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
};

const getBrickLevelStatMultiplier = (level: number): number => Math.pow(3, level);

const getBrickLevelRewardMultiplier = (level: number): number => Math.pow(2, level);

const scaleBrickStat = (
  baseValue: number | undefined,
  multiplier: number,
  ensurePositive: boolean
): number => {
  if (typeof baseValue !== "number" || !Number.isFinite(baseValue)) {
    if (!ensurePositive) {
      return 0;
    }
    return multiplier > 1 ? 1 : 0;
  }
  const base = Math.max(baseValue, 0);
  const scaled = Math.round(base * multiplier);

  if (base === 0) {
    if (!ensurePositive) {
      return 0;
    }
    return multiplier > 1 ? 1 : 0;
  }

  if (ensurePositive) {
    return Math.max(1, scaled);
  }

  return Math.max(0, scaled);
};

const scaleResourceStockpile = (
  base: ResourceStockpile,
  multiplier: number
): ResourceStockpile => {
  const scaled = createEmptyResourceStockpile();
  RESOURCE_IDS.forEach((id) => {
    const value = base[id] ?? 0;
    const scaledValue = Math.round(Math.max(value, 0) * multiplier * 100) / 100;
    scaled[id] = scaledValue > 0 ? scaledValue : 0;
  });
  return scaled;
};

const calculateBrickStatsForLevel = (
  config: BrickConfig,
  level: number
): { maxHp: number; baseDamage: number; armor: number; rewards: ResourceStockpile } => {
  const sanitizedLevel = sanitizeBrickLevel(level);
  const statMultiplier = getBrickLevelStatMultiplier(sanitizedLevel);
  const rewardMultiplier = getBrickLevelRewardMultiplier(sanitizedLevel);
  const destructuble = config.destructubleData;

  const maxHp = Math.max(
    scaleBrickStat(destructuble?.maxHp ?? 1, statMultiplier, true),
    1
  );
  const baseDamage = scaleBrickStat(destructuble?.baseDamage ?? 0, statMultiplier, true);
  const armor = scaleBrickStat(destructuble?.armor ?? 0, statMultiplier, true);
  const baseRewards = normalizeResourceAmount(config.rewards);
  const rewards = scaleResourceStockpile(baseRewards, rewardMultiplier);

  return { maxHp, baseDamage, armor, rewards };
};
