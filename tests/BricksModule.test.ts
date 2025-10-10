import assert from "assert";
import {
  BricksModule,
  BRICK_COUNT_BRIDGE_KEY,
  BRICK_TOTAL_HP_BRIDGE_KEY,
} from "../src/logic/modules/BricksModule";
import { DataBridge } from "../src/logic/core/DataBridge";
import {
  SceneObjectManager,
  FILL_TYPES,
  SceneLinearGradientFill,
  SceneRadialGradientFill,
} from "../src/logic/services/SceneObjectManager";
import { BrickType, getBrickConfig } from "../src/db/bricks-db";
import { ExplosionModule } from "../src/logic/modules/ExplosionModule";
import { describe, test } from "./testRunner";
import { BonusesModule } from "../src/logic/modules/BonusesModule";

const createBricksModule = (
  scene: SceneObjectManager,
  bridge: DataBridge,
  onAllBricksDestroyed?: () => void
) => {
  const explosions = new ExplosionModule({ scene });
  const resources = {
    grantResources: () => {
      // no-op for tests
    },
    notifyBrickDestroyed: () => {
      // no-op for tests
    },
  };
  const bonuses = new BonusesModule();
  bonuses.initialize();
  return new BricksModule({
    scene,
    bridge,
    explosions,
    resources,
    bonuses,
    onAllBricksDestroyed,
  });
};

describe("BricksModule", () => {
  test("load applies brick type specific size and gradient", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const module = createBricksModule(scene, bridge);

    module.load({
      bricks: [
        {
          position: { x: 150, y: 250 },
          rotation: 0,
          type: "smallSquareGray",
        },
      ],
    });

    const objects = scene.getObjects();
    assert.strictEqual(objects.length, 1, "should spawn one brick");
    const instance = objects[0]!;
    const config = getBrickConfig("smallSquareGray");

    assert.deepStrictEqual(instance.data.size, config.size);
    const fill = instance.data.fill;
    const fillConfig = config.fill;
    if (fillConfig.type === "linear") {
      const linearFill = fill as SceneLinearGradientFill;
      assert.strictEqual(linearFill.fillType, FILL_TYPES.LINEAR_GRADIENT);
      assert.strictEqual(linearFill.stops.length, fillConfig.stops.length);
      linearFill.stops.forEach((stop, index) => {
        const expected = fillConfig.stops[index];
        assert(expected, "expected gradient stop");
        assert.strictEqual(stop.offset, expected.offset);
        assert.deepStrictEqual(stop.color, expected.color);
      });
    } else if (fillConfig.type === "radial") {
      const radialFill = fill as SceneRadialGradientFill;
      assert.strictEqual(radialFill.fillType, FILL_TYPES.RADIAL_GRADIENT);
      assert.strictEqual(radialFill.stops.length, fillConfig.stops.length);
      radialFill.stops.forEach((stop, index) => {
        const expected = fillConfig.stops[index];
        assert(expected, "expected gradient stop");
        assert.strictEqual(stop.offset, expected.offset);
        assert.deepStrictEqual(stop.color, expected.color);
      });
    } else {
      assert.fail(`unexpected fill type: ${fillConfig.type}`);
    }

    assert(instance.data.stroke, "stroke should be defined");
    assert.deepStrictEqual(instance.data.stroke?.color, config.stroke?.color);
    assert.strictEqual(instance.data.stroke?.width, config.stroke?.width);

    assert.strictEqual(bridge.getValue(BRICK_COUNT_BRIDGE_KEY), 1);
    assert.strictEqual(bridge.getValue(BRICK_TOTAL_HP_BRIDGE_KEY), 5);

    const saved = module.save();
    assert(saved && typeof saved === "object", "save should return an object");
    const savedBricks = (saved as { bricks?: unknown }).bricks;
    assert(Array.isArray(savedBricks) && savedBricks.length === 1);
    const savedBrick = savedBricks[0] as { type?: unknown; hp?: number };
    assert.strictEqual(savedBrick.type, "smallSquareGray");
    assert.strictEqual(savedBrick.hp, config.destructubleData?.maxHp);
  });

  test("invalid brick types fallback to classic config", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const module = createBricksModule(scene, bridge);

    module.load({
      bricks: [
        {
          position: { x: 0, y: 0 },
          rotation: 0,
          type: "unknown" as never,
        },
      ],
    });

    const objects = scene.getObjects();
    assert.strictEqual(objects.length, 1);
    const instance = objects[0]!;
    const saved = module.save() as { bricks?: { type?: string }[] };
    const savedType = (saved.bricks?.[0]?.type as BrickType | undefined) ?? "classic";
    const config = getBrickConfig(savedType);
    assert.deepStrictEqual(instance.data.size, config.size);
    const fill = instance.data.fill as SceneLinearGradientFill;
    assert.strictEqual(fill.fillType, FILL_TYPES.LINEAR_GRADIENT);
    const fillConfig = config.fill;
    fill.stops.forEach((stop, index) => {
      const expected = fillConfig.type === "linear" ? fillConfig.stops[index] : null;
      assert(expected, "expected gradient stop");
      assert.strictEqual(stop.offset, expected.offset);
      assert.deepStrictEqual(stop.color, expected.color);
    });
  });

  test("applyDamage respects armor and removes destroyed bricks", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const module = createBricksModule(scene, bridge);

    module.setBricks([
      {
        position: { x: 10, y: 10 },
        rotation: 0,
        type: "classic",
      },
    ]);

    const [brick] = module.getBrickStates();
    assert(brick, "expected brick state");

    const firstHit = module.applyDamage(brick.id, 2);
    assert.strictEqual(firstHit.destroyed, false);
    const stateAfterFirst = module.getBrickState(brick.id);
    assert(stateAfterFirst, "brick should survive first hit");
    assert.strictEqual(stateAfterFirst?.hp, brick.maxHp - Math.max(2 - brick.armor, 0));
    assert.strictEqual(
      bridge.getValue(BRICK_TOTAL_HP_BRIDGE_KEY),
      stateAfterFirst?.hp,
      "total HP should reflect damage"
    );

    const lethalHit = module.applyDamage(brick.id, 100);
    assert.strictEqual(lethalHit.destroyed, true);
    assert.strictEqual(module.getBrickState(brick.id), null);

    const remainingObjects = scene.getObjects();
    const brickObjects = remainingObjects.filter((object) => object.type === "brick");
    const explosionObjects = remainingObjects.filter((object) => object.type === "explosion");

    assert.strictEqual(brickObjects.length, 0, "brick scene object should be removed");
    assert.strictEqual(explosionObjects.length, 1, "destroy explosion should be spawned");
    assert.strictEqual(bridge.getValue(BRICK_TOTAL_HP_BRIDGE_KEY), 0);
  });

  test("small gray bricks use configured explosion presets", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const module = createBricksModule(scene, bridge);

    module.setBricks([
      {
        position: { x: 10, y: 10 },
        rotation: 0,
        type: "smallSquareGray",
      },
    ]);

    const [brick] = module.getBrickStates();
    assert(brick, "expected brick state");

    module.applyDamage(brick.id, 3);

    let explosions = scene.getObjects().filter((object) => object.type === "explosion");
    assert.strictEqual(explosions.length, 1, "damage should spawn one explosion");
    const damageExplosion = explosions[0]!;
    assert.strictEqual(Math.round((damageExplosion.data.size?.width ?? 0) * 10) / 10, 18.4);
    const damageEmitter = (damageExplosion.data.customData as { emitter?: { color?: unknown } })
      ?.emitter;
    assert(damageEmitter, "damage explosion should configure an emitter");
    assert.deepStrictEqual(damageEmitter?.color, {
      r: 0.82,
      g: 0.84,
      b: 0.88,
      a: 1,
    });

    module.applyDamage(brick.id, 100);

    explosions = scene.getObjects().filter((object) => object.type === "explosion");
    assert.strictEqual(explosions.length, 2, "destroy should spawn another explosion");
    const destroyExplosion = explosions[explosions.length - 1]!;
    assert.strictEqual(Math.round((destroyExplosion.data.size?.width ?? 0) * 10) / 10, 30.4);
    const destroyEmitter = (destroyExplosion.data.customData as { emitter?: { color?: unknown } })
      ?.emitter;
    assert(destroyEmitter, "destroy explosion should configure an emitter");
    assert.deepStrictEqual(destroyEmitter?.color, {
      r: 0.85,
      g: 0.87,
      b: 0.92,
      a: 1,
    });
  });

  test("notifies when the final brick is destroyed", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    let callbackCount = 0;
    const module = createBricksModule(scene, bridge, () => {
      callbackCount += 1;
    });

    module.setBricks([
      {
        position: { x: 10, y: 10 },
        rotation: 0,
        type: "classic",
      },
    ]);

    const [brick] = module.getBrickStates();
    assert(brick, "expected brick state");

    module.applyDamage(brick.id, 999);

    assert.strictEqual(callbackCount, 1, "should notify once when all bricks are gone");
  });
});
