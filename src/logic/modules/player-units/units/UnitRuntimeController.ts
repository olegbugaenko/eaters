import { SceneObjectManager, SceneVector2 } from "../../../services/SceneObjectManager";
import { MovementService, MovementBodyState } from "../../../services/MovementService";
import { BricksModule, BrickRuntimeState } from "../../bricks/bricks.module";
import {
  BURNING_TAIL_DAMAGE_RATIO_PER_SECOND,
  BURNING_TAIL_DURATION_MS,
  FREEZING_TAIL_DURATION_MS,
} from "../../bricks/BrickEffectsManager";
import { PlayerUnitAbilities, AbilityActivationResult } from "../PlayerUnitAbilities";
import type { UnitTargetingMode } from "../../../../types/unit-targeting";
import type { StatisticsTracker } from "../../statistics/statistics.module";
import { ExplosionModule } from "../../explosion/explosion.module";
import { PlayerUnitType } from "../../../../db/player-units-db";
import { getUnitModuleConfig } from "../../../../db/unit-modules-db";
import { UnitProjectileController } from "./UnitProjectileController";
import { spawnTailNeedleVolley } from "./TailNeedleVolley";
import type { PlayerUnitState } from "./UnitTypes";
import { clampNumber, clampProbability } from "@/utils/helpers/numbers";
import {
  ATTACK_DISTANCE_EPSILON,
  COLLISION_RESOLUTION_ITERATIONS,
  ZERO_VECTOR,
  CRITICAL_HIT_EXPLOSION_RADIUS,
  PHEROMONE_TIMER_CAP_SECONDS,
  TARGETING_RADIUS_STEP,
  IDLE_WANDER_RADIUS,
  IDLE_WANDER_TARGET_EPSILON,
  IDLE_WANDER_RESEED_INTERVAL,
  IDLE_WANDER_SPEED_FACTOR,
  TARGETING_SCORE_EPSILON,
} from "./UnitTypes";


export interface UnitRuntimeControllerOptions {
  scene: SceneObjectManager;
  movement: MovementService;
  bricks: BricksModule;
  abilities: PlayerUnitAbilities;
  statistics?: StatisticsTracker;
  explosions: ExplosionModule;
  projectiles: UnitProjectileController;
  getDesignTargetingMode: (
    designId: string | null,
    type: PlayerUnitType
  ) => UnitTargetingMode;
  syncUnitTargetingMode: (unit: PlayerUnitState) => UnitTargetingMode;
  removeUnit: (unit: PlayerUnitState) => void;
  updateSceneState: (
    unit: PlayerUnitState,
    options?: { forceFill?: boolean; forceStroke?: boolean }
  ) => void;
  updateInternalFurnaceEffect: (unit: PlayerUnitState) => void;
}


export interface UnitUpdateResult {
  statsChanged: boolean;
  unitsRemoved: PlayerUnitState[];
}

const roundStat = (value: number): number => Math.round(value * 100) / 100;

const cloneVector = (vector: SceneVector2): SceneVector2 => ({
  x: vector.x,
  y: vector.y,
});

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

export class UnitRuntimeController {
  private readonly scene: SceneObjectManager;
  private readonly movement: MovementService;
  private readonly bricks: BricksModule;
  private readonly abilities: PlayerUnitAbilities;
  private readonly statistics?: StatisticsTracker;
  private readonly explosions: ExplosionModule;
  private readonly projectiles: UnitProjectileController;
  private readonly getDesignTargetingMode: (
    designId: string | null,
    type: PlayerUnitType
  ) => UnitTargetingMode;
  private readonly syncUnitTargetingMode: (unit: PlayerUnitState) => UnitTargetingMode;
  private readonly removeUnit: (unit: PlayerUnitState) => void;
  private readonly updateSceneState: (
    unit: PlayerUnitState,
    options?: { forceFill?: boolean; forceStroke?: boolean }
  ) => void;
  private readonly updateInternalFurnaceEffect: (unit: PlayerUnitState) => void;

  constructor(options: UnitRuntimeControllerOptions) {
    this.scene = options.scene;
    this.movement = options.movement;
    this.bricks = options.bricks;
    this.abilities = options.abilities;
    this.statistics = options.statistics;
    this.explosions = options.explosions;
    this.projectiles = options.projectiles;
    this.getDesignTargetingMode = options.getDesignTargetingMode;
    this.syncUnitTargetingMode = options.syncUnitTargetingMode;
    this.removeUnit = options.removeUnit;
    this.updateSceneState = options.updateSceneState;
    this.updateInternalFurnaceEffect = options.updateInternalFurnaceEffect;
  }

  public updateUnits(
    units: readonly PlayerUnitState[],
    deltaSeconds: number
  ): UnitUpdateResult {
    const unitsSnapshot = [...units];
    const plannedTargets = new Map<string, string | null>();
    const removedUnitIds = new Set<string>();
    let statsDirty = false;
    const unitsRemoved: PlayerUnitState[] = [];

    const markUnitRemoved = (unit: PlayerUnitState): void => {
      if (removedUnitIds.has(unit.id)) {
        return;
      }
      removedUnitIds.add(unit.id);
      this.removeUnit(unit);
      unitsRemoved.push(unit);
      statsDirty = true;
    };

    // Phase 1: Update timers, regen, abilities, and plan movement
    unitsSnapshot.forEach((unit) => {
      if (unit.hp <= 0) {
        markUnitRemoved(unit);
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

      const abilityResult = this.abilities.processUnitAbilities(unit as any, deltaSeconds);
      if (abilityResult?.statsChanged) {
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

    // Phase 2: Resolve collisions, update positions, perform attacks
    unitsSnapshot.forEach((unit) => {
      if (removedUnitIds.has(unit.id) || unit.hp <= 0) {
        markUnitRemoved(unit);
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
      this.updateSceneState(unit);

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

        if (unit.hp <= 0) {
          this.removeUnit(unit);
          unitsRemoved.push(unit);
          return;
        }
      }
    });

    this.projectiles.tick(deltaSeconds * 1000);

    return { statsChanged: statsDirty, unitsRemoved };
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
    const evaluated = new Set<string>();
    while (radius <= maxRadius + TARGETING_RADIUS_STEP) {
      const bricks = this.bricks.findBricksNear(unit.position, radius);
      const candidate = this.pickBestBrickCandidate(unit.position, bricks, mode, evaluated);
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
    mode: UnitTargetingMode,
    evaluated?: Set<string>
  ): BrickRuntimeState | null {
    let best: BrickRuntimeState | null = null;
    let bestScore = 0;
    let bestDistanceSq = 0;
    bricks.forEach((brick) => {
      if (!brick || brick.hp <= 0) {
        return;
      }
      if (evaluated) {
        if (evaluated.has(brick.id)) {
          return;
        }
        evaluated.add(brick.id);
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
    const variance = 0.2;
    const varianceMultiplier = 1 - variance + Math.random() * (variance * 2);
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
    const bonusDamage = this.abilities.consumeAttackBonuses(unit as any);
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

    this.updateSceneState(unit);
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

  private clampToMap(position: SceneVector2): SceneVector2 {
    const mapSize = this.scene.getMapSize();
    return {
      x: clampNumber(position.x, 0, mapSize.width),
      y: clampNumber(position.y, 0, mapSize.height),
    };
  }
}
