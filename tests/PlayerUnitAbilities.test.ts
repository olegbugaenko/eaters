import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager, FILL_TYPES } from "../src/logic/services/SceneObjectManager";
import { PlayerUnitAbilities } from "../src/logic/modules/active-map/PlayerUnitAbilities";
import type { ExplosionModule } from "../src/logic/modules/scene/ExplosionModule";

const createAbilities = () => {
  const scene = new SceneObjectManager();
  const explosions = {
    spawnExplosionByType: () => {
      // no-op for tests
    },
  } as unknown as ExplosionModule;
  const abilities = new PlayerUnitAbilities({
    scene,
    explosions,
    getArcs: () => undefined,
    getEffects: () => undefined,
    getFireballs: () => undefined,
    logEvent: () => {
      // no-op for tests
    },
    formatUnitLabel: () => "",
    getUnits: () => [],
    getUnitById: () => undefined,
    getBrickPosition: () => null,
    damageBrick: () => {
      // no-op for tests
    },
    getBricksInRadius: () => [],
    damageUnit: () => {
      // no-op for tests
    },
    findNearestBrick: () => null,
  });
  return { abilities, scene };
};

describe("PlayerUnitAbilities", () => {
  test("clearArcEffects removes fallback arc visuals", () => {
    const { abilities, scene } = createAbilities();
    const arcId = scene.addObject("arc", {
      position: { x: 0, y: 0 },
      fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } },
      customData: {
        arcType: "heal",
        from: { x: 0, y: 0 },
        to: { x: 1, y: 1 },
        lifetimeMs: 1000,
        fadeStartMs: 500,
      },
    });

    (abilities as any).activeArcEffects = [
      {
        id: arcId,
        remainingMs: 1000,
        sourceUnitId: "u1",
        targetUnitId: "u2",
        arcType: "heal",
      },
    ];

    abilities.clearArcEffects();

    assert.strictEqual(scene.getObject(arcId), undefined);
    assert.strictEqual((abilities as any).activeArcEffects.length, 0);
  });
});
