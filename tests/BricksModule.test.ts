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

const createBricksModule = (scene: SceneObjectManager, bridge: DataBridge) => {
  const explosions = new ExplosionModule({ scene });
  return new BricksModule({ scene, bridge, explosions });
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
});
