import { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { MovementService, MovementBodyState } from "@core/logic/provided/services/movement/MovementService";
import { BricksModule } from "../../bricks/bricks.module";
import type { BrickRuntimeState } from "../../bricks/bricks.types";
import { TargetingService } from "../../targeting/TargetingService";
import { isTargetOfType, type TargetSnapshot } from "../../targeting/targeting.types";
import type { DamageService } from "../../targeting/DamageService";
import type { EnemiesModule } from "../../enemies/enemies.module";
import type { EnemyRuntimeState } from "../../enemies/enemies.types";
import type { StatusEffectsModule } from "../../status-effects/status-effects.module";
import {
  BURNING_TAIL_DURATION_MS,
  FREEZING_TAIL_DURATION_MS,
} from "../../bricks/brick-effects.const";
import { PlayerUnitAbilities, AbilityActivationResult } from "../PlayerUnitAbilities";
import type { UnitTargetingMode } from "@shared/types/unit-targeting";
import type { StatisticsTracker } from "../../../shared/statistics/statistics.module";
import { ExplosionModule } from "../../../scene/explosion/explosion.module";
import { PlayerUnitType } from "../../../../../db/player-units-db";
import { getUnitModuleConfig } from "../../../../../db/unit-modules-db";
import { UnitProjectileController } from "../../projectiles/ProjectileController";
import type { PlayerUnitState } from "./UnitTypes";
import { clampNumber, clampProbability } from "@shared/helpers/numbers.helper";
import {
  ATTACK_DISTANCE_EPSILON,
  COLLISION_RESOLUTION_ITERATIONS,
  CRITICAL_HIT_EXPLOSION_RADIUS,
  PHEROMONE_TIMER_CAP_SECONDS,
  TARGETING_RADIUS_STEP,
  IDLE_WANDER_RADIUS,
  IDLE_WANDER_TARGET_EPSILON,
  IDLE_WANDER_RESEED_INTERVAL,
  IDLE_WANDER_SPEED_FACTOR,
  TARGETING_SCORE_EPSILON,
} from "./UnitTypes";
import { ZERO_VECTOR } from "../../../../../shared/helpers/geometry.const";


export interface UnitRuntimeControllerOptions {
  scene: SceneObjectManager;
  movement: MovementService;
  bricks: BricksModule;
  targeting: TargetingService;
  abilities: PlayerUnitAbilities;
  statistics?: StatisticsTracker;
  explosions: ExplosionModule;
  projectiles: UnitProjectileController;
  damage?: DamageService;
  enemies?: EnemiesModule;
  statusEffects: StatusEffectsModule;
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
}


export interface UnitUpdateResult {
  statsChanged: boolean;
  unitsRemoved: PlayerUnitState[];
}

import { roundStat } from "../../../../../shared/helpers/numbers.helper";
import {
  cloneVector,
  addVectors,
  subtractVectors,
  scaleVector,
  vectorLength,
  vectorHasLength,
  vectorEquals,
  normalizeVector,
} from "../../../../../shared/helpers/vector.helper";

export class UnitRuntimeController {
  private readonly scene: SceneObjectManager;
  private readonly movement: MovementService;
  private readonly bricks: BricksModule;
  private readonly targeting: TargetingService;
  private readonly abilities: PlayerUnitAbilities;
  private readonly statistics?: StatisticsTracker;
  private readonly explosions: ExplosionModule;
  private readonly projectiles: UnitProjectileController;
  private readonly damage?: DamageService;
  private readonly enemies?: EnemiesModule;
  private readonly statusEffects: StatusEffectsModule;
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

  constructor(options: UnitRuntimeControllerOptions) {
    this.scene = options.scene;
    this.movement = options.movement;
    this.bricks = options.bricks;
    this.targeting = options.targeting;
    this.abilities = options.abilities;
    this.statistics = options.statistics;
    this.explosions = options.explosions;
    this.projectiles = options.projectiles;
    this.damage = options.damage;
    this.enemies = options.enemies;
    this.statusEffects = options.statusEffects;
    this.getDesignTargetingMode = options.getDesignTargetingMode;
    this.syncUnitTargetingMode = options.syncUnitTargetingMode;
    this.removeUnit = options.removeUnit;
    this.updateSceneState = options.updateSceneState;
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

      const resolved = this.resolveTarget(unit);
      const target = resolved?.target ?? null;
      plannedTargets.set(unit.id, resolved?.target.id ?? null);

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
      let target: BrickRuntimeState | EnemyRuntimeState | null = null;
      let targetType: "brick" | "enemy" | null = null;
      
      if (targetId) {
        // Перевіряємо чи це брік
        const brickTarget = this.bricks.getBrickState(targetId);
        if (brickTarget) {
          target = brickTarget;
          targetType = "brick";
        } else if (this.enemies) {
          // Перевіряємо чи це ворог
          const enemyTarget = this.enemies.getEnemyState(targetId);
          if (enemyTarget) {
            target = enemyTarget;
            targetType = "enemy";
          } else {
            targetId = null;
            plannedTargets.set(unit.id, null);
          }
        } else {
          targetId = null;
          plannedTargets.set(unit.id, null);
        }
      }
      
      if (!target) {
        const resolved = this.resolveTarget(unit);
        if (resolved) {
          target = resolved.target;
          targetType = resolved.type;
          plannedTargets.set(unit.id, resolved.target.id);
        } else {
          plannedTargets.set(unit.id, null);
        }
      }

      if (collidedBrickIds.length > 0) {
        for (const brickId of collidedBrickIds) {
          const collidedBrick = this.bricks.getBrickState(brickId);
          if (!collidedBrick) {
            continue;
          }
          target = collidedBrick;
          targetType = "brick";
          unit.targetBrickId = collidedBrick.id;
          plannedTargets.set(unit.id, collidedBrick.id);
          break;
        }
      }

      const rotation = this.computeRotation(unit, target, resolvedVelocity);
      unit.rotation = rotation;
      this.updateSceneState(unit);

      if (!target || !targetType) {
        return;
      }

      const direction = subtractVectors(target.position, unit.position);
      const distance = Math.hypot(direction.x, direction.y);
      const attackRange = unit.baseAttackDistance + unit.physicalSize + target.physicalSize;

      if (
        distance <= attackRange + ATTACK_DISTANCE_EPSILON &&
        unit.attackCooldown <= 0
      ) {
        const hpChanged = this.performAttack(unit, target, targetType, direction, distance);
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

  private resolveTarget(unit: PlayerUnitState): { target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" } | null {
    const mode = this.syncUnitTargetingMode(unit);
    if (mode === "none") {
      unit.targetBrickId = null;
      return null;
    }

    if (unit.targetBrickId) {
      // Перевіряємо чи це брік
      const brickTarget = this.getBrickTarget(unit.targetBrickId);
      if (brickTarget && brickTarget.hp > 0) {
        return { target: brickTarget, type: "brick" };
      }
      
      // Перевіряємо чи це ворог
      if (this.enemies) {
        const enemyTarget = this.enemies.getEnemyState(unit.targetBrickId);
        if (enemyTarget && enemyTarget.hp > 0) {
          return { target: enemyTarget, type: "enemy" };
        }
      }
      
      unit.targetBrickId = null;
    }

    const selected = this.selectTargetForMode(unit, mode);
    if (selected) {
      unit.targetBrickId = selected.target.id;
      return selected;
    }
    unit.targetBrickId = null;
    return null;
  }

  private selectTargetForMode(
    unit: PlayerUnitState,
    mode: UnitTargetingMode
  ): { target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" } | null {
    if (mode === "nearest") {
      return this.findNearestTarget(unit.position);
    }
    if (mode === "firstBrick") {
      return (
        this.findNearestTargetByType(unit.position, "brick") ??
        this.findNearestTargetByType(unit.position, "enemy") ??
        this.findNearestTarget(unit.position)
      );
    }
    if (mode === "firstEnemy") {
      return (
        this.findNearestTargetByType(unit.position, "enemy") ??
        this.findNearestTargetByType(unit.position, "brick") ??
        this.findNearestTarget(unit.position)
      );
    }
    return this.findTargetByCriterion(unit, mode);
  }

  private findNearestTargetByType(
    position: SceneVector2,
    preferredType: "brick" | "enemy"
  ): { target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" } | null {
    const target = this.targeting.findNearestTarget(position, { types: [preferredType] });
    if (!target) {
      return null;
    }
    if (preferredType === "brick" && isTargetOfType<"brick", BrickRuntimeState>(target, "brick")) {
      const brick = target.data ?? this.bricks.getBrickState(target.id);
      if (brick && brick.hp > 0) {
        return { target: brick, type: "brick" };
      }
      return null;
    }
    if (
      preferredType === "enemy" &&
      isTargetOfType<"enemy", EnemyRuntimeState>(target, "enemy")
    ) {
      const enemy = target.data ?? (this.enemies ? this.enemies.getEnemyState(target.id) : null);
      if (enemy && enemy.hp > 0) {
        return { target: enemy, type: "enemy" };
      }
    }
    return null;
  }

  private findTargetByCriterion(
    unit: PlayerUnitState,
    mode: UnitTargetingMode
  ): { target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" } | null {
    const mapSize = this.scene.getMapSize();
    const maxRadius = Math.max(Math.hypot(mapSize.width, mapSize.height), TARGETING_RADIUS_STEP);
    let radius = TARGETING_RADIUS_STEP;
    const evaluated = new Set<string>();
    while (radius <= maxRadius + TARGETING_RADIUS_STEP) {
      const targets = this.findTargetsNear(unit.position, radius);
      const candidate = this.pickBestTargetCandidate(unit.position, targets, mode, evaluated);
      if (candidate) {
        return candidate;
      }
      radius += TARGETING_RADIUS_STEP;
    }
    return this.findNearestTarget(unit.position);
  }
  
  private findTargetsNear(position: SceneVector2, radius: number): Array<{ target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" }> {
    if (radius < 0) {
      return [];
    }
    const targets = this.targeting.findTargetsNear(position, radius, { types: ["brick", "enemy"] });
    const result: Array<{ target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" }> = [];
    
    targets.forEach((target) => {
      if (isTargetOfType<"brick", BrickRuntimeState>(target, "brick")) {
        const brick = target.data ?? this.bricks.getBrickState(target.id);
        if (brick && brick.hp > 0) {
          result.push({ target: brick, type: "brick" });
        }
      } else if (isTargetOfType<"enemy", EnemyRuntimeState>(target, "enemy")) {
        const enemy = target.data ?? (this.enemies ? this.enemies.getEnemyState(target.id) : null);
        if (enemy && enemy.hp > 0) {
          result.push({ target: enemy, type: "enemy" });
        }
      }
    });
    
    return result;
  }
  
  private pickBestTargetCandidate(
    origin: SceneVector2,
    targets: Array<{ target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" }>,
    mode: UnitTargetingMode,
    evaluated?: Set<string>
  ): { target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" } | null {
    let best: { target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" } | null = null;
    let bestScore = 0;
    let bestDistanceSq = 0;
    
    targets.forEach(({ target, type }) => {
      if (!target || target.hp <= 0) {
        return;
      }
      if (evaluated) {
        if (evaluated.has(target.id)) {
          return;
        }
        evaluated.add(target.id);
      }
      
      const score = this.computeTargetScore(target, type, mode);
      if (score === null) {
        return;
      }
      
      const dx = target.position.x - origin.x;
      const dy = target.position.y - origin.y;
      const distanceSq = dx * dx + dy * dy;
      if (!Number.isFinite(distanceSq)) {
        return;
      }
      
      if (!best) {
        best = { target, type };
        bestScore = score;
        bestDistanceSq = distanceSq;
        return;
      }
      
      if (this.isCandidateBetter(mode, score, distanceSq, bestScore, bestDistanceSq)) {
        best = { target, type };
        bestScore = score;
        bestDistanceSq = distanceSq;
      }
    });
    
    return best;
  }
  
  private computeTargetScore(
    target: BrickRuntimeState | EnemyRuntimeState,
    type: "brick" | "enemy",
    mode: UnitTargetingMode
  ): number | null {
    switch (mode) {
      case "highestHp":
      case "lowestHp":
        return Math.max(target.hp, 0);
      case "highestDamage":
      case "lowestDamage":
        return Math.max(target.baseDamage, 0);
      default:
        return null;
    }
  }

  private getBrickTarget(brickId: string): BrickRuntimeState | null {
    const target = this.targeting.getTargetById(brickId, { types: ["brick"] });
    if (target && isTargetOfType<"brick", BrickRuntimeState>(target, "brick")) {
      return target.data ?? this.bricks.getBrickState(target.id);
    }
    return null;
  }

  private findNearestTarget(position: SceneVector2): { target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" } | null {
    // Шукаємо найближчу ціль серед бріків та ворогів
    const target = this.targeting.findNearestTarget(position, { types: ["brick", "enemy"] });
    if (!target) {
      return null;
    }
    
    if (isTargetOfType<"brick", BrickRuntimeState>(target, "brick")) {
      const brick = target.data ?? this.bricks.getBrickState(target.id);
      if (brick && brick.hp > 0) {
        return { target: brick, type: "brick" };
      }
    } else if (isTargetOfType<"enemy", EnemyRuntimeState>(target, "enemy")) {
      const enemy = target.data ?? (this.enemies ? this.enemies.getEnemyState(target.id) : null);
      if (enemy && enemy.hp > 0) {
        return { target: enemy, type: "enemy" };
      }
    }
    
    return null;
  }

  private findBricksNear(position: SceneVector2, radius: number): BrickRuntimeState[] {
    if (radius < 0) {
      return [];
    }
    const targets = this.targeting.findTargetsNear(position, radius, { types: ["brick"] });
    const bricks: BrickRuntimeState[] = [];
    targets.forEach((target) => {
      if (!isTargetOfType<"brick", BrickRuntimeState>(target, "brick")) {
        return;
      }
      const brick = target.data ?? this.bricks.getBrickState(target.id);
      if (brick) {
        bricks.push(brick);
      }
    });
    return bricks;
  }

  private forEachBrickNear(
    position: SceneVector2,
    radius: number,
    visitor: (brick: BrickRuntimeState) => void,
  ): void {
    if (radius < 0) {
      return;
    }
    this.targeting.forEachTargetNear(
      position,
      radius,
      (target) => {
        if (!isTargetOfType<"brick", BrickRuntimeState>(target, "brick")) {
          return;
        }
        const brick = target.data ?? this.bricks.getBrickState(target.id);
        if (brick) {
          visitor(brick);
        }
      },
      { types: ["brick"] },
    );
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
    target: BrickRuntimeState | EnemyRuntimeState | null
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

    const moveSpeed = this.getEffectiveMoveSpeed(unit);
    const desiredSpeed = Math.max(
      Math.min(moveSpeed, distanceOutsideRange),
      moveSpeed * 0.25
    );
    let desiredVelocity = scaleVector(direction, desiredSpeed);

    // Додаємо obstacle avoidance щоб не налазити на цеглу
    const avoidance = this.computeObstacleAvoidance(unit, desiredVelocity);
    if (vectorHasLength(avoidance)) {
      desiredVelocity = addVectors(desiredVelocity, avoidance);
    }

    return this.computeSteeringForce(unit, movementState.velocity, desiredVelocity);
  }

  /**
   * Обчислює силу уникнення перешкод (цегли)
   */
  private computeObstacleAvoidance(
    unit: PlayerUnitState,
    desiredVelocity: SceneVector2
  ): SceneVector2 {
    if (!vectorHasLength(desiredVelocity)) {
      return ZERO_VECTOR;
    }

    const avoidanceRadius = unit.physicalSize * 3;
    let avoidanceVector = { ...ZERO_VECTOR };

    this.forEachBrickNear(unit.position, avoidanceRadius, (brick) => {
      // Перевіряємо чи цегла прохідна для юніта
      if (brick.passableFor && brick.passableFor.length > 0) {
        // Якщо є passableFor - цегла прохідна, пропускаємо
        return;
      }

      const toBrick = subtractVectors(brick.position, unit.position);
      const distance = vectorLength(toBrick);
      const combinedRadius = brick.physicalSize + unit.physicalSize;
      const normalizedToBrick = normalizeVector(toBrick);
      if (!normalizedToBrick) {
        return;
      }

      // Перевіряємо чи перешкода попереду
      const isAhead =
        normalizedToBrick.x * desiredVelocity.x + normalizedToBrick.y * desiredVelocity.y > 0;
      if (distance <= 0 || distance > avoidanceRadius || !isAhead) {
        return;
      }

      // Обчислюємо силу відштовхування
      const overlap = combinedRadius + 4 - distance;
      if (overlap <= 0) {
        return;
      }

      const pushDirection = scaleVector(toBrick, -1 / Math.max(distance, 1));
      const strength = overlap / Math.max(combinedRadius, 1);
      avoidanceVector = addVectors(avoidanceVector, scaleVector(pushDirection, strength));
    });

    const length = vectorLength(avoidanceVector);
    if (length <= 0) {
      return ZERO_VECTOR;
    }

    // Обмежуємо силу уникнення
    const maxAvoidance = this.getEffectiveMoveSpeed(unit) * 0.5; // Менша ніж у ворогів, щоб не заважати атаці
    return scaleVector(avoidanceVector, Math.min(maxAvoidance / length, 1));
  }

  private getEffectiveMoveSpeed(unit: PlayerUnitState): number {
    const multiplier = this.statusEffects.getTargetSpeedMultiplier({
      type: "unit",
      id: unit.id,
    });
    return Math.max(unit.moveSpeed * Math.max(multiplier, 0), 0);
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
    const moveSpeed = this.getEffectiveMoveSpeed(unit);
    const desiredSpeed = Math.max(moveSpeed * IDLE_WANDER_SPEED_FACTOR, moveSpeed * 0.2);
    const cappedSpeed = Math.min(desiredSpeed, Math.max(distance, moveSpeed * 0.2));
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
      this.forEachBrickNear(resolvedPosition, unit.physicalSize, (brick) => {
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
    target: BrickRuntimeState | EnemyRuntimeState | null,
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
    const stackMultiplier = this.statusEffects.getUnitAttackMultiplier(unit.id);
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
    target: BrickRuntimeState | EnemyRuntimeState,
    targetType: "brick" | "enemy",
    direction: SceneVector2,
    distance: number
  ): boolean {
    let hpChanged = false;
    unit.attackCooldown = unit.baseAttackInterval;
    unit.timeSinceLastAttack = 0;
    const { damage, isCritical } = this.getAttackOutcome(unit);
    const bonusDamage = this.abilities.consumeAttackBonuses(unit as any);
    const totalDamage = Math.max(damage + bonusDamage, 0);
    
    let inflictedDamage = 0;
    let surviving: BrickRuntimeState | EnemyRuntimeState | null = null;
    let targetDestroyed = false;
    
    if (targetType === "brick") {
      const result = this.bricks.applyDamage(target.id, totalDamage, direction, {
        rewardMultiplier: unit.rewardMultiplier,
        armorPenetration: unit.armorPenetration,
      });
      inflictedDamage = result.inflictedDamage;
      surviving = result.brick ?? target;
      targetDestroyed = result.destroyed;
      hpChanged = inflictedDamage > 0;
    } else if (targetType === "enemy" && this.damage && this.enemies) {
      // Використовуємо DamageService для атаки ворогів
      const targetSnapshot = this.targeting.getTargetById(target.id, { types: ["enemy"] });
      if (targetSnapshot && isTargetOfType<"enemy", EnemyRuntimeState>(targetSnapshot, "enemy")) {
        inflictedDamage = this.damage.applyTargetDamage(target.id, totalDamage, {
          armorPenetration: unit.armorPenetration,
        });
        hpChanged = inflictedDamage > 0;
        
        // Перевіряємо чи ворог вижив
        const updatedEnemy = this.enemies.getEnemyState(target.id);
        surviving = updatedEnemy ?? null;
        targetDestroyed = !surviving;
      } else {
        return false;
      }
    } else {
      return false;
    }

    if (isCritical && totalDamage > 0) {
      const effectPosition = surviving?.position ?? target.position;
      this.spawnCriticalHitEffect(effectPosition);
    }

    const effectOrigin = surviving?.position ?? target.position;
    const skipBrickId = targetType === "brick" && !targetDestroyed && surviving ? surviving.id : null;

    // Ефекти застосовуються тільки до бріків
    if (targetType === "brick") {
      const meltingLevel = unit.moduleLevels?.burningTail ?? 0;
      if (meltingLevel > 0 && inflictedDamage > 0) {
        const meltingConfig = getUnitModuleConfig("burningTail");
        const meltingRadius = meltingConfig.meta?.areaRadius ?? 0;
        const base = Number.isFinite(meltingConfig.baseBonusValue) ? meltingConfig.baseBonusValue : 0;
        const perLevel = Number.isFinite(meltingConfig.bonusPerLevel) ? meltingConfig.bonusPerLevel : 0;
        const multiplier = Math.max(base + perLevel * Math.max(meltingLevel - 1, 0), 1);

        if (!targetDestroyed && surviving) {
          this.bricks.applyEffect({
            type: "meltingTail",
            brickId: surviving.id,
            durationMs: BURNING_TAIL_DURATION_MS,
            multiplier,
          });
        }

        if (meltingRadius > 0) {
          this.forEachBrickNear(effectOrigin, meltingRadius, (brick) => {
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

        if (!targetDestroyed && surviving) {
          this.bricks.applyEffect({
            type: "freezingTail",
            brickId: surviving.id,
            durationMs: FREEZING_TAIL_DURATION_MS,
            divisor,
          });
        }

        if (freezingRadius > 0) {
          this.forEachBrickNear(effectOrigin, freezingRadius, (brick) => {
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
    }

    this.abilities.processUnitAbilitiesOnAttack(
      unit as any,
      direction,
      inflictedDamage,
      totalDamage,
    );

    if (totalDamage > 0 && unit.damageTransferPercent > 0) {
      const splashDamage = totalDamage * unit.damageTransferPercent;
      if (splashDamage > 0) {
        this.forEachBrickNear(target.position, unit.damageTransferRadius, (brick) => {
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

    // Knockback для цілей з налаштованими параметрами
    const knockBackTarget = surviving ?? target;
    const knockBackDistance = targetType === "enemy"
      ? (knockBackTarget as EnemyRuntimeState).selfKnockBackDistance
      : (knockBackTarget as BrickRuntimeState).knockBackDistance;
    const knockBackSpeed = targetType === "enemy"
      ? (knockBackTarget as EnemyRuntimeState).selfKnockBackSpeed
      : (knockBackTarget as BrickRuntimeState).knockBackSpeed;
    this.applyKnockBack(
      unit,
      direction,
      distance,
      knockBackDistance,
      knockBackSpeed
    );
    
    // Counter damage тільки для бріків
    if (targetType === "brick") {
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
    }

    if (unit.attackStackBonusPerHit > 0 && unit.attackStackBonusCap > 0) {
      this.statusEffects.handleUnitAttack(unit.id);
    }

    if (targetDestroyed) {
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
    knockBackDistance: number,
    knockBackSpeedRaw: number
  ): void {
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

    const speedMultiplier = this.statusEffects.getTargetSpeedMultiplier({
      type: "unit",
      id: unit.id,
    });
    const effectiveSpeedMultiplier = Math.max(speedMultiplier, 0);
    const effectiveKnockBackSpeed = Math.max(knockBackSpeed * effectiveSpeedMultiplier, 0);
    if (effectiveKnockBackSpeed <= 0) {
      return;
    }

    const minMultiplier = 0.1;
    const duration = 1 / Math.max(effectiveSpeedMultiplier, minMultiplier);
    const reduction = Math.max(unit.knockBackReduction, 1);
    const knockbackVelocity = scaleVector(axis, -effectiveKnockBackSpeed / reduction);
    this.movement.applyKnockback(unit.movementId, knockbackVelocity, duration);
  }

  private clampToMap(position: SceneVector2): SceneVector2 {
    const mapSize = this.scene.getMapSize();
    return {
      x: clampNumber(position.x, 0, mapSize.width),
      y: clampNumber(position.y, 0, mapSize.height),
    };
  }
}
