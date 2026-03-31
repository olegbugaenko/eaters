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
import { getEnemyConfig } from "../../../../../db/enemies-db";
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
  isPassableFor,
  type PassabilityTag,
} from "@/logic/shared/navigation/passability.types";
import { NavigationCoordinator } from "@/logic/shared/navigation/NavigationCoordinator";
import {
  ATTACK_DISTANCE_EPSILON,
  APPROACH_RAMP_DISTANCE,
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
import { ZERO_VECTOR } from "@shared/helpers/geometry.const";
import { applyDamagePipeline } from "@logic/helpers/damage-application";


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
  navigation: NavigationCoordinator;
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

interface EnemyFirstSearchState {
  candidateIds: string[];
  candidateSignature: string;
  cursor: number;
  completed: boolean;
  completedAtMs?: number;
  obstacleRevision: number;
  blockedEnemyId?: string;
  blockingBrickId?: string;
  blockingBrickObstacleRevision?: number;
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

const distanceSquared = (a: SceneVector2, b: SceneVector2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export class UnitRuntimeController {
  private static readonly PLAYER_UNIT_PASSABILITY: PassabilityTag = "playerUnit";
  private static readonly ENEMY_FIRST_SEARCH_MEMORY_KEY = "enemy-first-search";
  private static readonly ENEMY_FIRST_RESCAN_INTERVAL_MS = 500;
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
  private readonly navigation: NavigationCoordinator;
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
    this.navigation = options.navigation;
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

    this.navigation.cacheAllObstacles(UnitRuntimeController.PLAYER_UNIT_PASSABILITY);

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
      if (
        unit.targetingMode === "firstEnemy" &&
        target &&
        resolved?.type === "enemy"
      ) {
        this.updateNavigationState(unit, target, deltaSeconds);
      } else if (
        unit.targetingMode === "firstEnemy" &&
        target &&
        resolved?.type === "brick"
      ) {
        this.clearUnitNavigationPathState(unit.id);
      } else {
        this.clearUnitNavigationState(unit.id);
      }

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

      if (collidedBrickIds.length > 0 && unit.targetingMode !== "firstEnemy") {
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

      if (unit.targetingMode === "firstEnemy") {
        this.trackNavigationProgress(unit, deltaSeconds);
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

  public clearUnitNavigationState(unitId: string): void {
    this.navigation.clearActor(this.getNavigationActorId(unitId));
  }

  public clearUnitNavigationPathState(unitId: string): void {
    this.navigation.clearActorState(this.getNavigationActorId(unitId));
  }

  public clearAllNavigationState(): void {
    this.navigation.clearActorsByPrefix("player-unit:");
  }

  private resolveTarget(unit: PlayerUnitState): { target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" } | null {
    const mode = this.syncUnitTargetingMode(unit);
    if (mode === "none") {
      unit.targetBrickId = null;
      this.clearUnitNavigationState(unit.id);
      return null;
    }

    if (unit.targetBrickId) {
      // Перевіряємо чи це брік. Для `firstEnemy` brick fallback теж має бути "липким",
      // інакше юніт щотік скидає ціль, пересканує ворогів і застрягає в коливаннях.
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
      return this.findEnemyFirstTarget(unit);
    }
    return this.findTargetByCriterion(unit, mode);
  }

  private getNavigationActorId(unitId: string): string {
    return `player-unit:${unitId}`;
  }

  private getUnitNavigationTargetRadius(
    unit: PlayerUnitState,
    target: BrickRuntimeState | EnemyRuntimeState,
  ): number {
    return unit.baseAttackDistance + unit.physicalSize + target.physicalSize;
  }

  private findEnemyFirstTarget(
    unit: PlayerUnitState,
  ): { target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" } | null {
    const actorId = this.getNavigationActorId(unit.id);
    const enemyCandidates = this.findNearestEnemyCandidates(unit.position);
    if (enemyCandidates.length === 0) {
      this.navigation.clearActorMemory(
        actorId,
        UnitRuntimeController.ENEMY_FIRST_SEARCH_MEMORY_KEY,
      );
      return (
        this.findNearestTargetByType(unit.position, "brick") ??
        this.findNearestTarget(unit.position)
      );
    }

    const candidateSignature = enemyCandidates.map((enemy) => enemy.id).join("|");
    const obstacleRevision = this.bricks.getNavigationRevision();
    const existingSearchState =
      this.navigation.getActorMemory<EnemyFirstSearchState>(
        actorId,
        UnitRuntimeController.ENEMY_FIRST_SEARCH_MEMORY_KEY,
      );
    const enemyById = new Map(enemyCandidates.map((enemy) => [enemy.id, enemy]));
    const nearestEnemy = enemyCandidates[0] ?? null;

    // When obstacles changed and we know which enemy was blocked, do a focused
    // re-evaluation instead of re-scanning all candidates. A full re-scan can
    // find a technically reachable but impractical path through a narrow gap
    // left by one destroyed brick while other blockers remain, causing oscillation.
    if (
      existingSearchState &&
      existingSearchState.obstacleRevision !== obstacleRevision &&
      existingSearchState.blockedEnemyId
    ) {
      const currentCandidateIds = enemyCandidates.map((enemy) => enemy.id);
      const fastResult = this.reevaluateBlockedPath(
        unit,
        actorId,
        existingSearchState,
        obstacleRevision,
        enemyById,
        candidateSignature,
        currentCandidateIds,
      );
      if (fastResult) {
        return fastResult;
      }
    }

    const shouldReuseCompletedState =
      existingSearchState?.completed === true &&
      typeof existingSearchState.completedAtMs === "number" &&
      performance.now() - existingSearchState.completedAtMs <
        UnitRuntimeController.ENEMY_FIRST_RESCAN_INTERVAL_MS;
    let searchState =
      existingSearchState &&
      existingSearchState.candidateSignature === candidateSignature &&
      existingSearchState.obstacleRevision === obstacleRevision &&
      (existingSearchState.completed !== true || shouldReuseCompletedState)
        ? existingSearchState
        : {
            candidateIds: enemyCandidates.map((enemy) => enemy.id),
            candidateSignature,
            cursor: 0,
            completed: false,
            obstacleRevision,
            blockedEnemyId:
              existingSearchState?.blockedEnemyId &&
              enemyCandidates.some(
                (enemy) => enemy.id === existingSearchState.blockedEnemyId,
              )
                ? existingSearchState.blockedEnemyId
                : undefined,
            blockingBrickId:
              this.isBlockingBrickAlive(existingSearchState?.blockingBrickId)
                ? existingSearchState!.blockingBrickId
                : undefined,
            blockingBrickObstacleRevision:
              this.isBlockingBrickAlive(existingSearchState?.blockingBrickId)
                ? obstacleRevision
                : undefined,
          };

    while (searchState.cursor < searchState.candidateIds.length) {
      const enemyId = searchState.candidateIds[searchState.cursor]!;
      const enemy = enemyById.get(enemyId);
      if (!enemy) {
        searchState.cursor += 1;
        continue;
      }

      const path = this.navigation.probePath({
        start: unit.position,
        target: enemy.position,
        targetRadius: this.getUnitNavigationTargetRadius(unit, enemy),
        entityRadius: unit.physicalSize,
        passabilityTag: UnitRuntimeController.PLAYER_UNIT_PASSABILITY,
      });
      if (path === null) {
        searchState.cursor += 1;
        continue;
      }
      searchState.cursor += 1;
      if (path.goalReached || path.waypoints.length > 0) {
        const approachPoint = path.waypoints[path.waypoints.length - 1] ?? unit.position;
        if (
          this.hasBlockingBrickOnSegment(
            approachPoint,
            enemy.position,
            Math.max(unit.physicalSize * 0.6, 6),
          )
        ) {
          continue;
        }
        this.navigation.clearActorMemory(
          actorId,
          UnitRuntimeController.ENEMY_FIRST_SEARCH_MEMORY_KEY,
        );
        return { target: enemy, type: "enemy" };
      }
    }

    searchState = {
      ...searchState,
      cursor: searchState.candidateIds.length,
      completed: true,
      completedAtMs: performance.now(),
    };
    this.navigation.setActorMemory(
      actorId,
      UnitRuntimeController.ENEMY_FIRST_SEARCH_MEMORY_KEY,
      searchState,
    );

    return this.buildEnemyFirstFallbackTarget(
      unit,
      actorId,
      enemyById,
      nearestEnemy,
      searchState,
    );
  }

  private buildEnemyFirstFallbackTarget(
    unit: PlayerUnitState,
    actorId: string,
    enemyById: ReadonlyMap<string, EnemyRuntimeState>,
    nearestEnemy: EnemyRuntimeState | null,
    searchState: EnemyFirstSearchState,
  ): { target: BrickRuntimeState | EnemyRuntimeState; type: "brick" | "enemy" } | null {
    const blockedEnemy =
      (searchState.blockedEnemyId
        ? enemyById.get(searchState.blockedEnemyId) ?? null
        : null) ?? nearestEnemy;
    if (!blockedEnemy) {
      return null;
    }

    if (
      searchState.blockingBrickId &&
      searchState.blockingBrickObstacleRevision === searchState.obstacleRevision
    ) {
      const existingBlocker = this.getBrickTarget(searchState.blockingBrickId);
      if (existingBlocker && existingBlocker.hp > 0) {
        const nextState: EnemyFirstSearchState = {
          ...searchState,
          blockedEnemyId: blockedEnemy.id,
          blockingBrickId: existingBlocker.id,
          blockingBrickObstacleRevision: searchState.obstacleRevision,
        };
        this.navigation.setActorMemory(
          actorId,
          UnitRuntimeController.ENEMY_FIRST_SEARCH_MEMORY_KEY,
          nextState,
        );
        return { target: existingBlocker, type: "brick" };
      }
    }

    const distToEnemy = Math.hypot(
      blockedEnemy.position.x - unit.position.x,
      blockedEnemy.position.y - unit.position.y,
    );
    const blocker =
      this.findPrimaryBlockingBrickTowardsTarget(unit, blockedEnemy) ??
      this.findNearestImpassableBrick(
        unit,
        Math.max(unit.physicalSize * 8, distToEnemy * 0.5),
      );
    if (blocker) {
      const nextState: EnemyFirstSearchState = {
        ...searchState,
        blockedEnemyId: blockedEnemy.id,
        blockingBrickId: blocker.id,
        blockingBrickObstacleRevision: searchState.obstacleRevision,
      };
      this.navigation.setActorMemory(
        actorId,
        UnitRuntimeController.ENEMY_FIRST_SEARCH_MEMORY_KEY,
        nextState,
      );
      return { target: blocker, type: "brick" };
    }

    const nextState: EnemyFirstSearchState = {
      ...searchState,
      blockedEnemyId: blockedEnemy.id,
      blockingBrickId: undefined,
      blockingBrickObstacleRevision: undefined,
    };
    this.navigation.setActorMemory(
      actorId,
      UnitRuntimeController.ENEMY_FIRST_SEARCH_MEMORY_KEY,
      nextState,
    );
    return this.findNearestTargetByType(unit.position, "brick");
  }

  /**
   * When obstacles changed and we have a known blocked enemy, try to find the
   * next blocker without re-scanning all candidates. Never returns an enemy —
   * only a brick or null (fall through to the standard while-loop).
   */
  private reevaluateBlockedPath(
    unit: PlayerUnitState,
    actorId: string,
    previousState: EnemyFirstSearchState,
    obstacleRevision: number,
    enemyById: ReadonlyMap<string, EnemyRuntimeState>,
    candidateSignature: string,
    candidateIds: string[],
  ): { target: BrickRuntimeState; type: "brick" } | null {
    const blockedEnemy = previousState.blockedEnemyId
      ? enemyById.get(previousState.blockedEnemyId)
      : undefined;
    if (!blockedEnemy) {
      return null;
    }

    if (this.isBlockingBrickAlive(previousState.blockingBrickId)) {
      const existingBlocker = this.bricks.getBrickState(
        previousState.blockingBrickId!,
      )!;
      const nextState: EnemyFirstSearchState = {
        candidateIds,
        candidateSignature,
        cursor: candidateIds.length,
        completed: true,
        completedAtMs: performance.now(),
        obstacleRevision,
        blockedEnemyId: blockedEnemy.id,
        blockingBrickId: existingBlocker.id,
        blockingBrickObstacleRevision: obstacleRevision,
      };
      this.navigation.setActorMemory(
        actorId,
        UnitRuntimeController.ENEMY_FIRST_SEARCH_MEMORY_KEY,
        nextState,
      );
      return { target: existingBlocker, type: "brick" };
    }

    const distToEnemy = Math.hypot(
      blockedEnemy.position.x - unit.position.x,
      blockedEnemy.position.y - unit.position.y,
    );
    const nextBlocker =
      this.findPrimaryBlockingBrickTowardsTarget(unit, blockedEnemy) ??
      this.findNearestImpassableBrick(
        unit,
        Math.max(unit.physicalSize * 8, distToEnemy * 0.5),
      );
    if (nextBlocker) {
      const nextState: EnemyFirstSearchState = {
        candidateIds,
        candidateSignature,
        cursor: candidateIds.length,
        completed: true,
        completedAtMs: performance.now(),
        obstacleRevision,
        blockedEnemyId: blockedEnemy.id,
        blockingBrickId: nextBlocker.id,
        blockingBrickObstacleRevision: obstacleRevision,
      };
      this.navigation.setActorMemory(
        actorId,
        UnitRuntimeController.ENEMY_FIRST_SEARCH_MEMORY_KEY,
        nextState,
      );
      return { target: nextBlocker, type: "brick" };
    }

    return null;
  }

  private isBlockingBrickAlive(brickId: string | undefined): boolean {
    if (!brickId) return false;
    const brick = this.bricks.getBrickState(brickId);
    return Boolean(
      brick &&
        brick.hp > 0 &&
        !isPassableFor(brick, UnitRuntimeController.PLAYER_UNIT_PASSABILITY),
    );
  }

  private findNearestEnemyCandidates(
    position: SceneVector2,
  ): EnemyRuntimeState[] {
    if (!this.enemies) {
      return [];
    }
    const mapSize = this.scene.getMapSize();
    const maxRadius = Math.max(
      Math.hypot(mapSize.width, mapSize.height),
      TARGETING_RADIUS_STEP,
    );
    const targets = this.targeting.findTargetsNear(position, maxRadius, {
      types: ["enemy"],
    });
    return targets
      .filter((target): target is TargetSnapshot<"enemy", EnemyRuntimeState> =>
        isTargetOfType<"enemy", EnemyRuntimeState>(target, "enemy"),
      )
      .map((target) => target.data ?? this.enemies!.getEnemyState(target.id))
      .filter((enemy): enemy is EnemyRuntimeState => Boolean(enemy && enemy.hp > 0))
      .sort((a, b) => {
        const aDistance = distanceSquared(a.position, position);
        const bDistance = distanceSquared(b.position, position);
        return aDistance - bDistance;
      });
  }

  private findPrimaryBlockingBrickTowardsTarget(
    unit: PlayerUnitState,
    target: EnemyRuntimeState,
  ): BrickRuntimeState | null {
    const corridorRadius = Math.max(
      Math.hypot(target.position.x - unit.position.x, target.position.y - unit.position.y) *
        0.5 +
        unit.physicalSize * 2,
      unit.physicalSize * 4,
    );
    const corridorCenter = {
      x: (unit.position.x + target.position.x) * 0.5,
      y: (unit.position.y + target.position.y) * 0.5,
    };
    const candidates = this.bricks.findBricksNear(corridorCenter, corridorRadius);
    let best: BrickRuntimeState | null = null;
    let bestDistanceSq = Number.POSITIVE_INFINITY;

    candidates.forEach((brick) => {
      if (
        isPassableFor(brick, UnitRuntimeController.PLAYER_UNIT_PASSABILITY) ||
        !this.segmentIntersectsBrick(unit.position, target.position, brick, unit.physicalSize)
      ) {
        return;
      }
      const candidateDistanceSq = distanceSquared(unit.position, brick.position);
      const distanceImproved =
        candidateDistanceSq + TARGETING_SCORE_EPSILON < bestDistanceSq;
      if (!best || distanceImproved) {
        best = brick;
        bestDistanceSq = candidateDistanceSq;
      }
    });

    return best;
  }

  private findNearestImpassableBrick(
    unit: PlayerUnitState,
    maxSearchRadius?: number,
  ): BrickRuntimeState | null {
    const searchRadius = maxSearchRadius ?? unit.physicalSize * 8;
    let bestId: string | null = null;
    let bestDistanceSq = Number.POSITIVE_INFINITY;
    this.bricks.forEachBrickNear(unit.position, searchRadius, (brick) => {
      if (isPassableFor(brick, UnitRuntimeController.PLAYER_UNIT_PASSABILITY)) {
        return;
      }
      const candidateDistanceSq = distanceSquared(unit.position, brick.position);
      if (candidateDistanceSq < bestDistanceSq) {
        bestDistanceSq = candidateDistanceSq;
        bestId = brick.id;
      }
    });
    return bestId ? this.bricks.getBrickState(bestId) : null;
  }

  private segmentIntersectsBrick(
    start: SceneVector2,
    end: SceneVector2,
    brick: BrickRuntimeState,
    clearance: number,
  ): boolean {
    const segment = subtractVectors(end, start);
    const lengthSq = segment.x * segment.x + segment.y * segment.y;
    if (lengthSq <= 0) {
      return false;
    }
    const toBrick = subtractVectors(brick.position, start);
    const t = clampNumber(
      (toBrick.x * segment.x + toBrick.y * segment.y) / lengthSq,
      0,
      1,
    );
    const closestPoint = {
      x: start.x + segment.x * t,
      y: start.y + segment.y * t,
    };
    const combinedRadius = Math.max(brick.physicalSize + clearance, 0);
    return (
      distanceSquared(closestPoint, brick.position) <=
      combinedRadius * combinedRadius
    );
  }

  private hasBlockingBrickOnSegment(
    start: SceneVector2,
    end: SceneVector2,
    clearance: number,
  ): boolean {
    const corridorCenter = {
      x: (start.x + end.x) * 0.5,
      y: (start.y + end.y) * 0.5,
    };
    const corridorRadius = Math.max(
      Math.hypot(end.x - start.x, end.y - start.y) * 0.55 + clearance * 2,
      clearance * 2,
    );
    const candidates = this.bricks.findBricksNear(corridorCenter, corridorRadius);
    for (const brick of candidates) {
      if (isPassableFor(brick, UnitRuntimeController.PLAYER_UNIT_PASSABILITY)) {
        continue;
      }
      if (this.segmentIntersectsBrick(start, end, brick, clearance)) {
        return true;
      }
    }
    return false;
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

  private updateNavigationState(
    unit: PlayerUnitState,
    target: BrickRuntimeState | EnemyRuntimeState,
    deltaSeconds: number,
  ): void {
    this.navigation.planNavigation({
      actorId: this.getNavigationActorId(unit.id),
      actorPosition: unit.position,
      target,
      targetRadius: this.getUnitNavigationTargetRadius(unit, target),
      entityRadius: unit.physicalSize,
      passabilityTag: UnitRuntimeController.PLAYER_UNIT_PASSABILITY,
      deltaSeconds,
      goalCooldownSeconds: 0.2,
      getRepathCooldown: ({ distanceToTarget, path }) => {
        if (path.goalReached) {
          return 0.2;
        }
        if (distanceToTarget > 280) {
          return 0.8;
        }
        if (distanceToTarget > 140) {
          return 0.45;
        }
        return 0.25;
      },
    });
  }

  private trackNavigationProgress(
    unit: PlayerUnitState,
    deltaSeconds: number,
  ): void {
    this.navigation.trackProgress(
      this.getNavigationActorId(unit.id),
      unit.position,
      deltaSeconds,
      { stuckTimeout: 0.6 },
    );
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

    const destination =
      unit.targetingMode === "firstEnemy"
        ? this.navigation.getDestination(
            this.getNavigationActorId(unit.id),
            target.position,
          )
        : target.position;
    const toTarget = subtractVectors(target.position, unit.position);
    const toDestination = subtractVectors(destination, unit.position);
    const distance = vectorLength(toTarget);
    const attackRange = unit.baseAttackDistance + unit.physicalSize + target.physicalSize;
    const distanceOutsideRange = Math.max(distance - attackRange, 0);

    if (distanceOutsideRange <= 0) {
      return this.computeBrakingForce(unit, movementState);
    }

    const destinationDistance = vectorLength(toDestination);
    const direction =
      destinationDistance > 0
        ? scaleVector(toDestination, 1 / destinationDistance)
        : ZERO_VECTOR;
    if (!vectorHasLength(direction)) {
      return ZERO_VECTOR;
    }

    const moveSpeed = this.getEffectiveMoveSpeed(unit);
    // Гальмуємо тільки в останніх APPROACH_RAMP_DISTANCE одиницях, щоб не створювати відчуття "приторможує заздалегідь"
    const desiredSpeed =
      distanceOutsideRange >= APPROACH_RAMP_DISTANCE
        ? moveSpeed
        : moveSpeed *
          (0.25 + 0.75 * (distanceOutsideRange / APPROACH_RAMP_DISTANCE));
    let desiredVelocity = scaleVector(direction, desiredSpeed);

    // Додаємо obstacle avoidance щоб не налазити на цеглу
    const avoidance = this.computeObstacleAvoidance(unit, desiredVelocity, target);
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
    desiredVelocity: SceneVector2,
    target: BrickRuntimeState | EnemyRuntimeState | null,
  ): SceneVector2 {
    if (!vectorHasLength(desiredVelocity)) {
      return ZERO_VECTOR;
    }

    const avoidanceRadius = unit.physicalSize * 3;
    let avoidanceVector = { ...ZERO_VECTOR };

    this.forEachBrickNear(unit.position, avoidanceRadius, (brick) => {
      // Перевіряємо чи цегла прохідна для юніта
      if (isPassableFor(brick, UnitRuntimeController.PLAYER_UNIT_PASSABILITY)) {
        return;
      }
      if (target && "maxHp" in brick && target.id === brick.id) {
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

  private getEffectiveMoveAcceleration(unit: PlayerUnitState): number {
    const multiplier = this.statusEffects.getTargetSpeedMultiplier({
      type: "unit",
      id: unit.id,
    });
    return Math.max(unit.moveAcceleration * Math.max(multiplier, 0), 0);
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
        if (isPassableFor(brick, UnitRuntimeController.PLAYER_UNIT_PASSABILITY)) {
          return;
        }
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

      this.enemies?.forEachBlockingCollider(
        resolvedPosition,
        unit.physicalSize,
        (collider) => {
          const combinedRadius = unit.physicalSize + collider.physicalSize;
          if (combinedRadius <= 0) return;

          const offset = subtractVectors(resolvedPosition, collider.position);
          const distance = vectorLength(offset);
          if (!Number.isFinite(distance) || distance >= combinedRadius) return;

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
        },
      );

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
    const maxForce = Math.max(this.getEffectiveMoveAcceleration(unit) * unit.mass, 0);
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
    let attackTarget: BrickRuntimeState | EnemyRuntimeState = target;
    let attackDirection = direction;
    let attackDistance = distance;
    if (targetType === "brick") {
      const liveBrick = this.bricks.getBrickState(target.id);
      if (!liveBrick || liveBrick.hp <= 0) {
        unit.targetBrickId = null;
        return false;
      }
      attackTarget = liveBrick;
      attackDirection = subtractVectors(liveBrick.position, unit.position);
      attackDistance = Math.hypot(attackDirection.x, attackDirection.y);
    }

    let hpChanged = false;
    unit.attackCooldown = unit.baseAttackInterval;
    unit.timeSinceLastAttack = 0;
    const { damage, isCritical } = this.getAttackOutcome(unit);
    const bonusDamage = this.abilities.consumeAttackBonuses(unit as any);
    const totalDamage = Math.max(damage + bonusDamage, 0);
    
    let inflictedDamage = 0;
    let surviving: BrickRuntimeState | EnemyRuntimeState | null = null;
    let targetDestroyed = false;
    
    if (targetType === "brick" && this.damage) {
      inflictedDamage = this.damage.applyTargetDamage(attackTarget.id, totalDamage, {
        direction: attackDirection,
        rewardMultiplier: unit.rewardMultiplier,
        armorPenetration: unit.armorPenetration,
        isCritical,
      });
      const updatedBrick = this.bricks.getBrickState(attackTarget.id);
      surviving = updatedBrick ?? null;
      targetDestroyed = !updatedBrick;
      hpChanged = inflictedDamage > 0;
    } else if (targetType === "enemy" && this.damage && this.enemies) {
      const targetSnapshot = this.targeting.getTargetById(target.id, { types: ["enemy"] });
      if (targetSnapshot && isTargetOfType<"enemy", EnemyRuntimeState>(targetSnapshot, "enemy")) {
        inflictedDamage = this.damage.applyTargetDamage(target.id, totalDamage, {
          armorPenetration: unit.armorPenetration,
          direction,
          rewardMultiplier: unit.rewardMultiplier,
          isCritical,
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
      const effectPosition = surviving?.position ?? attackTarget.position;
      this.spawnCriticalHitEffect(effectPosition);
    }

    const effectOrigin = surviving?.position ?? attackTarget.position;
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
      targetType,
      attackTarget.id,
      effectOrigin,
    );

    if (totalDamage > 0 && unit.damageTransferPercent > 0 && this.damage) {
      const splashDamage = totalDamage * unit.damageTransferPercent;
      if (splashDamage > 0) {
        this.forEachBrickNear(attackTarget.position, unit.damageTransferRadius, (brick) => {
          if (brick.id === attackTarget.id) {
            return;
          }
          this.damage!.applyTargetDamage(brick.id, splashDamage, {
            direction: attackDirection,
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
      attackDirection,
      attackDistance,
      knockBackDistance,
      knockBackSpeed
    );
    
    // Counter damage for bricks
    if (targetType === "brick") {
      const counterSource = surviving ?? target;
      const outgoingMultiplier = this.bricks.getOutgoingDamageMultiplier(counterSource.id);
      const flatReduction = this.bricks.getOutgoingDamageFlatReduction(counterSource.id);
      const rawCounterDamage = Math.max(counterSource.baseDamage * outgoingMultiplier - flatReduction, 0);
      
      if (rawCounterDamage > 0) {
        const armorDelta = this.statusEffects.getTargetArmorDelta({ type: "unit", id: unit.id });
        const { inflictedDamage, nextHp } = applyDamagePipeline(
          {
            rawDamage: rawCounterDamage,
            armor: unit.armor,
            armorDelta,
            armorPenetration: 0,
            currentHp: unit.hp,
            maxHp: unit.maxHp,
          },
          { skipKnockback: true },
          {
            onInflicted: (amount) => {
              this.statistics?.recordDamageTaken(amount);
              this.statusEffects.handleTargetHit({ type: "unit", id: unit.id });
            },
          },
        );
        if (inflictedDamage > 0) {
          unit.hp = nextHp;
          hpChanged = true;
          this.damage?.queueUnitDamageText(unit.position, inflictedDamage);
        }
      }
    }

    // Counter damage for enemies with contactDamage (same principle as bricks)
    if (targetType === "enemy") {
      const counterSource = (surviving ?? target) as EnemyRuntimeState;
      const enemyConfig = getEnemyConfig(counterSource.type);

      if (enemyConfig.contactDamage && counterSource.baseDamage > 0) {
        const armorDelta = this.statusEffects.getTargetArmorDelta({ type: "unit", id: unit.id });
        const { inflictedDamage: counterInflicted, nextHp } = applyDamagePipeline(
          {
            rawDamage: counterSource.baseDamage,
            armor: unit.armor,
            armorDelta,
            armorPenetration: 0,
            currentHp: unit.hp,
            maxHp: unit.maxHp,
          },
          { skipKnockback: true },
          {
            onInflicted: (amount) => {
              this.statistics?.recordDamageTaken(amount);
              this.statusEffects.handleTargetHit({ type: "unit", id: unit.id });
            },
          },
        );
        if (counterInflicted > 0) {
          unit.hp = nextHp;
          hpChanged = true;
          this.damage?.queueUnitDamageText(unit.position, counterInflicted);
        }

        if (enemyConfig.meleeHitExplosion) {
          this.explosions.spawnExplosionByType(
            enemyConfig.meleeHitExplosion.type,
            {
              position: { ...unit.position },
              initialRadius: enemyConfig.meleeHitExplosion.radius ?? Math.max(8, counterSource.physicalSize),
            },
          );
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

    // Явно задана швидкість використовується як є; інакше — мінімум із distance*2 для розумної тривалості
    const knockBackSpeed =
      knockBackSpeedRaw > 0
        ? knockBackSpeedRaw
        : Math.max(0, knockBackDistance * 2);
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
