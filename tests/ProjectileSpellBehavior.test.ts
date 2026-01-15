import assert from "assert";
import { describe, test } from "./testRunner";
import { ProjectileSpellBehavior } from "../src/logic/modules/active-map/spellcasting/implementations/ProjectileSpellBehavior";
import type { SpellConfig } from "../src/db/spells-db";
import { SceneObjectManager } from "../src/core/logic/provided/services/scene-object-manager/SceneObjectManager";
import { FILL_TYPES } from "../src/core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { BricksModule } from "../src/logic/modules/active-map/bricks/bricks.module";
import type { ExplosionModule } from "../src/logic/modules/scene/explosion/explosion.module";
import type { SpellBehaviorDependencies } from "../src/logic/modules/active-map/spellcasting/SpellBehavior";
import type { UnitProjectileController } from "../src/logic/modules/active-map/projectiles/ProjectileController";
import { createDamageServiceStub } from "./testHelpers";

class FakeProjectiles {
  public spawned = 0;
  public lastOnHit: ((context: { brickId?: string; position: { x: number; y: number } }) => boolean) | null = null;
  public spawn(): string {
    this.spawned += 1;
    return `projectile-${this.spawned}`;
  }
  public spawnWithHandlers(options: { onHit: (context: { brickId?: string; position: { x: number; y: number } }) => boolean }): string {
    this.lastOnHit = options.onHit;
    return this.spawn();
  }
  public tick(): void {}
  public clear(): void {}
  public cleanupExpired(): void {}
}

describe("ProjectileSpellBehavior", () => {
  test("spawns projectile series over multiple ticks", () => {
    const scene = new SceneObjectManager();
    const projectilesSpy = new FakeProjectiles();
    const projectiles = projectilesSpy as unknown as UnitProjectileController;
    const bricks = {
      applyDamage: () => ({ destroyed: false, brick: null, inflictedDamage: 0 }),
      forEachBrickNear: () => {},
    } as unknown as BricksModule;

    const dependencies: SpellBehaviorDependencies = {
      scene,
      bricks,
      bonuses: {},
      projectiles,
      explosions: {} as ExplosionModule,
      damage: createDamageServiceStub(),
      getSpellPowerMultiplier: () => 1,
    };

    const behavior = new ProjectileSpellBehavior(dependencies);

    const config: SpellConfig = {
      id: "magic-arrow",
      type: "projectile",
      name: "Magic Arrow",
      description: "test",
      cost: { mana: 0, sanity: 0 },
      cooldownSeconds: 1,
      damage: { min: 1, max: 2 },
      projectile: {
        radius: 4,
        speed: 100,
        lifetimeMs: 1000,
        fill: {
          fillType: FILL_TYPES.SOLID,
          color: { r: 1, g: 1, b: 1, a: 1 },
        },
        tail: {
          lengthMultiplier: 1,
          widthMultiplier: 1,
          startColor: { r: 1, g: 1, b: 1, a: 1 },
          endColor: { r: 1, g: 1, b: 1, a: 1 },
        },
        attackSeries: {
          shots: 3,
          intervalMs: 100,
        },
      },
    };

    behavior.cast({
      spellId: "magic-arrow",
      config,
      origin: { x: 0, y: 0 },
      target: { x: 10, y: 0 },
      direction: { x: 1, y: 0 },
      spellPowerMultiplier: 1,
    });

    assert.strictEqual(projectilesSpy.spawned, 1, "should spawn first projectile immediately");

    behavior.tick(50);
    assert.strictEqual(projectilesSpy.spawned, 1, "should wait for series interval");

    behavior.tick(50);
    assert.strictEqual(projectilesSpy.spawned, 2, "should spawn second projectile after interval");

    behavior.tick(100);
    assert.strictEqual(projectilesSpy.spawned, 3, "should spawn final projectile in series");
  });

  test("routes projectile damage through DamageService for direct and splash hits", () => {
    const scene = new SceneObjectManager();
    const projectilesSpy = new FakeProjectiles();
    const projectiles = {
      spawn: (config: { onHit: (context: { brickId?: string; position: { x: number; y: number } }) => boolean }) =>
        projectilesSpy.spawnWithHandlers(config),
      tick: () => {},
      clear: () => {},
      cleanupExpired: () => {},
    } as unknown as UnitProjectileController;

    const damageCalls: Array<{ targetId: string; amount: number }> = [];
    const areaCalls: Array<{ radius: number; amount: number; excludeTargetIds?: readonly string[] }> = [];
    const dependencies: SpellBehaviorDependencies = {
      scene,
      bricks: {} as BricksModule,
      bonuses: {},
      projectiles,
      explosions: {} as ExplosionModule,
      damage: createDamageServiceStub({
        applyTargetDamage: (targetId, amount) => {
          damageCalls.push({ targetId, amount });
          return amount;
        },
        applyAreaDamage: (_position, radius, amount, options) => {
          areaCalls.push({ radius, amount, excludeTargetIds: options?.excludeTargetIds });
        },
      }),
      getSpellPowerMultiplier: () => 1,
    };

    const behavior = new ProjectileSpellBehavior(dependencies);
    const config: SpellConfig = {
      id: "magic-arrow",
      type: "projectile",
      name: "Magic Arrow",
      description: "test",
      cost: { mana: 0, sanity: 0 },
      cooldownSeconds: 1,
      damage: { min: 10, max: 10 },
      projectile: {
        radius: 4,
        speed: 100,
        lifetimeMs: 1000,
        fill: {
          fillType: FILL_TYPES.SOLID,
          color: { r: 1, g: 1, b: 1, a: 1 },
        },
        tail: {
          lengthMultiplier: 1,
          widthMultiplier: 1,
          startColor: { r: 1, g: 1, b: 1, a: 1 },
          endColor: { r: 1, g: 1, b: 1, a: 1 },
        },
        aoe: { radius: 20, splash: 0.5 },
      },
    };

    behavior.cast({
      spellId: "magic-arrow",
      config,
      origin: { x: 0, y: 0 },
      target: { x: 10, y: 0 },
      direction: { x: 1, y: 0 },
      spellPowerMultiplier: 1,
    });

    assert(projectilesSpy.lastOnHit, "expected onHit handler");
    projectilesSpy.lastOnHit?.({ brickId: "brick-1", position: { x: 5, y: 5 } });

    assert.strictEqual(damageCalls.length, 1, "should apply direct damage once");
    assert.strictEqual(damageCalls[0]?.targetId, "brick-1");
    assert.strictEqual(areaCalls.length, 1, "should apply splash damage");
    assert.deepStrictEqual(areaCalls[0]?.excludeTargetIds, ["brick-1"]);
    assert.strictEqual(areaCalls[0]?.amount, 5);
  });
});
