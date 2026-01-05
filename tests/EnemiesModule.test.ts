import assert from "assert";
import { ENEMY_COUNT_BRIDGE_KEY, ENEMY_TOTAL_HP_BRIDGE_KEY } from "../src/logic/modules/active-map/enemies/enemies.const";
import { EnemiesModule } from "../src/logic/modules/active-map/enemies/enemies.module";
import { DataBridge } from "../src/logic/core/DataBridge";
import { SceneObjectManager } from "../src/logic/services/scene-object-manager/SceneObjectManager";
import { createSolidFill } from "../src/logic/services/scene-object-manager/scene-object-manager.helpers";
import { MapRunState } from "../src/logic/modules/active-map/map/MapRunState";
import { TargetingService } from "../src/logic/modules/active-map/targeting/TargetingService";
import { describe, test } from "./testRunner";

const createBlueprint = () => ({
  type: "enemy" as const,
  maxHp: 20,
  armor: 3,
  baseDamage: 4,
  attackInterval: 1.2,
  moveSpeed: 2,
  physicalSize: 14,
  fill: createSolidFill({ r: 200, g: 0, b: 0, a: 1 }),
});

describe("EnemiesModule", () => {
  test("spawns enemies via state factory and pushes bridge stats", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const runState = new MapRunState();
    runState.start();
    const blueprint = createBlueprint();
    const module = new EnemiesModule({ scene, bridge, runState });

    module.setEnemies([
      {
        position: { x: 10, y: 15 },
        blueprint,
      },
    ]);

    const objects = scene.getObjects();
    assert.strictEqual(objects.length, 1, "should spawn a scene object for the enemy");
    assert.strictEqual(objects[0]?.data.size?.width, blueprint.physicalSize);
    assert.strictEqual(bridge.getValue(ENEMY_COUNT_BRIDGE_KEY), 1);
    assert.strictEqual(bridge.getValue(ENEMY_TOTAL_HP_BRIDGE_KEY), blueprint.maxHp);

    const [enemy] = module.getEnemies();
    assert(enemy, "expected runtime enemy state");
    assert.strictEqual(enemy.hp, blueprint.maxHp);
    assert.strictEqual(enemy.attackCooldown, blueprint.attackInterval);
  });

  test("applies armor, removes on death, and exposes targets", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const runState = new MapRunState();
    runState.start();
    const targeting = new TargetingService();
    const module = new EnemiesModule({ scene, bridge, runState, targeting });
    const blueprint = createBlueprint();

    module.setEnemies([
      {
        position: { x: 0, y: 0 },
        blueprint,
        hp: 10,
      },
      {
        position: { x: 40, y: 0 },
        blueprint: { ...blueprint, maxHp: 5 },
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
});
