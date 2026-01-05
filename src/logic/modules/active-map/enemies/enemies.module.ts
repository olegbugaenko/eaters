import { DataBridgeHelpers } from "../../../core/DataBridgeHelpers";
import type { DataBridge } from "../../../core/DataBridge";
import { GameModule } from "../../../core/types";
import type { SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";
import { clampNumber } from "@shared/helpers/numbers.helper";
import { cloneResourceStockpile, normalizeResourceAmount } from "../../../../db/resources-db";
import { SpatialGrid } from "../../../utils/SpatialGrid";
import { MapRunState } from "../map/MapRunState";
import type { TargetingService } from "../targeting/TargetingService";
import { DamageService } from "../targeting/DamageService";
import { MovementService } from "../../../services/movement/MovementService";
import { EnemyStateFactory, EnemyStateInput } from "./enemies.state-factory";
import {
  subtractVectors,
  scaleVector,
  vectorLength,
  vectorHasLength,
  addVectors,
} from "../../../../shared/helpers/vector.helper";
import { ZERO_VECTOR } from "../../../../shared/helpers/geometry.const";
import {
  ENEMY_COUNT_BRIDGE_KEY,
  ENEMY_SCENE_OBJECT_TYPE,
  ENEMY_SPATIAL_GRID_CELL_SIZE,
  ENEMY_TOTAL_HP_BRIDGE_KEY,
} from "./enemies.const";
import type { EnemiesModuleOptions, EnemyRuntimeState, EnemySaveData, EnemySpawnData, InternalEnemyState } from "./enemies.types";
import { EnemyTargetingProvider } from "./enemies.targeting-provider";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import { getEnemyConfig } from "../../../../db/enemies-db";
import { normalizeVector } from "../../../../shared/helpers/vector.helper";
import type { UnitProjectileHitContext } from "../projectiles/projectiles.types";
import type { UnitProjectileController } from "../projectiles/ProjectileController";
import { isPassableFor, type PassabilityTag } from "@/logic/shared/navigation/passability.types";
import type { ObstacleDescriptor, ObstacleProvider } from "@/logic/shared/navigation/navigation.types";
import { PathfindingService } from "@/logic/shared/navigation/PathfindingService";
import { BrickObstacleProvider } from "./brick-obstacle-provider";

const ENEMY_PASSABILITY: PassabilityTag = "enemy";
const distanceSquared = (a: SceneVector2, b: SceneVector2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

interface EnemyNavigationState {
  targetId: string;
  targetPosition: SceneVector2;
  targetRadius: number;
  waypoints: SceneVector2[];
  goalReached: boolean;
  repathCooldown: number;
  lastPosition: SceneVector2;
  stuckTimer: number;
}

export class EnemiesModule implements GameModule {
  public readonly id = "enemies";

  private readonly scene: EnemiesModuleOptions["scene"];
  private readonly bridge: DataBridge;
  private readonly runState: MapRunState;
  private readonly movement: MovementService;
  private readonly targeting?: TargetingService;
  private readonly damage?: DamageService;
  private readonly explosions?: ExplosionModule;
  private readonly projectiles?: UnitProjectileController;
  private readonly obstacles: ObstacleProvider;
  private readonly pathfinder: PathfindingService;
  private readonly navigationCellSize: number;
  private readonly navigationState = new Map<string, EnemyNavigationState>();
  private readonly stateFactory: EnemyStateFactory;
  private readonly spatialIndex = new SpatialGrid<InternalEnemyState>(ENEMY_SPATIAL_GRID_CELL_SIZE);

  private enemies = new Map<string, InternalEnemyState>();
  private enemyOrder: InternalEnemyState[] = [];
  private enemyIdCounter = 0;
  private totalHpCached = 0;
  private lastPushedCount = -1;
  private lastPushedTotalHp = -1;

  constructor(options: EnemiesModuleOptions) {
    this.scene = options.scene;
    this.bridge = options.bridge;
    this.runState = options.runState;
    this.movement = options.movement;
    this.targeting = options.targeting;
    this.damage = options.damage;
    this.explosions = options.explosions;
    this.projectiles = options.projectiles;
    this.obstacles = options.obstacles ?? new BrickObstacleProvider(options.bricks);
    this.pathfinder =
      options.pathfinder ??
      new PathfindingService({
        obstacles: this.obstacles,
        getMapSize: () => this.scene.getMapSize(),
      });
    this.navigationCellSize = this.pathfinder.getCellSize();
    this.stateFactory = new EnemyStateFactory({ scene: this.scene, movement: this.movement });

    if (this.targeting) {
      this.targeting.registerProvider(new EnemyTargetingProvider(this));
    }
  }

  public initialize(): void {
    this.pushStats();
  }

  public reset(): void {
    this.setEnemies([]);
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed?.enemies) {
      this.applyEnemies(parsed.enemies);
      return;
    }
    this.pushStats();
  }

  public save(): unknown {
    return null;
  }

  public tick(deltaMs: number): void {
    if (!this.runState.shouldProcessTick()) {
      return;
    }
    if (deltaMs <= 0) {
      return;
    }

    const deltaSeconds = deltaMs / 1000;
    let anyChanged = false;

    const activeTargets = new Map<string, { id: string; position: SceneVector2; physicalSize: number } | null>();

    // Phase 1: Compute movement forces towards targets
    this.enemyOrder.forEach((enemy) => {
      const target = this.targeting?.findNearestTarget(enemy.position, { types: ["unit"] }) ?? null;
      activeTargets.set(enemy.id, target);
      this.updateNavigationState(enemy, target, deltaSeconds);
      const force = this.computeMovementForce(enemy, target);
      this.movement.setForce(enemy.movementId, force);
    });

    // Update movement physics
    this.movement.update(deltaSeconds);

    // Phase 2: Update positions, rotations, and handle attacks
    this.enemyOrder.forEach((enemy) => {
      const movementState = this.movement.getBodyState(enemy.movementId);
      if (!movementState) {
        return;
      }

      // Update position
      const newPosition = this.clampToMap(movementState.position);
      if (newPosition.x !== enemy.position.x || newPosition.y !== enemy.position.y) {
        enemy.position = newPosition;
        this.spatialIndex.set(enemy.id, enemy.position, enemy.physicalSize, enemy);
        anyChanged = true;
      }

      // Update rotation towards target
      const target = activeTargets.get(enemy.id);
      if (target) {
        const direction = subtractVectors(target.position, enemy.position);
        const distance = vectorLength(direction);
        if (distance > 0) {
          enemy.rotation = Math.atan2(direction.y, direction.x);
          anyChanged = true;
        }
      }

      // Update scene object position and rotation
      this.scene.updateObject(enemy.sceneObjectId, {
        position: { ...enemy.position },
        rotation: enemy.rotation,
      });

      // Handle attack cooldown
      if (enemy.attackCooldown > 0) {
        const next = Math.max(enemy.attackCooldown - deltaSeconds, 0);
        if (next !== enemy.attackCooldown) {
          enemy.attackCooldown = next;
          anyChanged = true;
        }
      }

      // Try to attack
      if (enemy.attackCooldown <= 0 && this.tryAttack(enemy, target ?? null)) {
        enemy.attackCooldown = enemy.attackInterval;
        anyChanged = true;
      }

      this.trackNavigationProgress(enemy, deltaSeconds);
    });

    if (anyChanged) {
      this.pushStats();
    }
  }

  public setEnemies(enemies: EnemySpawnData[]): void {
    this.applyEnemies(enemies);
  }

  public spawnEnemy(data: EnemySpawnData): void {
    const input: EnemyStateInput = {
      enemy: data,
      enemyId: this.createEnemyId(data.id),
      clampToMap: (position: EnemySpawnData["position"]) => this.clampToMap(position),
    };
    const state = this.stateFactory.createWithTransform(input);
    // Ensure movement body position matches enemy position
    this.movement.setBodyPosition(state.movementId, state.position);
    this.enemies.set(state.id, state);
    this.enemyOrder.push(state);
    this.spatialIndex.set(state.id, state.position, state.physicalSize, state);
    this.totalHpCached += state.hp;
    this.pushStats();
  }

  public getEnemies(): EnemyRuntimeState[] {
    return this.enemyOrder.map((enemy) => this.cloneState(enemy));
  }

  public getEnemyState(id: string): EnemyRuntimeState | null {
    const enemy = this.enemies.get(id);
    return enemy ? this.cloneState(enemy) : null;
  }

  public findNearestEnemy(position: SceneVector2): EnemyRuntimeState | null {
    const nearest = this.spatialIndex.queryNearest(position, { maxLayers: 128 });
    return nearest ? this.cloneState(nearest) : null;
  }

  public findEnemiesNear(position: SceneVector2, radius: number): EnemyRuntimeState[] {
    if (radius < 0) {
      return [];
    }
    return this.spatialIndex
      .queryCircle(position, radius)
      .map((enemy) => this.cloneState(enemy));
  }

  public forEachEnemyNear(
    position: SceneVector2,
    radius: number,
    visitor: (enemy: EnemyRuntimeState) => void,
  ): void {
    if (radius < 0) {
      return;
    }
    this.spatialIndex.forEachInCircle(position, radius, (enemy) => visitor(this.cloneState(enemy)));
  }

  public applyDamage(enemyId: string, damage: number, options?: { armorPenetration?: number }): number {
    if (damage <= 0) {
      return 0;
    }
    const enemy = this.enemies.get(enemyId);
    if (!enemy) {
      return 0;
    }
    const armorPenetration = clampNumber(options?.armorPenetration ?? 0, 0, Number.POSITIVE_INFINITY);
    const effectiveArmor = Math.max(enemy.armor - armorPenetration, 0);
    const appliedDamage = Math.max(damage - effectiveArmor, 0);
    if (appliedDamage <= 0) {
      return 0;
    }

    const remainingHp = Math.max(enemy.hp - appliedDamage, 0);
    const dealt = enemy.hp - remainingHp;
    enemy.hp = remainingHp;
    this.totalHpCached = Math.max(0, this.totalHpCached - dealt);

    if (enemy.hp <= 0) {
      this.destroyEnemy(enemy);
    }

    this.pushStats();
    return dealt;
  }

  private applyEnemies(enemies: EnemySpawnData[]): void {
    this.clearSceneObjects();
    this.enemyIdCounter = 0;
    this.totalHpCached = 0;
    this.lastPushedCount = -1;
    this.lastPushedTotalHp = -1;

    enemies.forEach((enemy) => {
      const input: EnemyStateInput = {
        enemy,
        enemyId: this.createEnemyId(enemy.id),
        clampToMap: (position: EnemySpawnData["position"]) => this.clampToMap(position),
      };
      const state = this.stateFactory.createWithTransform(input);
      this.enemies.set(state.id, state);
      this.enemyOrder.push(state);
      this.spatialIndex.set(state.id, state.position, state.physicalSize, state);
      this.totalHpCached += state.hp;
    });

    this.pushStats();
  }

  private createEnemyId(preferred: string | undefined): string {
    if (preferred && !this.enemies.has(preferred)) {
      return preferred;
    }
    this.enemyIdCounter += 1;
    return `${ENEMY_SCENE_OBJECT_TYPE}-${this.enemyIdCounter}`;
  }

  private destroyEnemy(enemy: InternalEnemyState): void {
    this.scene.removeObject(enemy.sceneObjectId);
    this.movement.removeBody(enemy.movementId);
    this.enemies.delete(enemy.id);
    this.enemyOrder = this.enemyOrder.filter((item) => item.id !== enemy.id);
    this.spatialIndex.delete(enemy.id);
    this.navigationState.delete(enemy.id);
  }

  private tryAttack(
    enemy: InternalEnemyState,
    target: { id: string; position: SceneVector2; physicalSize: number } | null,
  ): boolean {
    if (!this.targeting || !target) {
      return false;
    }

    const toTarget = subtractVectors(target.position, enemy.position);
    const distance = vectorLength(toTarget);
    const attackRange = enemy.attackRange + enemy.physicalSize + target.physicalSize;
    
    if (distance > attackRange) {
      return false;
    }

    const config = getEnemyConfig(enemy.type);

    // Якщо є конфіг снаряда - створюємо снаряд
    if (config.projectile && this.projectiles) {
      const direction = normalizeVector(toTarget) || { x: 1, y: 0 };
      const origin = { ...enemy.position };

      this.projectiles.spawn({
        origin,
        direction,
        damage: enemy.baseDamage,
        rewardMultiplier: 1, // Вороги не дають нагороди за атаку
        armorPenetration: 0,
        targetTypes: ["unit"], // Вороги атакують тільки юнітів
        visual: config.projectile,
        onHit: (hitContext: UnitProjectileHitContext) => {
          if (hitContext.targetType === "unit" && this.damage) {
            this.damage.applyTargetDamage(hitContext.targetId, enemy.baseDamage, {
              armorPenetration: 0,
            });

            if (this.explosions) {
              this.explosions.spawnExplosionByType("plasmoid", {
                position: { ...hitContext.position },
                initialRadius: Math.max(8, enemy.physicalSize),
              });
            }
          }
          return true; // Снаряд зникає після влучання
        },
      });

      return true;
    }

    // Якщо немає конфігу снаряда - instant damage
    if (this.damage) {
      this.damage.applyTargetDamage(target.id, enemy.baseDamage, {
        armorPenetration: 0,
      });

      if (this.explosions) {
        this.explosions.spawnExplosionByType("plasmoid", {
          position: { ...target.position },
          initialRadius: Math.max(8, enemy.physicalSize),
        });
      }
    }

    return true;
  }

  private clearSceneObjects(): void {
    this.enemyOrder.forEach((enemy) => {
      this.scene.removeObject(enemy.sceneObjectId);
      this.movement.removeBody(enemy.movementId);
    });
    this.enemies.clear();
    this.enemyOrder = [];
    this.spatialIndex.clear();
    this.navigationState.clear();
  }

  private updateNavigationState(
    enemy: InternalEnemyState,
    target: { id: string; position: SceneVector2; physicalSize: number } | null,
    deltaSeconds: number,
  ): void {
    if (!target) {
      this.navigationState.delete(enemy.id);
      return;
    }

    const targetRadius = enemy.attackRange + enemy.physicalSize + target.physicalSize;
    const existing = this.navigationState.get(enemy.id);
    const distanceToTargetSq = distanceSquared(enemy.position, target.position);
    const targetMoved = existing
      ? distanceSquared(existing.targetPosition, target.position) > this.navigationCellSize * this.navigationCellSize * 0.5
      : true;

    if (distanceToTargetSq <= targetRadius * targetRadius) {
      this.navigationState.set(enemy.id, {
        targetId: target.id,
        targetPosition: { ...target.position },
        targetRadius,
        waypoints: [],
        goalReached: true,
        repathCooldown: 0.2,
        lastPosition: { ...enemy.position },
        stuckTimer: 0,
      });
      return;
    }

    const repathCooldown = Math.max((existing?.repathCooldown ?? 0) - deltaSeconds, 0);
    const needsPath =
      !existing ||
      existing.targetId !== target.id ||
      existing.goalReached ||
      existing.waypoints.length === 0 ||
      repathCooldown <= 0 ||
      targetMoved;

    if (!needsPath && existing) {
      existing.targetRadius = targetRadius;
      existing.targetPosition = { ...target.position };
      existing.repathCooldown = repathCooldown;
      this.navigationState.set(enemy.id, existing);
      return;
    }

    const path = this.pathfinder.findPathToTarget({
      start: enemy.position,
      target: target.position,
      targetRadius,
      entityRadius: enemy.physicalSize,
      passabilityTag: ENEMY_PASSABILITY,
    });

    this.navigationState.set(enemy.id, {
      targetId: target.id,
      targetPosition: { ...target.position },
      targetRadius,
      waypoints: path.waypoints.map((point) => ({ ...point })),
      goalReached: path.goalReached,
      repathCooldown: path.goalReached ? 0.2 : 0.35,
      lastPosition: { ...enemy.position },
      stuckTimer: 0,
    });
  }

  private consumeWaypoints(
    enemy: InternalEnemyState,
    navigation: EnemyNavigationState | undefined,
    target: { position: SceneVector2 } | null,
  ): void {
    if (!navigation) {
      return;
    }
    const threshold = Math.max(enemy.physicalSize * 0.5, this.navigationCellSize * 0.5);
    const thresholdSq = threshold * threshold;

    while (navigation.waypoints.length > 0) {
      const waypoint = navigation.waypoints[0]!;
      if (distanceSquared(enemy.position, waypoint) > thresholdSq) {
        break;
      }
      navigation.waypoints.shift();
    }

    if (navigation.waypoints.length === 0) {
      navigation.goalReached = target
        ? distanceSquared(enemy.position, target.position) <= navigation.targetRadius * navigation.targetRadius
        : navigation.goalReached;
    }
  }

  private trackNavigationProgress(enemy: InternalEnemyState, deltaSeconds: number): void {
    const navigation = this.navigationState.get(enemy.id);
    if (!navigation) {
      return;
    }

    const movedSq = distanceSquared(enemy.position, navigation.lastPosition);
    if (movedSq < 1) {
      navigation.stuckTimer += deltaSeconds;
      if (navigation.stuckTimer > 0.6) {
        navigation.repathCooldown = 0;
        navigation.waypoints = [];
        navigation.goalReached = false;
      }
      return;
    }

    navigation.stuckTimer = 0;
    navigation.lastPosition = { ...enemy.position };
  }

  /**
   * Computes movement force towards target
   */
  private computeMovementForce(
    enemy: InternalEnemyState,
    target: { position: SceneVector2; physicalSize: number } | null
  ): SceneVector2 {
    const movementState = this.movement.getBodyState(enemy.movementId);
    if (!movementState) {
      return ZERO_VECTOR;
    }

    if (!target) {
      // No target - brake
      return this.computeBrakingForce(enemy, movementState);
    }

    const navigation = this.navigationState.get(enemy.id);
    this.consumeWaypoints(enemy, navigation, target);

    const destination = navigation?.waypoints[0] ?? target.position;
    const toDestination = subtractVectors(destination, enemy.position);
    const distanceToDestination = vectorLength(toDestination);
    const toTarget = subtractVectors(target.position, enemy.position);
    const distance = vectorLength(toTarget);
    const attackRange = enemy.attackRange + enemy.physicalSize + target.physicalSize;
    const distanceOutsideRange = Math.max(distance - attackRange, 0);

    // If within attack range, brake
    if (distanceOutsideRange <= 0 || navigation?.goalReached) {
      return this.computeBrakingForce(enemy, movementState);
    }

    // Move towards target
    const direction = distanceToDestination > 0 ? scaleVector(toDestination, 1 / distanceToDestination) : ZERO_VECTOR;
    if (!vectorHasLength(direction)) {
      return ZERO_VECTOR;
    }

    // Desired speed - slow down as we approach
    const approachDistance = Math.min(distanceOutsideRange, distanceToDestination);
    const desiredSpeed = Math.max(Math.min(enemy.moveSpeed, approachDistance), enemy.moveSpeed * 0.25);
    let desiredVelocity = scaleVector(direction, desiredSpeed);

    const avoidance = this.computeObstacleAvoidance(enemy, desiredVelocity);
    if (vectorHasLength(avoidance)) {
      desiredVelocity = addVectors(desiredVelocity, avoidance);
    }

    // Steering force (similar to player units)
    return this.computeSteeringForce(enemy, movementState.velocity, desiredVelocity);
  }

  private computeObstacleAvoidance(
    enemy: InternalEnemyState,
    desiredVelocity: SceneVector2
  ): SceneVector2 {
    if (!vectorHasLength(desiredVelocity)) {
      return ZERO_VECTOR;
    }

    const avoidanceRadius = enemy.physicalSize * 3;
    const entityTag = ENEMY_PASSABILITY;
    let avoidanceVector = { ...ZERO_VECTOR };

    this.obstacles.forEachObstacleNear(enemy.position, avoidanceRadius, (obstacle: ObstacleDescriptor) => {
      if (isPassableFor(obstacle, entityTag)) {
        return;
      }

      const toObstacle = subtractVectors(obstacle.position, enemy.position);
      const distance = vectorLength(toObstacle);
      const combinedRadius = obstacle.radius + enemy.physicalSize;
      const normalizedToObstacle = normalizeVector(toObstacle);
      if (!normalizedToObstacle) {
        return;
      }
      const isAhead = normalizedToObstacle.x * desiredVelocity.x + normalizedToObstacle.y * desiredVelocity.y > 0;
      if (distance <= 0 || distance > avoidanceRadius || !isAhead) {
        return;
      }

      const overlap = combinedRadius + 4 - distance;
      if (overlap <= 0) {
        return;
      }

      const pushDirection = scaleVector(toObstacle, -1 / Math.max(distance, 1));
      const strength = overlap / Math.max(combinedRadius, 1);
      avoidanceVector = addVectors(avoidanceVector, scaleVector(pushDirection, strength));
    });

    const length = vectorLength(avoidanceVector);
    if (length <= 0) {
      return ZERO_VECTOR;
    }

    const maxAvoidance = enemy.moveSpeed;
    return scaleVector(avoidanceVector, maxAvoidance / length);
  }

  /**
   * Computes steering force to reach desired velocity
   */
  private computeSteeringForce(
    enemy: InternalEnemyState,
    currentVelocity: SceneVector2,
    desiredVelocity: SceneVector2
  ): SceneVector2 {
    const velocityDiff = subtractVectors(desiredVelocity, currentVelocity);
    const diffLength = vectorLength(velocityDiff);
    if (diffLength <= 0) {
      return ZERO_VECTOR;
    }

    // Acceleration factor based on moveSpeed
    const acceleration = enemy.moveSpeed * 5; // Adjust for responsiveness
    const force = scaleVector(velocityDiff, acceleration / diffLength);
    
    return force;
  }

  /**
   * Computes braking force to slow down
   */
  private computeBrakingForce(
    enemy: InternalEnemyState,
    movementState: { velocity: SceneVector2 }
  ): SceneVector2 {
    if (!vectorHasLength(movementState.velocity)) {
      return ZERO_VECTOR;
    }
    return this.computeSteeringForce(enemy, movementState.velocity, ZERO_VECTOR);
  }

  private parseSaveData(data: unknown): EnemySaveData | null {
    if (!data || typeof data !== "object") {
      return null;
    }
    const { enemies } = data as Partial<EnemySaveData>;
    if (!Array.isArray(enemies)) {
      return null;
    }
    return { enemies };
  }

  private clampToMap(position: SceneVector2): SceneVector2 {
    const mapSize = this.scene.getMapSize();
    return {
      x: clampNumber(position.x, 0, mapSize.width),
      y: clampNumber(position.y, 0, mapSize.height),
    };
  }

  private pushStats(): void {
    const count = this.enemies.size;
    if (count !== this.lastPushedCount) {
      DataBridgeHelpers.pushState(this.bridge, ENEMY_COUNT_BRIDGE_KEY, count);
      this.lastPushedCount = count;
    }

    const totalHp = Math.max(0, Math.floor(this.totalHpCached));
    if (totalHp !== this.lastPushedTotalHp) {
      DataBridgeHelpers.pushState(this.bridge, ENEMY_TOTAL_HP_BRIDGE_KEY, totalHp);
      this.lastPushedTotalHp = totalHp;
    }
  }

  private cloneState(enemy: InternalEnemyState): EnemyRuntimeState {
    return {
      id: enemy.id,
      type: enemy.type,
      level: enemy.level,
      position: { ...enemy.position },
      rotation: enemy.rotation,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      armor: enemy.armor,
      baseDamage: enemy.baseDamage,
      attackInterval: enemy.attackInterval,
      attackCooldown: enemy.attackCooldown,
      attackRange: enemy.attackRange,
      moveSpeed: enemy.moveSpeed,
      physicalSize: enemy.physicalSize,
      reward: enemy.reward ? cloneResourceStockpile(normalizeResourceAmount(enemy.reward)) : undefined,
    };
  }
}
