import assert from "assert";
import {
  CUSTOM_DATA_KIND_PARTICLE_SYSTEM,
  FILL_TYPES,
  ParticleSystemCustomData,
  SceneObjectManager,
} from "../src/logic/services/SceneObjectManager";
import { ExplosionModule } from "../src/logic/modules/ExplosionModule";
import { getExplosionConfig } from "../src/db/explosions-db";
import { describe, test } from "./testRunner";

describe("ExplosionModule", () => {
  test("spawnExplosionByType applies database defaults", () => {
    const scene = new SceneObjectManager();
    const module = new ExplosionModule({ scene });

    module.spawnExplosionByType("magnetic", { position: { x: 10, y: 20 } });

    const objects = scene.getObjects();
    assert.strictEqual(objects.length, 1);
    const explosion = objects[0];
    assert(explosion, "Explosion should be present in the scene");

    const config = getExplosionConfig("magnetic");
    const fill = explosion.data.fill;
    assert.strictEqual(fill.fillType, FILL_TYPES.RADIAL_GRADIENT);
    assert.strictEqual(fill.stops.length, config.wave.gradientStops.length);

    const expectedAlpha = Math.min(
      1,
      (config.wave.gradientStops[0]?.color.a ?? 1) * config.wave.startAlpha
    );
    const firstStop = fill.stops[0];
    assert(firstStop, "Explosion wave should have a first stop");
    assert.strictEqual(firstStop.color.a, expectedAlpha);

    const customData = explosion.data.customData as ParticleSystemCustomData | undefined;
    assert(customData, "Explosion should include particle system custom data");
    assert.strictEqual(customData.kind, CUSTOM_DATA_KIND_PARTICLE_SYSTEM);
    assert.deepStrictEqual(customData.color, config.emitter.color);

    assert.strictEqual(explosion.data.size?.width, config.defaultInitialRadius * 2);
    assert.strictEqual(explosion.data.size?.height, config.defaultInitialRadius * 2);
  });

  test("spawnExplosionByType respects explicit radius overrides", () => {
    const scene = new SceneObjectManager();
    const module = new ExplosionModule({ scene });

    module.spawnExplosionByType("plasmoid", {
      position: { x: 0, y: 0 },
      initialRadius: 40,
    });

    const explosion = scene.getObjects()[0];
    assert(explosion, "Explosion should exist after spawning");
    assert.strictEqual(explosion.data.size?.width, 80);
    assert.strictEqual(explosion.data.size?.height, 80);

    const config = getExplosionConfig("plasmoid");
    const customData = explosion.data.customData as ParticleSystemCustomData | undefined;
    assert(customData, "Explosion should expose custom particle data");
    assert.deepStrictEqual(customData.color, config.emitter.color);
  });
});
