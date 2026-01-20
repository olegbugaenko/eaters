import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/core/logic/provided/services/scene-object-manager/SceneObjectManager";
import { FILL_TYPES } from "../src/core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { TargetingService } from "../src/logic/modules/active-map/targeting/TargetingService";
import { UnitProjectileController } from "../src/logic/modules/active-map/projectiles/ProjectileController";
import { DamageService } from "../src/logic/modules/active-map/targeting/DamageService";
import type { TargetingProvider } from "../src/logic/modules/active-map/targeting/targeting.types";
import type { BricksModule } from "../src/logic/modules/active-map/bricks/bricks.module";
import type { SceneVector2 } from "../src/core/logic/provided/services/scene-object-manager/scene-object-manager.types";

const SOLID_FILL = { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 1 } } as const;

describe("UnitProjectileController", () => {
  test("keeps movement rotation separate from visual spin rotation", () => {
    const scene = new SceneObjectManager();
    scene.setMapSize({ width: 200, height: 200 });

    const targeting = new TargetingService();
    const bricksStub = {
      applyDamage: () => ({ destroyed: false, brick: null, inflictedDamage: 0 }),
    } as unknown as BricksModule;
    const damage = new DamageService({ bricks: () => bricksStub, targeting });
    const projectiles = new UnitProjectileController({ scene, targeting, damage });

    const projectileId = projectiles.spawn({
      origin: { x: 0, y: 0 },
      direction: { x: 1, y: 0 },
      damage: 1,
      rewardMultiplier: 1,
      armorPenetration: 0,
      visual: {
        radius: 3,
        speed: 60,
        lifetimeMs: 1000,
        fill: SOLID_FILL,
        rotationSpinningDegPerSec: 180,
      },
    });

    projectiles.tick(1000);

    const instance = scene.getObject(projectileId);
    assert.ok(instance, "projectile instance should exist");

    const customData = instance?.data.customData as
      | { movementRotation?: number; visualRotation?: number }
      | undefined;
    assert.ok(customData, "projectile customData should be defined");
    assert.strictEqual(customData?.movementRotation, 0);
    assert.strictEqual(customData?.visualRotation, Math.PI);
    assert.strictEqual(instance?.data.rotation, Math.PI);
  });

  test("defaults to hostile targets instead of friendly units", () => {
    const scene = new SceneObjectManager();
    scene.setMapSize({ width: 200, height: 200 });

    const targeting = new TargetingService();

    const unitTarget = {
      id: "unit-1",
      type: "unit" as const,
      position: { x: 0, y: 0 },
      hp: 10,
      maxHp: 10,
      armor: 0,
      baseDamage: 0,
      physicalSize: 10,
    };

    const brickTarget = {
      id: "brick-1",
      type: "brick" as const,
      position: { x: 30, y: 0 },
      hp: 10,
      maxHp: 10,
      armor: 0,
      baseDamage: 0,
      physicalSize: 8,
    };

    const registerProvider = (provider: TargetingProvider) => targeting.registerProvider(provider);

    registerProvider({
      types: ["unit"],
      getById: (id) => (id === unitTarget.id ? unitTarget : null),
      findNearest: () => unitTarget,
      findInRadius: (position, radius) =>
        distanceTo(position, unitTarget.position) <= radius ? [unitTarget] : [],
      forEachInRadius: (position, radius, visitor) => {
        if (distanceTo(position, unitTarget.position) <= radius) {
          visitor(unitTarget);
        }
      },
    });

    registerProvider({
      types: ["brick"],
      getById: (id) => (id === brickTarget.id ? brickTarget : null),
      findNearest: () => brickTarget,
      findInRadius: (position, radius) =>
        distanceTo(position, brickTarget.position) <= radius ? [brickTarget] : [],
      forEachInRadius: (position, radius, visitor) => {
        if (distanceTo(position, brickTarget.position) <= radius) {
          visitor(brickTarget);
        }
      },
    });

    let brickDamage = 0;
    const bricksStub = {
      applyDamage: (_id: string, damage: number) => {
        brickDamage += damage;
        return { destroyed: false, brick: null, inflictedDamage: damage };
      },
    } as unknown as BricksModule;

    const damage = new DamageService({ bricks: () => bricksStub, targeting });
    const projectiles = new UnitProjectileController({ scene, targeting, damage });

    projectiles.spawn({
      origin: { x: 0, y: 0 },
      direction: { x: 1, y: 0 },
      damage: 5,
      rewardMultiplier: 1,
      armorPenetration: 0,
      visual: { radius: 3, speed: 60, lifetimeMs: 1000, fill: SOLID_FILL },
    });

    projectiles.tick(1000);

    assert.strictEqual(brickDamage, 5, "projectile should hit the brick instead of the nearby unit");
  });
});

function distanceTo(a: SceneVector2, b: SceneVector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
