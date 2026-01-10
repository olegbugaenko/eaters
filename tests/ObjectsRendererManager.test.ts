import assert from "assert";
import { describe, test } from "./testRunner";
import { ObjectsRendererManager } from "../src/ui/renderers/objects/ObjectsRendererManager";
import {
  DynamicPrimitive,
  ObjectRenderer,
} from "../src/ui/renderers/objects/ObjectRenderer";
import { TiedObjectsRegistry } from "../src/ui/renderers/objects/TiedObjectsRegistry";
import { FILL_TYPES } from "../src/core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { SceneObjectInstance } from "../src/core/logic/provided/services/scene-object-manager/scene-object-manager.types";

class TestRenderer extends ObjectRenderer {
  public constructor(private readonly updates: Array<{ x: number; y: number }>) {
    super();
  }

  public register(instance: SceneObjectInstance) {
    const primitive: DynamicPrimitive = {
      data: new Float32Array(0),
      autoAnimate: true,
      update: (target) => {
        this.updates.push({
          x: target.data.position.x,
          y: target.data.position.y,
        });
        return null;
      },
    };
    return { staticPrimitives: [], dynamicPrimitives: [primitive] };
  }
}

describe("ObjectsRendererManager interpolated positions", () => {
  test("uses interpolated positions during tickAutoAnimating", () => {
    const updates: Array<{ x: number; y: number }> = [];
    const renderer = new TestRenderer(updates);
    const manager = new ObjectsRendererManager(
      new Map([["test", renderer]]),
      new TiedObjectsRegistry()
    );

    const instance: SceneObjectInstance = {
      id: "object-1",
      type: "test",
      data: {
        position: { x: 0, y: 0 },
        fill: {
          fillType: FILL_TYPES.SOLID,
          color: { r: 1, g: 1, b: 1, a: 1 },
        },
      },
    } as SceneObjectInstance;

    manager.applyChanges({ added: [instance], updated: [], removed: [] });

    const interpolated = new Map([
      ["object-1", { x: 5, y: 6 }],
    ]);
    manager.applyInterpolatedPositions(interpolated);
    const afterApplyIndex = updates.length;

    manager.tickAutoAnimating();
    assert.deepStrictEqual(updates[afterApplyIndex], { x: 5, y: 6 });
    assert.deepStrictEqual(instance.data.position, { x: 0, y: 0 });

    const afterFirstTickIndex = updates.length;
    manager.tickAutoAnimating();
    assert.deepStrictEqual(updates[afterFirstTickIndex], { x: 0, y: 0 });
  });
});
