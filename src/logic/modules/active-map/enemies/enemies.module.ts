import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import { GameModule } from "@core/logic/types";
import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { clampNumber } from "@shared/helpers/numbers.helper";
import {
  cloneResourceStockpile,
  normalizeResourceAmount,
} from "../../../../db/resources-db";
import { SpatialGrid } from "../../../utils/SpatialGrid";
import { MapRunState } from "../map/MapRunState";
import type { TargetingService } from "../targeting/TargetingService";
import { DamageService } from "../targeting/DamageService";
import { MovementService } from "@core/logic/provided/services/movement/MovementService";
import type { MovementBodyState } from "@core/logic/provided/services/movement/movement.types";
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
import type {
  EnemiesModuleOptions,
  EnemyRuntimeState,
  EnemySaveData,
  EnemySpawnData,
  InternalEnemyState,
} from "./enemies.types";
import { EnemyTargetingProvider } from "./enemies.targeting-provider";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import { getEnemyConfig, type EnemyConfig } from "../../../../db/enemies-db";
import { normalizeVector } from "../../../../shared/helpers/vector.helper";
import { normalizeAngle } from "../../../../shared/helpers/angle.helper";
import type { UnitProjectileHitContext } from "../projectiles/projectiles.types";
import type { UnitProjectileController } from "../projectiles/ProjectileController";
import { buildProjectileSpreadDirections } from "../projectiles/projectile-spread.helpers";
import {
  isPassableFor,
  type PassabilityTag,
} from "@/logic/shared/navigation/passability.types";
import type {
  ObstacleDescriptor,
  ObstacleProvider,
} from "@/logic/shared/navigation/navigation.types";
import { PathfindingService } from "@/logic/shared/navigation/PathfindingService";
import { BrickObstacleProvider } from "./brick-obstacle-provider";
import type { StatusEffectsModule } from "../status-effects/status-effects.module";
import type { ArcModule } from "../../scene/arc/arc.module";

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
  private readonly arcs?: ArcModule;
  private readonly obstacles: ObstacleProvider;
  private readonly pathfinder: PathfindingService;
  private readonly navigationCellSize: number;
  private readonly navigationState = new Map<string, EnemyNavigationState>();
  private readonly stateFactory: EnemyStateFactory;
  private readonly spatialIndex = new SpatialGrid<InternalEnemyState>(
    ENEMY_SPATIAL_GRID_CELL_SIZE,
  );
  private readonly statusEffects: StatusEffectsModule;

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
    this.arcs = options.arcs;
    this.statusEffects = options.statusEffects;
    this.obstacles =
      options.obstacles ?? new BrickObstacleProvider(options.bricks);
    this.pathfinder =
      options.pathfinder ??
      new PathfindingService({
        obstacles: this.obstacles,
        getMapSize: () => this.scene.getMapSize(),
      });
    this.navigationCellSize = this.pathfinder.getCellSize();
    this.stateFactory = new EnemyStateFactory({
      scene: this.scene,
      movement: this.movement,
    });

    if (this.targeting) {
      this.targeting.registerProvider(new EnemyTargetingProvider(this));
    }

    this.statusEffects.registerEnemyAdapter({
      hasEnemy: (enemyId) => this.enemies.has(enemyId),
      damageEnemy: (enemyId, amount) => {
        this.applyDamage(enemyId, amount);
      },
    });
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

    // Кешуємо всі перешкоди один раз на початку tick для всіх ворогів
    this.pathfinder.cacheAllObstacles(ENEMY_PASSABILITY);

    const activeTargets = new Map<
      string,
      { id: string; position: SceneVector2; physicalSize: number } | null
    >();
    const reservedTargets = new Set<string>();

    // Phase 1: Compute movement forces towards targets (тільки для рухомих ворогів)
    this.enemyOrder.forEach((enemy) => {
      const config = getEnemyConfig(enemy.type);
      const target = this.findTargetForEnemy(enemy, config, reservedTargets);
      if (target && config.targeting?.avoidSharedTargets) {
        reservedTargets.add(target.id);
      }
      activeTargets.set(enemy.id, target);

      // Статичні вороги (moveSpeed === 0) не рухаються
      const moveSpeed = this.getEffectiveMoveSpeed(enemy);
      if (moveSpeed > 0) {
        this.updateNavigationState(enemy, target, deltaSeconds);
        const force = this.computeMovementForce(enemy, target);
        this.movement.setForce(enemy.movementId, force);
      } else {
        // Статичні вороги все одно обертаються до цілі
        if (target) {
          const toTarget = subtractVectors(target.position, enemy.position);
          const distance = vectorLength(toTarget);
          if (distance > 0) {
            enemy.rotation = Math.atan2(toTarget.y, toTarget.x);
            this.scene.updateObject(enemy.sceneObjectId, {
              position: { ...enemy.position },
              rotation: enemy.rotation,
            });
          }
        }
      }
    });

    // Update movement physics (тільки для рухомих ворогів)
    this.movement.update(deltaSeconds);

    // Phase 2: Update positions, rotations, and handle attacks
    this.enemyOrder.forEach((enemy) => {
      const movementState = this.movement.getBodyState(enemy.movementId);
      if (!movementState) {
        return;
      }

      // Update position
      const newPosition = this.clampToMap(movementState.position);
      if (
        newPosition.x !== enemy.position.x ||
        newPosition.y !== enemy.position.y
      ) {
        enemy.position = newPosition;
        this.spatialIndex.set(
          enemy.id,
          enemy.position,
          enemy.physicalSize,
          enemy,
        );
        anyChanged = true;
      }

      // Update rotation based on movement direction or target direction
      const target = activeTargets.get(enemy.id);
      const desiredRotation = this.computeEnemyRotation(
        enemy,
        target ?? null,
        movementState,
      );
      const newRotation = this.applyRotationSpeedLimit(
        enemy.rotation,
        desiredRotation,
        deltaSeconds,
        movementState.velocity,
      );
      if (newRotation !== enemy.rotation) {
        enemy.rotation = newRotation;
        anyChanged = true;
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
      clampToMap: (position: EnemySpawnData["position"]) =>
        this.clampToMap(position),
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

  public getEnemyPositionIfAlive = (enemyId: string): SceneVector2 | null => {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.hp <= 0) {
      return null;
    }
    return { ...enemy.position };
  };

  public findNearestEnemy(position: SceneVector2): EnemyRuntimeState | null {
    const nearest = this.spatialIndex.queryNearest(position, {
      maxLayers: 128,
    });
    return nearest ? this.cloneState(nearest) : null;
  }

  public findEnemiesNear(
    position: SceneVector2,
    radius: number,
  ): EnemyRuntimeState[] {
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
    this.spatialIndex.forEachInCircle(position, radius, (enemy) =>
      visitor(this.cloneState(enemy)),
    );
  }

  public applyDamage(
    enemyId: string,
    damage: number,
    options?: { armorPenetration?: number },
  ): number {
    if (damage <= 0) {
      return 0;
    }
    const enemy = this.enemies.get(enemyId);
    if (!enemy) {
      return 0;
    }
    const armorPenetration = clampNumber(
      options?.armorPenetration ?? 0,
      0,
      Number.POSITIVE_INFINITY,
    );
    const armorDelta = this.statusEffects.getTargetArmorDelta({
      type: "enemy",
      id: enemyId,
    });
    const effectiveArmor = Math.max(
      enemy.armor + armorDelta - armorPenetration,
      0,
    );
    const appliedDamage = Math.max(damage - effectiveArmor, 0);
    if (appliedDamage <= 0) {
      return 0;
    }

    const remainingHp = Math.max(enemy.hp - appliedDamage, 0);
    const dealt = enemy.hp - remainingHp;
    enemy.hp = remainingHp;
    if (dealt > 0) {
      this.statusEffects.handleTargetHit({ type: "enemy", id: enemyId });
    }
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
        clampToMap: (position: EnemySpawnData["position"]) =>
          this.clampToMap(position),
      };
      const state = this.stateFactory.createWithTransform(input);
      this.enemies.set(state.id, state);
      this.enemyOrder.push(state);
      this.spatialIndex.set(
        state.id,
        state.position,
        state.physicalSize,
        state,
      );
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
    this.statusEffects.clearTargetEffects({ type: "enemy", id: enemy.id });
  }

  private findTargetForEnemy(
    enemy: InternalEnemyState,
    config: EnemyConfig,
    reservedTargets: Set<string>,
  ): { id: string; position: SceneVector2; physicalSize: number } | null {
    if (!this.targeting) {
      return null;
    }
    if (!config.targeting) {
      return (
        this.targeting.findNearestTarget(enemy.position, {
          types: ["unit"],
        }) ?? null
      );
    }
    const searchPadding = Math.max(config.targeting.searchPadding ?? 0, 0);
    const radius = enemy.attackRange + enemy.physicalSize + searchPadding;
    const candidates = this.targeting.findTargetsNear(enemy.position, radius, { types: ["unit"] });
    let best: { id: string; position: SceneVector2; physicalSize: number } | null = null;
    let bestDistanceSq = Number.POSITIVE_INFINITY;
    candidates.forEach((candidate) => {
      if (config.targeting?.avoidSharedTargets && reservedTargets.has(candidate.id)) {
        return;
      }
      if (
        config.targeting?.skipTargetsWithEffects?.some((effectId) =>
          this.statusEffects.hasEffect(effectId, { type: "unit", id: candidate.id }),
        )
      ) {
        return;
      }
      const attackRange =
        enemy.attackRange + enemy.physicalSize + candidate.physicalSize;
      const distanceSq = distanceSquared(candidate.position, enemy.position);
      if (distanceSq > attackRange * attackRange) {
        return;
      }
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        best = {
          id: candidate.id,
          position: candidate.position,
          physicalSize: candidate.physicalSize,
        };
      }
    });
    return best;
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
    const attackRange =
      enemy.attackRange + enemy.physicalSize + target.physicalSize;

    if (distance > attackRange) {
      return false;
    }

    const config = getEnemyConfig(enemy.type);

    if (config.arcAttack) {
      const arcAttack = config.arcAttack;
      this.arcs?.spawnArcBetweenTargets(
        arcAttack.arcType,
        { type: "enemy", id: enemy.id },
        { type: "unit", id: target.id },
      );
      if (arcAttack.statusEffectId) {
        const effectTarget = { type: "unit", id: target.id } as const;
        if (!this.statusEffects.hasEffect(arcAttack.statusEffectId, effectTarget)) {
          this.statusEffects.applyEffect(
            arcAttack.statusEffectId,
            effectTarget,
            arcAttack.statusEffectOptions,
          );
        }
      }
      if (this.damage && enemy.baseDamage > 0) {
        const knockBackDirection = toTarget;
        this.damage.applyTargetDamage(target.id, enemy.baseDamage, {
          armorPenetration: 0,
          knockBackDistance: config.knockBackDistance,
          knockBackSpeed: config.knockBackSpeed,
          knockBackDirection:
            vectorLength(knockBackDirection) > 0
              ? knockBackDirection
              : normalizeVector(toTarget) || { x: 1, y: 0 },
        });
      }
      return true;
    }

    if (config.explosionAttack && this.damage) {
      const explosionAttack = config.explosionAttack;
      const radius = Math.max(0, explosionAttack.radius);
      if (radius > 0) {
        const damageMultiplier = Math.max(explosionAttack.damageMultiplier ?? 1, 0);
        const knockBackDirection =
          vectorLength(toTarget) > 0
            ? toTarget
            : normalizeVector(toTarget) || { x: 1, y: 0 };
        this.damage.applyAreaDamage(
          enemy.position,
          radius,
          enemy.baseDamage * damageMultiplier,
          {
            types: ["unit"],
            explosionType: explosionAttack.explosionType,
            explosionRadius: explosionAttack.explosionRadius,
            knockBackDistance: config.knockBackDistance,
            knockBackSpeed: config.knockBackSpeed,
            knockBackDirection,
          },
        );
      }

      if (explosionAttack.statusEffectId) {
        this.targeting.forEachTargetNear(
          enemy.position,
          Math.max(0, explosionAttack.radius),
          (target) => {
            if (target.type !== "unit") {
              return;
            }
            const effectTarget = { type: "unit", id: target.id } as const;
            if (!this.statusEffects.hasEffect(explosionAttack.statusEffectId, effectTarget)) {
              this.statusEffects.applyEffect(
                explosionAttack.statusEffectId,
                effectTarget,
                explosionAttack.statusEffectOptions,
              );
            }
          },
          { types: ["unit"] },
        );
      }

      return true;
    }

    // Якщо є конфіг снаряда - створюємо снаряд
    if (config.projectile && this.projectiles) {
      const direction = normalizeVector(toTarget) || { x: 1, y: 0 };
      const volley = config.projectileVolley;
      const directions = buildProjectileSpreadDirections({
        count: volley?.count ?? 1,
        spreadAngleDeg: volley?.spreadAngleDeg ?? 0,
        baseDirection: direction,
      });
      // Зміщуємо спавн снаряда на край турелі (відстань = physicalSize + радіус снаряда)
      /* const spawnOffset = enemy.physicalSize/2 + (config.projectile.radius ?? 6);
      const origin = {
        x: enemy.position.x + direction.x * spawnOffset,
        y: enemy.position.y + direction.y * spawnOffset,
      };
      */
      const origin = volley?.spawnOffset
        ? addVectors(enemy.position, volley.spawnOffset)
        : { ...enemy.position };

      directions.forEach((projectileDirection) => {
        this.projectiles.spawn({
          origin,
          direction: projectileDirection,
          damage: enemy.baseDamage,
          rewardMultiplier: 1, // Вороги не дають нагороди за атаку
          armorPenetration: 0,
          targetTypes: ["unit"], // Вороги атакують тільки юнітів
          visual: config.projectile,
          onHit: (hitContext: UnitProjectileHitContext) => {
            if (hitContext.targetType === "unit" && this.damage) {
              // Calculate knockback direction from enemy to hit position
              const knockBackDirection = subtractVectors(
                hitContext.position,
                enemy.position,
              );

              this.damage.applyTargetDamage(
                hitContext.targetId,
                enemy.baseDamage,
                {
                  armorPenetration: 0,
                  knockBackDistance: config.knockBackDistance,
                  knockBackSpeed: config.knockBackSpeed,
                  knockBackDirection:
                    vectorLength(knockBackDirection) > 0
                      ? knockBackDirection
                      : projectileDirection,
                },
              );

              if (this.explosions && config.projectile?.explosion) {
                this.explosions.spawnExplosionByType(
                  config.projectile.explosion,
                  {
                    position: { ...hitContext.position },
                    initialRadius: Math.max(8, enemy.physicalSize),
                  },
                );
              }
            }
            return true; // Снаряд зникає після влучання
          },
        });
      });

      return true;
    }

    // Якщо немає конфігу снаряда - instant damage
    if (this.damage) {
      // Calculate knockback direction from enemy to target
      const knockBackDirection = toTarget;

      this.damage.applyTargetDamage(target.id, enemy.baseDamage, {
        armorPenetration: 0,
        knockBackDistance: config.knockBackDistance,
        knockBackSpeed: config.knockBackSpeed,
        knockBackDirection:
          vectorLength(knockBackDirection) > 0
            ? knockBackDirection
            : normalizeVector(toTarget) || { x: 1, y: 0 },
      });

      // For instant damage, use default explosion type (plasmoid) if explosions module is available
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
      this.statusEffects.clearTargetEffects({ type: "enemy", id: enemy.id });
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

    const baseTargetRadius =
      enemy.attackRange + enemy.physicalSize + target.physicalSize;

    // Add margin for maneuverability limitations
    // With limited steering force, enemy needs extra space to turn
    // Estimate: time to turn 90 degrees at max steering force
    const mass = this.getEnemyMass(enemy);
    const moveSpeed = this.getEffectiveMoveSpeed(enemy);
    const baseAcceleration = moveSpeed * 5;
    const maxForce = baseAcceleration * mass;
    // Rough estimate: time to change velocity direction by 90 degrees
    // Assuming we need to change velocity by moveSpeed (perpendicular component)
    const turnTime = maxForce > 0 ? moveSpeed / maxForce : 0.2;
    const maneuverMargin = moveSpeed * turnTime * 0.5; // Conservative margin
    const targetRadius = baseTargetRadius + maneuverMargin;

    const existing = this.navigationState.get(enemy.id);
    const distanceToTargetSq = distanceSquared(enemy.position, target.position);
    const targetMoved = existing
      ? distanceSquared(existing.targetPosition, target.position) >
        this.navigationCellSize * this.navigationCellSize * 0.5
      : true;

    if (distanceToTargetSq <= baseTargetRadius * baseTargetRadius) {
      this.navigationState.set(enemy.id, {
        targetId: target.id,
        targetPosition: { ...target.position },
        targetRadius: baseTargetRadius,
        waypoints: [],
        goalReached: true,
        repathCooldown: 0.2,
        lastPosition: { ...enemy.position },
        stuckTimer: 0,
      });
      return;
    }

    const repathCooldown = Math.max(
      (existing?.repathCooldown ?? 0) - deltaSeconds,
      0,
    );
    const needsPath =
      !existing ||
      existing.targetId !== target.id ||
      existing.goalReached ||
      existing.waypoints.length === 0 ||
      repathCooldown <= 0 ||
      targetMoved;

    if (!needsPath && existing) {
      existing.targetRadius = baseTargetRadius;
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

    // Адаптивний cooldown: далекі вороги рідше перераховують шлях
    const distanceToTarget = Math.sqrt(distanceToTargetSq);
    let repathCooldownValue: number;
    if (path.goalReached) {
      repathCooldownValue = 0.2;
    } else if (distanceToTarget > 300) {
      // Далеко - рідко перераховувати (1 раз/сек)
      repathCooldownValue = 1.0;
    } else if (distanceToTarget > 150) {
      // Середня відстань
      repathCooldownValue = 0.6;
    } else {
      // Близько - частіше
      repathCooldownValue = 0.35;
    }

    this.navigationState.set(enemy.id, {
      targetId: target.id,
      targetPosition: { ...target.position },
      targetRadius: baseTargetRadius, // Store base radius (without margin) for goal checking
      waypoints: path.waypoints.map((point) => ({ ...point })),
      goalReached: path.goalReached,
      repathCooldown: repathCooldownValue,
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
    const threshold = Math.max(
      enemy.physicalSize * 0.5,
      this.navigationCellSize * 0.5,
    );
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
        ? distanceSquared(enemy.position, target.position) <=
          navigation.targetRadius * navigation.targetRadius
        : navigation.goalReached;
    }
  }

  private trackNavigationProgress(
    enemy: InternalEnemyState,
    deltaSeconds: number,
  ): void {
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
    target: { position: SceneVector2; physicalSize: number } | null,
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
    const attackRange =
      enemy.attackRange + enemy.physicalSize + target.physicalSize;
    const distanceOutsideRange = Math.max(distance - attackRange, 0);

    // If within attack range, brake
    if (distanceOutsideRange <= 0 || navigation?.goalReached) {
      return this.computeBrakingForce(enemy, movementState);
    }

    // Move towards target
    const direction =
      distanceToDestination > 0
        ? scaleVector(toDestination, 1 / distanceToDestination)
        : ZERO_VECTOR;
    if (!vectorHasLength(direction)) {
      return ZERO_VECTOR;
    }

    // Desired speed - slow down as we approach
    const approachDistance = Math.min(
      distanceOutsideRange,
      distanceToDestination,
    );
    const moveSpeed = this.getEffectiveMoveSpeed(enemy);
    const desiredSpeed = Math.max(
      Math.min(moveSpeed, approachDistance),
      moveSpeed * 0.25,
    );
    let desiredVelocity = scaleVector(direction, desiredSpeed);

    const avoidance = this.computeObstacleAvoidance(enemy, desiredVelocity);
    if (vectorHasLength(avoidance)) {
      desiredVelocity = addVectors(desiredVelocity, avoidance);
    }

    // Steering force (similar to player units)
    return this.computeSteeringForce(
      enemy,
      movementState.velocity,
      desiredVelocity,
    );
  }

  private computeObstacleAvoidance(
    enemy: InternalEnemyState,
    desiredVelocity: SceneVector2,
  ): SceneVector2 {
    if (!vectorHasLength(desiredVelocity)) {
      return ZERO_VECTOR;
    }

    const avoidanceRadius = enemy.physicalSize * 3;
    const entityTag = ENEMY_PASSABILITY;
    let avoidanceVector = { ...ZERO_VECTOR };

    this.obstacles.forEachObstacleNear(
      enemy.position,
      avoidanceRadius,
      (obstacle: ObstacleDescriptor) => {
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
        const isAhead =
          normalizedToObstacle.x * desiredVelocity.x +
            normalizedToObstacle.y * desiredVelocity.y >
          0;
        if (distance <= 0 || distance > avoidanceRadius || !isAhead) {
          return;
        }

        const overlap = combinedRadius + 4 - distance;
        if (overlap <= 0) {
          return;
        }

        const pushDirection = scaleVector(
          toObstacle,
          -1 / Math.max(distance, 1),
        );
        const strength = overlap / Math.max(combinedRadius, 1);
        avoidanceVector = addVectors(
          avoidanceVector,
          scaleVector(pushDirection, strength),
        );
      },
    );

    const length = vectorLength(avoidanceVector);
    if (length <= 0) {
      return ZERO_VECTOR;
    }

    const maxAvoidance = this.getEffectiveMoveSpeed(enemy);
    return scaleVector(avoidanceVector, maxAvoidance / length);
  }

  private getEffectiveMoveSpeed(enemy: InternalEnemyState): number {
    const multiplier = this.statusEffects.getTargetSpeedMultiplier({
      type: "enemy",
      id: enemy.id,
    });
    return Math.max(enemy.moveSpeed * Math.max(multiplier, 0), 0);
  }

  /**
   * Computes steering force to reach desired velocity
   * Limits force magnitude to prevent abrupt velocity changes
   */
  private computeSteeringForce(
    enemy: InternalEnemyState,
    currentVelocity: SceneVector2,
    desiredVelocity: SceneVector2,
  ): SceneVector2 {
    const steering = subtractVectors(desiredVelocity, currentVelocity);
    const magnitude = vectorLength(steering);
    if (magnitude <= 0) {
      return ZERO_VECTOR;
    }

    // Calculate max force based on moveSpeed and mass (similar to player units)
    // Use moveSpeed * 5 as base acceleration, multiplied by mass
    // This limits how quickly velocity can change
    const baseAcceleration = this.getEffectiveMoveSpeed(enemy) * 5;
    const mass = this.getEnemyMass(enemy);
    const maxForce = Math.max(baseAcceleration * mass, 0);

    if (maxForce <= 0) {
      return ZERO_VECTOR;
    }

    // Limit force magnitude
    if (magnitude > maxForce) {
      return scaleVector(steering, maxForce / magnitude);
    }

    return steering;
  }

  /**
   * Gets enemy mass from movement body
   */
  private getEnemyMass(enemy: InternalEnemyState): number {
    // Mass is calculated as physicalSize * 0.1 in state factory
    // We can approximate it here or get it from movement body
    return Math.max(enemy.physicalSize * 0.1, 0.001);
  }

  /**
   * Computes braking force to slow down
   */
  private computeBrakingForce(
    enemy: InternalEnemyState,
    movementState: { velocity: SceneVector2 },
  ): SceneVector2 {
    if (!vectorHasLength(movementState.velocity)) {
      return ZERO_VECTOR;
    }
    return this.computeSteeringForce(
      enemy,
      movementState.velocity,
      ZERO_VECTOR,
    );
  }

  /**
   * Computes enemy rotation based on movement direction or target direction
   * - If enemy is actively moving (velocity > threshold): rotate towards movement direction
   * - If enemy is within attack range or standing still: rotate towards target
   * - If no target: keep current rotation
   */
  private computeEnemyRotation(
    enemy: InternalEnemyState,
    target: { position: SceneVector2; physicalSize: number } | null,
    movementState: MovementBodyState,
  ): number {
    const MIN_VELOCITY_FOR_MOVEMENT_ROTATION = 0.1; // Minimum velocity to use movement-based rotation

    // 1. If target exists and enemy is within attack range - rotate towards target for attack
    if (target) {
      const toTarget = subtractVectors(target.position, enemy.position);
      const distance = vectorLength(toTarget);
      const attackRange =
        enemy.attackRange + enemy.physicalSize + target.physicalSize;

      if (distance <= attackRange) {
        // Within attack range - rotate towards target for proper attack
        if (vectorHasLength(toTarget)) {
          return Math.atan2(toTarget.y, toTarget.x);
        }
      }
    }

    // 2. If enemy is actively moving - rotate towards movement direction
    // This accounts for pathfinding and obstacle avoidance
    const velocityLength = vectorLength(movementState.velocity);
    if (velocityLength >= MIN_VELOCITY_FOR_MOVEMENT_ROTATION) {
      return Math.atan2(movementState.velocity.y, movementState.velocity.x);
    }

    // 3. If target exists but enemy is standing still - rotate towards target
    if (target) {
      const toTarget = subtractVectors(target.position, enemy.position);
      if (vectorHasLength(toTarget)) {
        return Math.atan2(toTarget.y, toTarget.x);
      }
    }

    // 4. Fallback - keep current rotation
    return enemy.rotation;
  }

  /**
   * Applies rotation speed limit to smoothly interpolate between current and desired rotation
   * Only applies limit when enemy is not moving (standing still)
   */
  private applyRotationSpeedLimit(
    currentRotation: number,
    desiredRotation: number,
    deltaSeconds: number,
    velocity: SceneVector2,
  ): number {
    const MIN_VELOCITY_FOR_FREE_ROTATION = 0.1; // If moving, allow free rotation
    const MAX_ROTATION_SPEED = Math.PI * 2; // 360 degrees per second (adjustable)

    // If enemy is moving, allow free rotation (rotation follows movement direction)
    if (vectorLength(velocity) >= MIN_VELOCITY_FOR_FREE_ROTATION) {
      return desiredRotation;
    }

    // If rotation hasn't changed, no need to interpolate
    if (currentRotation === desiredRotation) {
      return currentRotation;
    }

    // Normalize angles to [0, 2π)
    const normalizedCurrent = normalizeAngle(currentRotation);
    const normalizedDesired = normalizeAngle(desiredRotation);

    // Calculate shortest angular difference (handles wrap-around)
    let angleDiff = normalizedDesired - normalizedCurrent;
    if (angleDiff > Math.PI) {
      angleDiff -= Math.PI * 2;
    } else if (angleDiff < -Math.PI) {
      angleDiff += Math.PI * 2;
    }

    // If difference is very small, snap to desired
    if (Math.abs(angleDiff) < 0.001) {
      return normalizedDesired;
    }

    // Limit rotation speed
    const maxRotationDelta = MAX_ROTATION_SPEED * deltaSeconds;
    const clampedDiff = Math.max(
      -maxRotationDelta,
      Math.min(maxRotationDelta, angleDiff),
    );

    // Apply rotation
    const newRotation = normalizedCurrent + clampedDiff;
    return normalizeAngle(newRotation);
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
      DataBridgeHelpers.pushState(
        this.bridge,
        ENEMY_TOTAL_HP_BRIDGE_KEY,
        totalHp,
      );
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
      knockBackDistance: enemy.knockBackDistance,
      knockBackSpeed: enemy.knockBackSpeed,
      reward: enemy.reward
        ? cloneResourceStockpile(normalizeResourceAmount(enemy.reward))
        : undefined,
    };
  }
}
