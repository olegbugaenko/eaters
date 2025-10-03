import assert from "assert";
import {
  FILL_TYPES,
  SceneObjectManager,
  SceneRadialGradientFill,
} from "../src/logic/services/SceneObjectManager";
import { describe, test } from "./testRunner";

describe("SceneObjectManager fill handling", () => {
  test("sanitizes gradient fill input", () => {
    const manager = new SceneObjectManager();
    const id = manager.addObject("gradient", {
      position: { x: 0, y: 0 },
      fill: {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: { x: Number.NaN, y: 5 },
        end: { x: Number.POSITIVE_INFINITY, y: 10 },
        stops: [
          {
            offset: -0.5,
            color: { r: 2, g: -1, b: 0.25, a: 2 },
          },
          {
            offset: 0.75,
            color: { r: 0.5, g: 1.5, b: -0.5 },
          },
        ],
      },
    });

    const instance = manager.getObject(id);
    assert(instance, "Object should be registered");
    const fill = instance.data.fill;
    assert.strictEqual(fill.fillType, FILL_TYPES.LINEAR_GRADIENT);
    assert.strictEqual(fill.start, undefined);
    assert.strictEqual(fill.end, undefined);
    assert.strictEqual(fill.stops.length, 2);

    const [first, second] = fill.stops;
    assert(first, "First stop must exist");
    assert.strictEqual(first.offset, 0);
    assert.deepStrictEqual(first.color, { r: 1, g: 0, b: 0.25, a: 1 });

    assert(second, "Second stop must exist");
    assert.strictEqual(second.offset, 0.75);
    assert.deepStrictEqual(second.color, { r: 0.5, g: 1, b: 0, a: 1 });

    assert.deepStrictEqual(instance.data.color, first.color);
  });

  test("clones fills when emitting updates", () => {
    const manager = new SceneObjectManager();
    const id = manager.addObject("radial", {
      position: { x: 1, y: 2 },
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.2, g: 0.3, b: 0.4, a: 0.5 },
      },
    });
    const initial = manager.flushChanges();
    assert.strictEqual(initial.added.length, 1);

    const updateFill: SceneRadialGradientFill = {
      fillType: FILL_TYPES.RADIAL_GRADIENT,
      start: { x: 4, y: -6 },
      end: -50,
      stops: [],
    };

    manager.updateObject(id, {
      position: { x: 3, y: 5 },
      fill: updateFill,
    });

    const changes = manager.flushChanges();
    assert.strictEqual(changes.updated.length, 1);
    const updated = changes.updated[0];
    assert(updated, "Updated instance should be available");
    const fill = updated.data.fill;

    assert.strictEqual(fill.fillType, FILL_TYPES.RADIAL_GRADIENT);
    assert.deepStrictEqual(fill.start, { x: 4, y: -6 });
    assert.strictEqual(fill.end, undefined);
    assert.strictEqual(fill.stops.length, 1);
    assert.deepStrictEqual(fill.stops[0], {
      offset: 0,
      color: { r: 1, g: 1, b: 1, a: 1 },
    });

    fill.stops[0].color.r = 0.25;
    const stored = manager.getObject(id);
    assert(stored, "Object should still exist");
    const storedFill = stored.data.fill;
    if (storedFill.fillType !== FILL_TYPES.RADIAL_GRADIENT) {
      throw new Error("Unexpected fill type after update");
    }
    assert.strictEqual(storedFill.stops[0]?.color.r, 1);
  });
});
