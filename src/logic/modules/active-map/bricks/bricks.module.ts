import { DataBridge } from "@/core/logic/ui/DataBridge";
import { GameModule } from "@core/logic/types";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import { BrickConfig, BrickType, getBrickConfig } from "../../../../db/bricks-db";
import type {
  SceneFill,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { SpatialGrid } from "../../../utils/SpatialGrid";
import { clampNumber } from "@shared/helpers/numbers.helper";
import {
  ResourceStockpile,  
  RESOURCE_IDS,
  normalizeResourceAmount,
  hasAnyResources,
  cloneResourceStockpile,
  createEmptyResourceStockpile,
} from "../../../../db/resources-db";
import { cloneSceneColor } from "@shared/helpers/scene-color.helper";
import { cloneSceneFill } from "@shared/helpers/scene-fill.helper";
import {
  addVectors,
  scaleVector,
  vectorLength,
  vectorHasLength,
  normalizeVector,
} from "../../../../shared/helpers/vector.helper";
import { createBrickFill } from "./bricks.fill.helper";
import { tintSceneFill } from "@shared/helpers/scene-fill.helper";
import { sceneColorsEqual } from "@shared/helpers/scene-color.helper";
import {
  sanitizeHp,
  sanitizeBrickType,
  sanitizeBrickLevel,
  calculateBrickStatsForLevel,
  scaleResourceStockpile,
} from "./bricks.helpers";
import { sanitizeRotation } from "@shared/helpers/validation.helper";
import type { BrickEffectApplication } from "./brick-effects.types";
import type {
  BrickData,
  BrickRuntimeState,
  BricksModuleOptions,
  BrickSaveData,
  InternalBrickState,
  BrickExplosionState,
  BrickEffectTint,
} from "./bricks.types";
import {
  BRICK_HIT_SOUND_URL,
  BRICK_DESTROY_SOUND_URL,
  BRICK_COUNT_BRIDGE_KEY,
  BRICK_TOTAL_HP_BRIDGE_KEY,
  BRICK_KNOCKBACK_DURATION_MS,
  KNOCKBACK_EPSILON,
  TOTAL_HP_RECOMPUTE_INTERVAL_MS,
} from "./bricks.const";
import { ZERO_VECTOR } from "../../../../shared/helpers/geometry.const";
import { MapRunState } from "../map/MapRunState";
import { BrickStateFactory, BrickStateInput } from "./bricks.state-factory";
import { TargetingService } from "../targeting/TargetingService";
import { BricksTargetingProvider } from "../targeting/BricksTargetingProvider";
import type { StatusEffectsModule } from "../status-effects/status-effects.module";

export class BricksModule implements GameModule {
  public readonly id = "bricks";

  private bricks = new Map<string, InternalBrickState>();
  private brickOrder: InternalBrickState[] = [];
  private brickIdCounter = 0;
  private readonly spatialIndex = new SpatialGrid<InternalBrickState>(10);
  private readonly bricksWithKnockback = new Set<string>();
  private totalHpCached = 0;
  private hpRecomputeElapsedMs = 0;
  private readonly statusEffects: StatusEffectsModule;
  private lastPushedBrickCount = -1;
  private lastPushedTotalHp = -1;
  private readonly runState: MapRunState;
  private readonly stateFactory: BrickStateFactory;
  private readonly targeting?: TargetingService;

  constructor(private readonly options: BricksModuleOptions) {
    this.runState = options.runState;
    this.stateFactory = new BrickStateFactory({ scene: options.scene });
    this.targeting = options.targeting;
    this.statusEffects = options.statusEffects;
    this.statusEffects.registerBrickAdapter({
      hasBrick: (brickId) => this.bricks.has(brickId),
      damageBrick: (brickId, damage, opts) => {
        this.applyEffectDamage(brickId, damage, opts);
      },
      setTint: (brickId, tint) => {
        const brick = this.bricks.get(brickId);
        if (!brick) {
          return;
        }
        this.applyEffectTint(brick, tint);
      },
    });

    if (this.targeting) {
      this.targeting.registerProvider(new BricksTargetingProvider(this));
    }
  }

  public initialize(): void {
    this.recomputeTotalsAndPush();
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
    this.recomputeTotalsAndPush();
  }

  public cleanupExpired(): void {
    this.options.scene.flushAllPendingRemovals();
  }

  public save(): unknown {
    return null;
  }

  public tick(deltaMs: number): void {
    if (!this.runState.shouldProcessTick()) {
      return;
    }
    if (deltaMs > 0) {
      this.hpRecomputeElapsedMs += deltaMs;
      if (this.hpRecomputeElapsedMs >= TOTAL_HP_RECOMPUTE_INTERVAL_MS) {
        this.hpRecomputeElapsedMs = 0;
        this.recomputeTotalsAndPush();
      }
    }
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
      const progress = clampNumber(state.elapsed / BRICK_KNOCKBACK_DURATION_MS, 0, 1);
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
    const nearest = this.spatialIndex.queryNearest(position, { maxLayers: 128 });
    return nearest ? this.cloneState(nearest) : null;
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

  /**
   * Performance-oriented variant: iterates nearby bricks without allocating
   * per-brick clones or result arrays for the caller. The callback receives a
   * read-only view of the internal brick state. Do not mutate it.
   */
  public forEachBrickNear(
    position: SceneVector2,
    radius: number,
    visitor: (brick: Readonly<BrickRuntimeState>) => void,
  ): void {
    if (radius < 0) {
      return;
    }
    this.spatialIndex.forEachInCircle(position, radius, (brick) => {
      visitor(brick);
    });
  }

  /**
   * Ітерує через ВСІ цеглини без просторової фільтрації.
   * Швидше ніж forEachBrickNear з величезним радіусом.
   */
  public forEachBrick(visitor: (brick: Readonly<BrickRuntimeState>) => void): void {
    this.spatialIndex.forEachItem(visitor);
  }

  public applyEffect(effect: BrickEffectApplication): void {
    if (effect.type === "meltingTail") {
      this.statusEffects.applyEffect(
        "meltingTail",
        { type: "brick", id: effect.brickId },
        { durationMs: effect.durationMs, multiplier: effect.multiplier, tint: effect.tint ?? null },
      );
    } else if (effect.type === "freezingTail") {
      this.statusEffects.applyEffect(
        "freezingTail",
        { type: "brick", id: effect.brickId },
        { durationMs: effect.durationMs, divisor: effect.divisor, tint: effect.tint ?? null },
      );
    } else if (effect.type === "weakeningCurse") {
      this.statusEffects.applyEffect(
        "weakeningCurse",
        { type: "brick", id: effect.brickId },
        { durationMs: effect.durationMs, multiplier: effect.multiplier, tint: effect.tint ?? null },
      );
    } else if (effect.type === "weakeningCurseFlat") {
      this.statusEffects.applyEffect(
        "weakeningCurseFlat",
        { type: "brick", id: effect.brickId },
        { durationMs: effect.durationMs, flatReduction: effect.flatReduction, tint: effect.tint ?? null },
      );
    }
  }

  public getOutgoingDamageMultiplier(brickId: string): number {
    return this.statusEffects.getBrickOutgoingDamageMultiplier(brickId);
  }

  public getOutgoingDamageFlatReduction(brickId: string): number {
    return this.statusEffects.getBrickOutgoingDamageFlatReduction(brickId);
  }

  public applyDamage(
    brickId: string,
    rawDamage: number,
    hitDirection?: SceneVector2,
    options?: {
      rewardMultiplier?: number;
      armorPenetration?: number;
      overTime?: number;
      skipKnockback?: boolean;
    }
  ): { destroyed: boolean; brick: BrickRuntimeState | null; inflictedDamage: number } {
    const brick = this.bricks.get(brickId);
    if (!brick) {
      return { destroyed: false, brick: null, inflictedDamage: 0 };
    }

    const rewardMultiplier = Math.max(options?.rewardMultiplier ?? 1, 0);
    const armorPenetration = Math.max(options?.armorPenetration ?? 0, 0);
    const skipKnockback = options?.skipKnockback === true;
    const armorDelta = this.statusEffects.getTargetArmorDelta({ type: "brick", id: brickId });
    const effectiveArmor =
      Math.max(brick.armor + armorDelta - armorPenetration, 0) * (options?.overTime ?? 1);
    const incomingMultiplier = this.statusEffects.getBrickIncomingDamageMultiplier(brickId);
    const effectiveDamage = Math.max(rawDamage - effectiveArmor, 0) * Math.max(incomingMultiplier, 1);
    if (effectiveDamage <= 0) {
      return { destroyed: false, brick: this.cloneState(brick), inflictedDamage: 0 };
    }

    const previousHp = brick.hp;
    brick.hp = clampNumber(brick.hp - effectiveDamage, 0, brick.maxHp);
    const inflictedDamage = Math.max(0, previousHp - brick.hp);
    if (inflictedDamage > 0) {
      this.options.statistics?.recordDamageDealt(inflictedDamage);
      this.statusEffects.handleTargetHit({ type: "brick", id: brickId });
    }
    this.totalHpCached += brick.hp - previousHp;

    if (brick.hp <= 0) {
      this.playBrickSound("destroy");
      this.spawnBrickExplosion(brick.destructionExplosion, brick);
      this.destroyBrick(brick, rewardMultiplier);
      return { destroyed: true, brick: null, inflictedDamage };
    }

    this.playBrickSound("hit");
    this.spawnBrickExplosion(brick.damageExplosion, brick);
    if (!skipKnockback) {
      this.applyBrickKnockback(brick, hitDirection);
    }
    this.pushStats();
    return { destroyed: false, brick: this.cloneState(brick), inflictedDamage };
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
    this.totalHpCached = 0;
    this.lastPushedBrickCount = -1;
    this.lastPushedTotalHp = -1;

    bricks.forEach((brick) => {
      const input: BrickStateInput = {
        brick,
        brickId: this.createBrickId(),
        clampToMap: (pos) => this.clampToMap(pos),
      };
      const state = this.stateFactory.createWithTransform(input);
      this.bricks.set(state.id, state);
      this.brickOrder.push(state);
      this.spatialIndex.set(state.id, state.position, state.physicalSize, state);
      this.totalHpCached += state.hp;
    });

    this.pushStats();
  }


  private playBrickSound(type: "hit" | "destroy"): void {
    const audio = this.options.audio;
    if (!audio) {
      return;
    }

    if (type === "hit") {
      audio.playSoundEffect(BRICK_HIT_SOUND_URL);
      return;
    }

    audio.playSoundEffect(BRICK_DESTROY_SOUND_URL);
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
    this.statusEffects.clearTargetEffects({ type: "brick", id: brick.id });
    this.options.scene.removeObject(brick.sceneObjectId);
    this.bricks.delete(brick.id);
    this.brickOrder = this.brickOrder.filter((item) => item.id !== brick.id);
    this.spatialIndex.delete(brick.id);
    this.bricksWithKnockback.delete(brick.id);
    this.totalHpCached -= brick.hp;
    this.pushStats();
    if (this.bricks.size === 0) {
      this.runState.complete(true);
    }
  }

  private applyEffectDamage(
    brickId: string,
    damage: number,
    options: { rewardMultiplier: number; armorPenetration: number; overTime: number }
  ): void {
    if (damage <= 0) {
      return;
    }
    this.applyDamage(brickId, damage, undefined, {
      rewardMultiplier: options.rewardMultiplier,
      armorPenetration: options.armorPenetration,
      skipKnockback: true,
      overTime: Math.max(options.overTime ?? 0, 0),
    });
  }

  private applyEffectTint(brick: InternalBrickState, tint: BrickEffectTint | null): void {
    if (!tint) {
      if (!brick.activeTint) {
        return;
      }
      const restoredFill = cloneSceneFill(brick.baseFill);
      brick.appliedFill = restoredFill;
      brick.activeTint = null;
      const offset = brick.knockback?.currentOffset ?? ZERO_VECTOR;
      this.updateBrickSceneObject(brick, offset, { fill: restoredFill });
      return;
    }

    const normalizedIntensity = clampNumber(tint.intensity, 0, 1);
    const hasSameTint =
      brick.activeTint &&
      Math.abs(brick.activeTint.intensity - normalizedIntensity) < 1e-3 &&
      sceneColorsEqual(brick.activeTint.color, tint.color);
    if (hasSameTint) {
      return;
    }

    const tintedFill = tintSceneFill(brick.baseFill, tint.color, normalizedIntensity);
    brick.appliedFill = tintedFill;
    brick.activeTint = {
      color: cloneSceneColor(tint.color),
      intensity: normalizedIntensity,
    };
    const offset = brick.knockback?.currentOffset ?? ZERO_VECTOR;
    this.updateBrickSceneObject(brick, offset, { fill: tintedFill });
  }

  private clearSceneObjects(): void {
    this.brickOrder.forEach((brick) => {
      this.options.scene.removeObject(brick.sceneObjectId);
      this.statusEffects.clearTargetEffects({ type: "brick", id: brick.id });
    });
    this.bricks.clear();
    this.brickOrder = [];
    this.spatialIndex.clear();
    this.bricksWithKnockback.clear();
    this.totalHpCached = 0;
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
    offset: SceneVector2,
    extras: { fill?: SceneFill } = {}
  ): void {
    const position = addVectors(brick.position, offset);
    const payload: {
      position: SceneVector2;
      rotation: number;
      fill?: SceneFill;
    } = {
      position,
      rotation: brick.rotation,
    };
    if (extras.fill) {
      payload.fill = cloneSceneFill(extras.fill);
    }
    this.options.scene.updateObject(brick.sceneObjectId, payload);
  }

  private pushStats(): void {
    const brickCount = this.bricks.size;
    if (brickCount !== this.lastPushedBrickCount) {
      DataBridgeHelpers.pushState(this.options.bridge, BRICK_COUNT_BRIDGE_KEY, brickCount);
      this.lastPushedBrickCount = brickCount;
    }
    const totalHp = Math.max(0, Math.floor(this.totalHpCached));
    if (totalHp !== this.lastPushedTotalHp) {
      DataBridgeHelpers.pushState(this.options.bridge, BRICK_TOTAL_HP_BRIDGE_KEY, totalHp);
      this.lastPushedTotalHp = totalHp;
    }
  }

  private recomputeTotalsAndPush(): void {
    let totalHp = 0;
    this.brickOrder.forEach((brick) => {
      totalHp += brick.hp;
    });
    this.totalHpCached = totalHp;
    this.pushStats();
  }

  private clampToMap(position: SceneVector2): SceneVector2 {
    const { width, height } = this.options.scene.getMapSize();
    return {
      x: clampNumber(position.x, 0, width),
      y: clampNumber(position.y, 0, height),
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
      knockBackDistance: state.knockBackDistance,
      knockBackSpeed: state.knockBackSpeed,
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
