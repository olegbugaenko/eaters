import assert from "assert";
import { describe, test } from "./testRunner";
import { AuraLifecycleManager } from "../src/ui/renderers/objects/AuraLifecycleManager";
import {
  FILL_TYPES,
  SceneObjectInstance,
  SceneObjectManager,
} from "../src/logic/services/SceneObjectManager";

describe("AuraLifecycleManager", () => {
  const createPlayerUnit = (id: string): SceneObjectInstance =>
    ({
      id,
      type: "playerUnit",
      data: {
        position: { x: 0, y: 0 },
        fill: {
          fillType: FILL_TYPES.SOLID,
          color: { r: 1, g: 1, b: 1, a: 1 },
        },
      },
    } as SceneObjectInstance);

  test("clears aura state automatically when map restarts", () => {
    let petalClears = 0;
    let slotClears = 0;
    const manager = new AuraLifecycleManager({
      clearPetalAuras: () => {
        petalClears += 1;
      },
      clearPlayerAuraSlots: () => {
        slotClears += 1;
      },
    });

    manager.onSceneSync({
      added: [createPlayerUnit("playerUnit-1")],
      updated: [],
      removed: [],
    });

    assert.strictEqual(petalClears, 0, "should not clear while units are present");
    assert.strictEqual(slotClears, 0, "should not clear while units are present");

    manager.onSceneSync({
      added: [],
      updated: [],
      removed: ["playerUnit-1"],
    });

    assert.strictEqual(petalClears, 1, "should clear petals when last unit disappears");
    assert.strictEqual(slotClears, 1, "should clear aura slots when last unit disappears");

    manager.onSceneSync({
      added: [createPlayerUnit("playerUnit-2")],
      updated: [],
      removed: [],
    });

    assert.strictEqual(petalClears, 1, "should not clear again when units return");
    assert.strictEqual(slotClears, 1, "should not clear again when units return");
  });

  test("respects initial scene snapshot", () => {
    let petalClears = 0;
    let slotClears = 0;
    const manager = new AuraLifecycleManager({
      clearPetalAuras: () => {
        petalClears += 1;
      },
      clearPlayerAuraSlots: () => {
        slotClears += 1;
      },
    });

    manager.bootstrap([createPlayerUnit("playerUnit-1"), createPlayerUnit("playerUnit-2")]);

    manager.onSceneSync({ added: [], updated: [], removed: ["playerUnit-1"] });

    assert.strictEqual(
      petalClears,
      0,
      "should not clear while some bootstrapped units remain"
    );
    assert.strictEqual(
      slotClears,
      0,
      "should not clear while some bootstrapped units remain"
    );

    manager.onSceneSync({ added: [], updated: [], removed: ["playerUnit-2"] });

    assert.strictEqual(
      petalClears,
      1,
      "should clear when bootstrapped units disappear"
    );
    assert.strictEqual(
      slotClears,
      1,
      "should clear aura slots when bootstrapped units disappear"
    );
  });

  test("clears aura state when player units are replaced in the same sync", () => {
    let petalClears = 0;
    let slotClears = 0;
    const manager = new AuraLifecycleManager({
      clearPetalAuras: () => {
        petalClears += 1;
      },
      clearPlayerAuraSlots: () => {
        slotClears += 1;
      },
    });

    manager.bootstrap([createPlayerUnit("playerUnit-1")]);

    manager.onSceneSync({
      added: [createPlayerUnit("playerUnit-2")],
      updated: [],
      removed: ["playerUnit-1"],
    });

    assert.strictEqual(petalClears, 1, "should clear petals when units are replaced");
    assert.strictEqual(
      slotClears,
      1,
      "should clear aura slots when units are replaced"
    );
  });

  test("does not clear when other player units persist", () => {
    let petalClears = 0;
    let slotClears = 0;
    const manager = new AuraLifecycleManager({
      clearPetalAuras: () => {
        petalClears += 1;
      },
      clearPlayerAuraSlots: () => {
        slotClears += 1;
      },
    });

    manager.bootstrap([createPlayerUnit("playerUnit-1"), createPlayerUnit("playerUnit-2")]);

    manager.onSceneSync({
      added: [createPlayerUnit("playerUnit-3")],
      updated: [],
      removed: ["playerUnit-1"],
    });

    assert.strictEqual(petalClears, 0, "should not clear when some units persist");
    assert.strictEqual(
      slotClears,
      0,
      "should not clear aura slots when some units persist"
    );
  });

  test("clears when player units are marked invisible before removal", () => {
    let petalClears = 0;
    let slotClears = 0;
    const manager = new AuraLifecycleManager({
      clearPetalAuras: () => {
        petalClears += 1;
      },
      clearPlayerAuraSlots: () => {
        slotClears += 1;
      },
    });

    const scene = new SceneObjectManager();
    const idA = scene.addObject("playerUnit", {
      position: { x: 0, y: 0 },
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 1, g: 1, b: 1, a: 1 },
      },
    });
    const idB = scene.addObject("playerUnit", {
      position: { x: 10, y: 10 },
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 1, g: 1, b: 1, a: 1 },
      },
    });

    manager.bootstrap(scene.getObjects());
    scene.flushChanges();

    const originalNow = Date.now;
    (Date as unknown as { now: () => number }).now = () => 0;
    let changes: ReturnType<SceneObjectManager["flushChanges"]>;
    try {
      scene.removeObject(idA);
      scene.removeObject(idB);
      scene.addObject("playerUnit", {
        position: { x: 20, y: 20 },
        fill: {
          fillType: FILL_TYPES.SOLID,
          color: { r: 1, g: 1, b: 1, a: 1 },
        },
      });

      changes = scene.flushChanges();
    } finally {
      (Date as unknown as { now: () => number }).now = originalNow;
    }

    assert.strictEqual(
      changes.removed.length,
      0,
      "removals should be deferred in this scenario",
    );
    assert(
      changes.updated.length > 0,
      "expected pending removal updates for player units",
    );

    manager.onSceneSync(changes);

    assert.strictEqual(
      petalClears,
      1,
      "should clear petal auras when all tracked units disappear",
    );
    assert.strictEqual(
      slotClears,
      1,
      "should clear aura slots when all tracked units disappear",
    );
  });
});
