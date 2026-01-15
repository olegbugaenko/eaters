import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/core/logic/provided/services/scene-object-manager/SceneObjectManager";
import { FireballModule } from "../src/logic/modules/scene/fireball/fireball.module";
import type { ExplosionModule } from "../src/logic/modules/scene/explosion/explosion.module";
import type { BricksModule } from "../src/logic/modules/active-map/bricks/bricks.module";
import { UnitProjectileController } from "../src/logic/modules/active-map/projectiles/ProjectileController";
import { createDamageServiceStub } from "./testHelpers";

describe("FireballModule", () => {
  test("spawnFireball attaches trail and smoke emitter configs", () => {
    const scene = new SceneObjectManager();
    const explosions: Pick<ExplosionModule, "spawnExplosionByType"> = {
      spawnExplosionByType: () => undefined,
    };
    const bricks: Pick<
      BricksModule,
      "getBrickState" | "forEachBrickNear" | "applyDamage" | "findBricksNear"
    > = {
      getBrickState: (brickId) =>
        brickId === "target"
          ? ({
              id: "target",
              position: { x: 240, y: 180 },
              type: "basic",
              armor: 0,
              hp: 100,
              maxHp: 100,
              brickKnockBackDistance: 0,
              brickKnockBackSpeed: 0,
              brickKnockBackAmplitude: 0,
              baseDamage: 0,
              rewards: { gold: 0 } as any,
              physicalSize: 0,
              rotation: 0,
              level: 1,
            } as any)
          : null,
      forEachBrickNear: (_position, _radius, cb) => {
        cb({
          id: "target",
          position: { x: 240, y: 180 },
          physicalSize: 0,
          type: "basic" as any,
          armor: 0,
          hp: 100,
          maxHp: 100,
          brickKnockBackDistance: 0,
          brickKnockBackSpeed: 0,
          brickKnockBackAmplitude: 0,
          baseDamage: 0,
          rewards: { gold: 0 } as any,
          rotation: 0,
          level: 1,
        } as any);
      },
      applyDamage: () => ({ destroyed: false, brick: null, inflictedDamage: 0 }),
      findBricksNear: () => [],
    };

    const projectiles = {
      fireProjectile: () => {},
      tick: () => {},
      clear: () => {},
      spawn: (projectile: any) => {
        return scene.addObject("unitProjectile", {
          position: projectile.origin,
          size: { width: (projectile.visual?.radius ?? 10) * 2, height: (projectile.visual?.radius ?? 10) * 2 },
          fill: projectile.visual?.fill,
          customData: projectile.visual?.rendererCustomData ?? {},
        });
      },
    } as unknown as UnitProjectileController;

    const module = new FireballModule({
      scene,
      bricks: bricks as BricksModule,
      explosions: explosions as ExplosionModule,
      projectiles,
      damage: createDamageServiceStub(),
      logEvent: () => undefined,
    });

    module.spawnFireball({
      sourceUnitId: "unit-1",
      sourcePosition: { x: 120, y: 180 },
      targetBrickId: "target",
      damage: 42,
      explosionRadius: 40,
      maxDistance: 750,
    });

    const fireball = scene
      .getObjects()
      .find((instance: { type: string }) => instance.type === "unitProjectile");
    assert(fireball, "fireball should be rendered as a unit projectile");

    const customData = fireball.data
      .customData as Partial<{
        trailEmitter: unknown;
        smokeEmitter: unknown;
      }>;

    assert(customData?.trailEmitter, "trail emitter config should be present");
    assert(customData?.smokeEmitter, "smoke emitter config should be present");

    const trail = customData.trailEmitter as
      | { particlesPerSecond?: number; particleLifetimeMs?: number }
      | undefined;
    const smoke = customData.smokeEmitter as
      | { particlesPerSecond?: number; particleLifetimeMs?: number }
      | undefined;

    assert(trail, "trail emitter config should be structured");
    assert(smoke, "smoke emitter config should be structured");
    assert(
      typeof trail?.particlesPerSecond === "number" &&
        trail.particlesPerSecond > 0,
      "trail emitter should specify particle emission rate"
    );
    assert(
      typeof smoke?.particleLifetimeMs === "number" &&
        smoke.particleLifetimeMs > 0,
      "smoke emitter should specify particle lifetime"
    );
  });

  test("explosion uses DamageService area damage", () => {
    const scene = new SceneObjectManager();
    const explosions: Pick<ExplosionModule, "spawnExplosionByType"> = {
      spawnExplosionByType: () => undefined,
    };
    const bricks: Pick<BricksModule, "getBrickState"> = {
      getBrickState: (brickId) =>
        brickId === "target"
          ? ({
              id: "target",
              position: { x: 240, y: 180 },
              type: "basic",
              armor: 0,
              hp: 100,
              maxHp: 100,
              brickKnockBackDistance: 0,
              brickKnockBackSpeed: 0,
              brickKnockBackAmplitude: 0,
              baseDamage: 0,
              rewards: { gold: 0 } as any,
              physicalSize: 0,
              rotation: 0,
              level: 1,
            } as any)
          : null,
    };

    const projectiles = {
      tick: () => {},
      clear: () => {},
      spawn: (projectile: { onHit: (context: { brickId?: string; position: { x: number; y: number } }) => boolean }) => {
        projectile.onHit({ brickId: "target", position: { x: 240, y: 180 } });
        return scene.addObject("unitProjectile", {
          position: { x: 0, y: 0 },
          size: { width: 10, height: 10 },
          fill: undefined,
          customData: {},
        });
      },
    } as unknown as UnitProjectileController;

    const areaCalls: Array<{ radius: number; damage: number }> = [];
    const module = new FireballModule({
      scene,
      bricks: bricks as BricksModule,
      explosions: explosions as ExplosionModule,
      projectiles,
      damage: createDamageServiceStub({
        applyAreaDamage: (_position, radius, damage) => {
          areaCalls.push({ radius, damage });
        },
      }),
      logEvent: () => undefined,
    });

    module.spawnFireball({
      sourceUnitId: "unit-1",
      sourcePosition: { x: 120, y: 180 },
      targetBrickId: "target",
      damage: 42,
      explosionRadius: 40,
      maxDistance: 750,
    });

    assert.strictEqual(areaCalls.length, 1, "should apply area damage once");
    assert.strictEqual(areaCalls[0]?.radius, 40);
    assert.strictEqual(areaCalls[0]?.damage, 42);
  });
});
