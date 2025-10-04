import assert from "assert";
import { BricksModule, BRICK_COUNT_BRIDGE_KEY } from "../src/logic/modules/BricksModule";
import { DataBridge } from "../src/logic/core/DataBridge";
import {
  SceneObjectManager,
  FILL_TYPES,
  SceneLinearGradientFill,
} from "../src/logic/services/SceneObjectManager";
import { BrickType, getBrickConfig } from "../src/db/bricks-db";
import { describe, test } from "./testRunner";

describe("BricksModule", () => {
  test("load applies brick type specific size and gradient", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const module = new BricksModule({ scene, bridge });

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
      assert.strictEqual(fill.fillType, FILL_TYPES.LINEAR_GRADIENT);
      assert.strictEqual(fill.stops.length, fillConfig.stops.length);
      fill.stops.forEach((stop, index) => {
        const expected = fillConfig.stops[index];
        assert(expected, "expected gradient stop");
        assert.strictEqual(stop.offset, expected.offset);
        assert.deepStrictEqual(stop.color, expected.color);
      });
    } else {
      assert.fail("expected linear gradient fill");
    }

    assert(instance.data.stroke, "stroke should be defined");
    assert.deepStrictEqual(instance.data.stroke?.color, config.stroke?.color);
    assert.strictEqual(instance.data.stroke?.width, config.stroke?.width);

    assert.strictEqual(bridge.getValue(BRICK_COUNT_BRIDGE_KEY), 1);

    const saved = module.save();
    assert(saved && typeof saved === "object", "save should return an object");
    const savedBricks = (saved as { bricks?: unknown }).bricks;
    assert(Array.isArray(savedBricks) && savedBricks.length === 1);
    const savedBrick = savedBricks[0] as { type?: unknown };
    assert.strictEqual(savedBrick.type, "smallSquareGray");
  });

  test("invalid brick types fallback to classic config", () => {
    const scene = new SceneObjectManager();
    const bridge = new DataBridge();
    const module = new BricksModule({ scene, bridge });

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
});
