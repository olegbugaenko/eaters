import assert from "assert";
import { FILL_TYPES } from "../src/logic/services/scene-object-manager/scene-object-manager.const";
import { SceneObjectManager } from "../src/logic/services/scene-object-manager/SceneObjectManager";
import type { SceneRadialGradientFill } from "../src/logic/services/scene-object-manager/scene-object-manager.types";
import { BulletModule } from "../src/logic/modules/active-map/bullet/bullet.module";
import { ExplosionModule, SpawnExplosionByTypeOptions } from "../src/logic/modules/scene/explosion/explosion.module";
import { getBulletConfig } from "../src/db/bullets-db";
import { ExplosionType } from "../src/db/explosions-db";
import { describe, test } from "./testRunner";
import { MapRunState } from "../src/logic/modules/active-map/map/MapRunState";

class ExplosionStub implements Pick<ExplosionModule, "spawnExplosionByType"> {
  public readonly calls: Array<{
    type: ExplosionType;
    options: SpawnExplosionByTypeOptions;
  }> = [];

  public spawnExplosionByType(
    type: ExplosionType,
    options: SpawnExplosionByTypeOptions
  ): void {
    this.calls.push({ type, options });
  }
}

describe("BulletModule", () => {
  test("spawnBulletByType uses database-driven fill and tail data", () => {
    const scene = new SceneObjectManager();
    const explosions = new ExplosionStub();
    const runState = new MapRunState();
    runState.start();
    const module = new BulletModule({
      scene,
      explosions: explosions as unknown as ExplosionModule,
      runState,
    });

    const id = module.spawnBulletByType("plasmoid", {
      position: { x: 100, y: 200 },
      directionAngle: 0,
    });

    const instance = scene.getObject(id);
    assert(instance, "Bullet should be registered in the scene");

    const config = getBulletConfig("plasmoid");
    const fill = instance.data.fill;
    assert.strictEqual(fill.fillType, FILL_TYPES.RADIAL_GRADIENT);
    if (fill.fillType !== FILL_TYPES.RADIAL_GRADIENT) {
      throw new Error("fill should be radial gradient");
    }
    const radialFill = fill as SceneRadialGradientFill;
    assert.strictEqual(radialFill.stops.length, config.gradientStops.length);

    radialFill.stops.forEach((stop, index) => {
      const expected = config.gradientStops[index];
      assert(expected, "Expected gradient stop to exist");
      assert.strictEqual(stop.offset, expected.offset);
      assert.deepStrictEqual(stop.color, expected.color);
    });

    const customData = instance.data.customData as { tail?: unknown } | undefined;
    assert(customData && customData.tail, "Bullet custom data should include tail config");

    const tail = customData.tail as { startColor: unknown; endColor: unknown };
    assert.deepStrictEqual(tail.startColor, config.tail.startColor);
    assert.deepStrictEqual(tail.endColor, config.tail.endColor);
  });

  test("magnetic bullets carry tail emitter configuration", () => {
    const scene = new SceneObjectManager();
    const explosions = new ExplosionStub();
    const runState = new MapRunState();
    runState.start();
    const module = new BulletModule({
      scene,
      explosions: explosions as unknown as ExplosionModule,
      runState,
    });

    const id = module.spawnBulletByType("magnetic", {
      position: { x: 25, y: 50 },
      directionAngle: Math.PI / 4,
    });

    const instance = scene.getObject(id);
    assert(instance, "Magnetic bullet should exist in the scene");

    const customData = instance.data.customData as { tailEmitter?: unknown } | undefined;
    assert(customData && customData.tailEmitter, "Magnetic bullet should include tail emitter config");

    const tailEmitter = customData.tailEmitter;
    const config = getBulletConfig("magnetic");
    assert(config.tailEmitter, "Magnetic config should define tail emitter settings");
    assert.deepStrictEqual(tailEmitter, config.tailEmitter);
  });

  test("spawnBulletByType triggers explosion based on bullet type", () => {
    const scene = new SceneObjectManager();
    const explosions = new ExplosionStub();
    const runState = new MapRunState();
    runState.start();
    const module = new BulletModule({
      scene,
      explosions: explosions as unknown as ExplosionModule,
      runState,
    });

    const id = module.spawnBulletByType("magnetic", {
      position: { x: 0, y: 0 },
      directionAngle: 0,
      lifetimeMs: 0,
    });

    const updater = module as unknown as { updateBullets(deltaMs: number): void };
    updater.updateBullets(16);

    assert.strictEqual(explosions.calls.length, 1);
    const [call] = explosions.calls;
    assert(call, "Explosion should have been triggered");
    assert.strictEqual(call.type, "magnetic");
    assert(Math.abs(call.options.position.x) < 2, "explosion should occur near the spawn point");
    assert.strictEqual(call.options.position.y, 0);
    assert.strictEqual(call.options.initialRadius, getBulletConfig("magnetic").diameter / 2);
  });

  test("spawnBulletByType respects bullets without explosion types", () => {
    const scene = new SceneObjectManager();
    const explosions = new ExplosionStub();
    const runState = new MapRunState();
    runState.start();
    const module = new BulletModule({
      scene,
      explosions: explosions as unknown as ExplosionModule,
      runState,
    });

    module.spawnBulletByType("mechanical", {
      position: { x: 0, y: 0 },
      directionAngle: 0,
      lifetimeMs: 0,
    });

    const updater = module as unknown as { updateBullets(deltaMs: number): void };
    updater.updateBullets(0);

    assert.strictEqual(explosions.calls.length, 0);
  });
});
