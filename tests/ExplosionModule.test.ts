import assert from "assert";
import { FILL_TYPES, SceneObjectManager } from "../src/logic/services/SceneObjectManager";
import {
  ExplosionModule,
  ExplosionRendererCustomData,
} from "../src/logic/modules/scene/ExplosionModule";
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
    const wave = config.waves?.[0] ?? config.wave;
    assert(wave, "Explosion wave configuration should be defined");
    const fill = explosion.data.fill;
    assert.strictEqual(fill.fillType, FILL_TYPES.RADIAL_GRADIENT);
    assert.strictEqual(fill.stops.length, wave.gradientStops.length);

    const expectedAlpha = Math.min(
      1,
      (wave.gradientStops[0]?.color.a ?? 1) * wave.startAlpha
    );
    const firstStop = fill.stops[0];
    assert(firstStop, "Explosion wave should have a first stop");
    assert.strictEqual(firstStop.color.a, expectedAlpha);

    const customData = explosion.data.customData as
      | ExplosionRendererCustomData
      | undefined;
    assert(customData, "Explosion should include emitter configuration");
    const emitter = customData.emitter;
    assert(emitter, "Explosion should expose emitter settings");
    assert.deepStrictEqual(emitter.color, config.emitter.color);
    assert.strictEqual(emitter.particlesPerSecond, config.emitter.particlesPerSecond);
    assert.strictEqual(emitter.particleLifetimeMs, config.emitter.particleLifetimeMs);
    assert.strictEqual(emitter.emissionDurationMs, config.emitter.emissionDurationMs);
    const expectedDefaultSpawnMax = Math.max(
      config.emitter.spawnRadius.max,
      config.emitter.spawnRadius.min,
      config.defaultInitialRadius * config.emitter.spawnRadiusMultiplier
    );
    assert.strictEqual(emitter.spawnRadius.max, expectedDefaultSpawnMax);

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
    const customData = explosion.data.customData as
      | ExplosionRendererCustomData
      | undefined;
    assert(customData, "Explosion should expose emitter data");
    const emitter = customData.emitter;
    assert(emitter, "Explosion should provide emitter configuration");
    assert.deepStrictEqual(emitter.color, config.emitter.color);
    const expectedSpawnMax = Math.max(
      config.emitter.spawnRadius.max,
      config.emitter.spawnRadius.min,
      40 * config.emitter.spawnRadiusMultiplier
    );
    assert.strictEqual(emitter.spawnRadius.max, expectedSpawnMax);
  });

  test("weaken curse waves support inner radius gradients", () => {
    const scene = new SceneObjectManager();
    const module = new ExplosionModule({ scene });

    module.spawnExplosionByType("weakenCurse", { position: { x: 0, y: 0 } });

    const objects = scene.getObjects();
    assert.strictEqual(objects.length, 2);

    const firstWave = objects[0]!;
    const firstConfig = getExplosionConfig("weakenCurse").waves?.[0];
    assert(firstConfig, "Weaken curse first wave should be configured");
    const firstWaveFill = firstWave.data.fill;
    assert.strictEqual(firstWaveFill.fillType, FILL_TYPES.RADIAL_GRADIENT);
    assert.strictEqual(
      (firstWaveFill as any).stops.length,
      firstConfig.gradientStops.length
    );
    assert(firstWaveFill.fibers, "First wave should propagate fiber settings");
    assert.strictEqual(firstWaveFill.fibers?.colorAmplitude, 0.12);
    assert.strictEqual(firstWaveFill.fibers?.density, 0.55);

    const secondWave = objects[1]!;
    assert.strictEqual(secondWave.data.size?.width, 40);
    assert.strictEqual(secondWave.data.size?.height, 40);

    const secondWaveFill = secondWave.data.fill;
    assert.strictEqual(secondWaveFill.fillType, FILL_TYPES.RADIAL_GRADIENT);
    const firstStop = secondWaveFill.stops[0];
    assert(firstStop, "Second wave should start with a transparent stop");
    assert.strictEqual(firstStop.color.a, 0);
    const innerGapStop = secondWaveFill.stops.find((stop) => stop.offset === 0.5);
    assert(innerGapStop, "Inner radius stop should be present");
    assert.strictEqual(innerGapStop.color.a, 0);
    const firstColoredStop = secondWaveFill.stops.find(
      (stop) => (stop.color.a ?? 1) > 0
    );
    assert(firstColoredStop, "Gradient should resume after the inner radius");
    assert(firstColoredStop.offset >= 0.5);
    assert(secondWaveFill.fibers, "Second wave should include fiber data");
    assert.strictEqual(secondWaveFill.fibers?.alphaAmplitude, 0.12);
    assert.strictEqual(secondWaveFill.fibers?.width, 0.5);
  });
});
