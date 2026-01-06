import assert from "assert";
import { ENEMY_COUNT_BRIDGE_KEY, ENEMY_TOTAL_HP_BRIDGE_KEY } from "../src/logic/modules/active-map/enemies/enemies.const";
import { EnemiesModule } from "../src/logic/modules/active-map/enemies/enemies.module";
import { DataBridge } from "../src/logic/core/DataBridge";
import { SceneObjectManager } from "../src/logic/services/scene-object-manager/SceneObjectManager";
import { MapRunState } from "../src/logic/modules/active-map/map/MapRunState";
import { TargetingService } from "../src/logic/modules/active-map/targeting/TargetingService";
import { DamageService } from "../src/logic/modules/active-map/targeting/DamageService";
import type { TargetingProvider } from "../src/logic/modules/active-map/targeting/targeting.types";
import type { PlayerUnitState } from "../src/logic/modules/active-map/player-units/units/UnitTypes";
import type { ExplosionModule } from "../src/logic/modules/scene/explosion/explosion.module";
import { PLAYER_UNIT_TYPES } from "../src/db/player-units-db";
import { createSolidFill } from "../src/logic/services/scene-object-manager/scene-object-manager.helpers";
import { createVisualEffectState } from "../src/logic/visuals/VisualEffectState";
import { describe, test } from "./testRunner";
import { MovementService } from "../src/logic/services/movement/MovementService";
import type { BricksModule } from "../src/logic/modules/active-map/bricks/bricks.module";
import type { EnemiesModuleOptions } from "../src/logic/modules/active-map/enemies/enemies.types";
import { PathfindingService } from "../src/logic/shared/navigation/PathfindingService";
import type { ObstacleDescriptor, ObstacleProvider } from "../src/logic/shared/navigation/navigation.types";
import type { SceneVector2 } from "../src/logic/services/scene-object-manager/scene-object-manager.types";

const createEnemySpawnData = () => ({
  type: "basicEnemy" as const,
  level: 1,
  position: { x: 0, y: 0 },
});

const createEmptyBricks = (): BricksModule =>
  ({
    forEachBrickNear: () => {},
  } as unknown as BricksModule);

class StaticObstacleProvider implements ObstacleProvider {
  constructor(private readonly obstacles: readonly ObstacleDescriptor[]) {}

  public forEachObstacleNear(
    position: SceneVector2,
    radius: number,
    visitor: (obstacle: ObstacleDescriptor) => void,
  ): void {
    const maxDistanceSq = radius * radius;
    this.obstacles.forEach((obstacle) => {
      const dx = obstacle.position.x - position.x;
      const dy = obstacle.position.y - position.y;
      const range = radius + obstacle.radius;
      if (dx * dx + dy * dy <= range * range || dx * dx + dy * dy <= maxDistanceSq) {
        visitor(obstacle);
      }
    });
  }
}

const createEnemiesModuleWithDeps = (
  options: Partial<EnemiesModuleOptions> & { scene?: SceneObjectManager; bridge?: DataBridge } = {}
) => {
  const scene = options.scene ?? new SceneObjectManager();
  const bridge = options.bridge ?? new DataBridge();
  const runState = options.runState ?? new MapRunState();
  const movement = options.movement ?? new MovementService();
  const bricks = options.bricks ?? createEmptyBricks();
  const obstacles = options.obstacles ?? undefined;
  const pathfinder =
    options.pathfinder ??
    (obstacles
      ? new PathfindingService({
          obstacles,
          getMapSize: () => scene.getMapSize(),
        })
      : undefined);

  return {
    module: new EnemiesModule({
      scene,
      bridge,
      runState,
      movement,
      bricks,
      targeting: options.targeting,
      damage: options.damage,
      explosions: options.explosions,
      projectiles: options.projectiles,
      obstacles,
      pathfinder,
    }),
    scene,
    bridge,
    runState,
  };
};

describe("EnemiesModule", () => {
  test("spawns enemies via state factory and pushes bridge stats", () => {
    const runState = new MapRunState();
    runState.start();
    const spawnData = createEnemySpawnData();
    const { module, scene, bridge } = createEnemiesModuleWithDeps({ runState });

    module.setEnemies([
      {
        ...spawnData,
        position: { x: 10, y: 15 },
      },
    ]);

    const objects = scene.getObjects();
    assert.strictEqual(objects.length, 1, "should spawn a scene object for the enemy");
    assert(bridge.getValue(ENEMY_COUNT_BRIDGE_KEY) === 1);
    const totalHp = bridge.getValue(ENEMY_TOTAL_HP_BRIDGE_KEY) ?? 0;
    assert(totalHp > 0);

    const [enemy] = module.getEnemies();
    assert(enemy, "expected runtime enemy state");
    assert(enemy.hp > 0);
    assert(enemy.attackCooldown >= 0);
  });

  test("applies armor, removes on death, and exposes targets", () => {
    const runState = new MapRunState();
    runState.start();
    const targeting = new TargetingService();
    const { module, bridge } = createEnemiesModuleWithDeps({ runState, targeting });
    const spawnData = createEnemySpawnData();

    module.setEnemies([
      {
        ...spawnData,
        position: { x: 0, y: 0 },
        hp: 10,
      },
      {
        ...spawnData,
        position: { x: 40, y: 0 },
        level: 1,
      },
    ]);

    const initialTarget = targeting.findNearestTarget({ x: 0, y: 0 });
    assert(initialTarget, "expected nearest enemy target");
    const enemyId = initialTarget!.id;
    const applied = module.applyDamage(enemyId, 6, { armorPenetration: 1 });
    assert.strictEqual(applied, 4, "armor should reduce incoming damage");

    module.applyDamage(enemyId, 20);
    assert.strictEqual(targeting.getTargetById(enemyId), null, "destroyed enemy should be removed from targeting");
    assert.strictEqual(bridge.getValue(ENEMY_COUNT_BRIDGE_KEY), 1, "count should drop after death");
    assert.strictEqual(bridge.getValue(ENEMY_TOTAL_HP_BRIDGE_KEY), 5);

    const [survivor] = module.getEnemies();
    assert(survivor, "expected surviving enemy after first kill");
    const prevCooldown = survivor!.attackCooldown;
    module.tick(500);
    const [updated] = module.getEnemies();
    assert(updated, "expected cooldown state to update");
    assert(updated!.attackCooldown < prevCooldown, "cooldown should tick down while running");
  });

  test("attacks nearby units via damage service and spawns explosions", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const runState = new MapRunState();
    runState.start();
    const targeting = new TargetingService();

    let explosionCalls = 0;
    const fakeExplosion: ExplosionModule = {
      spawnExplosionByType: () => {
        explosionCalls += 1;
      },
      spawnExplosion: () => {},
      reset: () => {},
      initialize: () => {},
      load: () => {},
      save: () => null,
      tick: () => {},
      id: "explosion",
    } as unknown as ExplosionModule;

    const units: PlayerUnitState[] = [
      {
        id: "unit-1",
        designId: null,
        type: (PLAYER_UNIT_TYPES[0] ?? "bluePentagon") as typeof PLAYER_UNIT_TYPES[number],
        position: { x: 10, y: 10 },
        spawnPosition: { x: 0, y: 0 },
        movementId: "move-1",
        rotation: 0,
        hp: 10,
        maxHp: 10,
        armor: 1,
        hpRegenPerSecond: 0,
        armorPenetration: 0,
        baseAttackDamage: 1,
        baseAttackInterval: 1,
        baseAttackDistance: 1,
        moveSpeed: 1,
        moveAcceleration: 1,
        mass: 1,
        physicalSize: 6,
        knockBackReduction: 1,
        critChance: 0,
        critMultiplier: 1,
        rewardMultiplier: 1,
        damageTransferPercent: 0,
        damageTransferRadius: 0,
        attackStackBonusPerHit: 0,
        attackStackBonusCap: 0,
        currentAttackStackBonus: 0,
        attackCooldown: 0,
        preCollisionVelocity: { x: 0, y: 0 },
        lastNonZeroVelocity: { x: 0, y: 0 },
        targetBrickId: null,
        targetingMode: "nearest" as const,
        wanderTarget: null,
        wanderCooldown: 0,
        objectId: "scene-unit-1",
        renderer: {
          kind: "composite",
          fill: { r: 0, g: 0, b: 0, a: 1 },
          layers: [
            {
              shape: "circle",
              radius: 4,
              fill: { type: "solid", fill: createSolidFill({ r: 0, g: 0, b: 0, a: 1 }) },
              stroke: { type: "solid", color: { r: 0, g: 0, b: 0, a: 1 }, width: 0 },
            },
          ],
        },
        baseFillColor: { r: 0, g: 0, b: 0, a: 1 },
        appliedFillColor: { r: 0, g: 0, b: 0, a: 1 },
        visualEffects: createVisualEffectState(),
        visualEffectsDirty: false,
        timeSinceLastAttack: 0,
        timeSinceLastSpecial: 0,
        pheromoneHealingMultiplier: 1,
        pheromoneAggressionMultiplier: 1,
        pheromoneAttackBonuses: [],
        fireballDamageMultiplier: 1,
        canUnitAttackDistant: false,
        moduleLevels: {},
        equippedModules: [],
        ownedSkills: [],
        baseStrokeColor: undefined,
        emitter: undefined,
      },
    ];

    const unitsProvider: TargetingProvider<"unit", PlayerUnitState> = {
      types: ["unit"],
      getById: (id) => {
        const unit = units.find((item) => item.id === id);
        return unit
          ? {
              id: unit.id,
              type: "unit" as const,
              position: { ...unit.position },
              hp: unit.hp,
              maxHp: unit.maxHp,
              armor: unit.armor,
              baseDamage: unit.baseAttackDamage,
              physicalSize: unit.physicalSize,
              data: unit,
            }
          : null;
      },
      findNearest: (position) => {
        return unitsProvider.findInRadius(position, Number.POSITIVE_INFINITY)[0] ?? null;
      },
      findInRadius: (position, radius) => {
        const radiusSq = radius * radius;
        return units
          .filter((unit) => {
            const dx = unit.position.x - position.x;
            const dy = unit.position.y - position.y;
            return dx * dx + dy * dy <= radiusSq;
          })
          .map((unit) => unitsProvider.getById(unit.id)!)
          .filter(Boolean);
      },
      forEachInRadius: (position, radius, visitor) => {
        unitsProvider.findInRadius(position, radius).forEach(visitor);
      },
    };

    targeting.registerProvider(unitsProvider);

    const damage = new DamageService({
      bricks: {
        applyDamage: () => ({ destroyed: false, brick: null, inflictedDamage: 0 }),
      } as unknown as any,
      enemies: undefined,
      units: () => ({
        applyDamage: (id: string, dmg: number) => {
          const unit = units.find((item) => item.id === id);
          if (!unit) {
            return 0;
          }
          const previous = unit.hp;
          unit.hp = Math.max(unit.hp - dmg, 0);
          return previous - unit.hp;
        },
        findNearestUnit: () => null,
      }),
      explosions: fakeExplosion,
      targeting,
    });

    const spawnData = createEnemySpawnData();
    const { module } = createEnemiesModuleWithDeps({
      scene,
      bridge,
      runState,
      targeting,
      damage,
      explosions: fakeExplosion,
    });

    module.setEnemies([
      {
        ...spawnData,
        position: { x: 15, y: 15 },
      },
    ]);

    module.tick(200);

    const unitAfterHit = units[0]!;
    assert(unitAfterHit.hp < 10, "enemy attack should deal damage to units");
    assert(explosionCalls > 0, "enemy attack should spawn explosion visuals");
  });

  test("navigates around blocking obstacles to reach attack distance", () => {
    const scene = new SceneObjectManager();
    scene.setMapSize({ width: 800, height: 400 });
    const bridge = new DataBridge();
    const runState = new MapRunState();
    runState.start();
    const targeting = new TargetingService();

    const targetPosition = { x: 360, y: 120 } as const;
    const targetData = {
      id: "unit-1",
      position: { ...targetPosition },
      type: "unit" as const,
      physicalSize: 12,
      hp: 100,
      maxHp: 100,
      armor: 0,
      baseDamage: 0,
    };

    const createSnapshot = () => ({ ...targetData, position: { ...targetPosition }, data: targetData });

    const targetProvider: TargetingProvider<"unit", typeof targetData> = {
      types: ["unit"],
      getById: (id) => (id === targetData.id ? createSnapshot() : null),
      findNearest: () => createSnapshot(),
      findInRadius: () => [createSnapshot()],
      forEachInRadius: (_position, _radius, visitor) => {
        visitor(createSnapshot());
      },
    };

    targeting.registerProvider(targetProvider);

    const obstacles: ObstacleDescriptor[] = [
      { position: { x: 140, y: -40 }, radius: 30 },
      { position: { x: 140, y: 0 }, radius: 30 },
      { position: { x: 140, y: 40 }, radius: 30 },
      { position: { x: 140, y: 80 }, radius: 30 },
    ];

    const obstacleProvider = new StaticObstacleProvider(obstacles);

    const { module } = createEnemiesModuleWithDeps({
      scene,
      bridge,
      runState,
      targeting,
      obstacles: obstacleProvider,
      pathfinder: new PathfindingService({
        obstacles: obstacleProvider,
        getMapSize: () => scene.getMapSize(),
        cellSize: 12,
      }),
    });

    const spawnData = createEnemySpawnData();

    module.setEnemies([
      {
        ...spawnData,
        position: { x: 10, y: 0 },
      },
    ]);

    for (let i = 0; i < 160; i += 1) {
      module.tick(50);
    }

    const [enemy] = module.getEnemies();
    assert(enemy, "expected enemy after navigation ticks");
    const toTarget = {
      x: targetPosition.x - enemy.position.x,
      y: targetPosition.y - enemy.position.y,
    };
    const distance = Math.hypot(toTarget.x, toTarget.y);

    assert(enemy.position.x > 180, "enemy should progress past the obstacle wall");
    assert(enemy.position.y > 40, "enemy should take a detour around the obstacle wall");
    assert(
      distance <= enemy.attackRange + enemy.physicalSize + targetData.physicalSize + 1,
      "enemy should reach attack range via pathfinding",
    );
  });
});
