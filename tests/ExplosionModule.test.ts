import assert from "assert";
import { FILL_TYPES } from "../src/core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { SceneObjectManager } from "../src/core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { SceneRadialGradientFill } from "../src/core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  ExplosionModule,
  ExplosionRendererCustomData,
} from "../src/logic/modules/scene/explosion/explosion.module";
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
    assert(fill.fillType === FILL_TYPES.RADIAL_GRADIENT, "fill should be radial gradient");
    const radialFill = fill as SceneRadialGradientFill;
    const wave = config.waves[0]!;
    assert.strictEqual(radialFill.stops.length, wave.gradientStops.length);

    const expectedAlpha = wave.gradientStops[0]?.color.a ?? 1;
    const firstStop = radialFill.stops[0];
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
    if (!config.emitter.spawnRadius || typeof config.emitter.spawnRadiusMultiplier !== "number") {
      throw new Error("config should have spawnRadius and spawnRadiusMultiplier");
    }
    const expectedDefaultSpawnMax = Math.max(
      config.emitter.spawnRadius.max,
      config.emitter.spawnRadius.min,
      config.defaultInitialRadius * config.emitter.spawnRadiusMultiplier
    );
    if (!emitter.spawnRadius) {
      throw new Error("emitter should have spawnRadius");
    }
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
    if (!config.emitter.spawnRadius || typeof config.emitter.spawnRadiusMultiplier !== "number") {
      throw new Error("config should have spawnRadius and spawnRadiusMultiplier");
    }
    const expectedSpawnMax = Math.max(
      config.emitter.spawnRadius.max,
      config.emitter.spawnRadius.min,
      40 * config.emitter.spawnRadiusMultiplier
    );
    if (!emitter.spawnRadius) {
      throw new Error("emitter should have spawnRadius");
    }
    assert.strictEqual(emitter.spawnRadius.max, expectedSpawnMax);
  });

  test("simulation pause advances only flagged explosions", () => {
    const flaggedScene = new SceneObjectManager();
    const flaggedModule = new ExplosionModule({ scene: flaggedScene });
    flaggedModule.spawnExplosionByType("mapVictoryWave", {
      position: { x: 30, y: 40 },
    });

    const flaggedBefore = flaggedScene
      .getObjects()
      .map((object) => ({ id: object.id, width: object.data.size?.width ?? 0 }));

    flaggedModule.tickInPauseMode?.(100, "simulation");

    const flaggedAfter = flaggedScene.getObjects();
    assert.strictEqual(flaggedAfter.length, flaggedBefore.length);
    assert(
      flaggedAfter.some((object, index) => object.data.size?.width !== flaggedBefore[index]?.width),
      "completion explosions should keep expanding during simulation pause"
    );

    const regularScene = new SceneObjectManager();
    const regularModule = new ExplosionModule({ scene: regularScene });
    regularModule.spawnExplosionByType("plasmoid", {
      position: { x: 30, y: 40 },
    });

    const regularBefore = regularScene
      .getObjects()
      .map((object) => ({ id: object.id, width: object.data.size?.width ?? 0 }));

    regularModule.tickInPauseMode?.(100, "simulation");

    const regularAfter = regularScene.getObjects();
    assert.strictEqual(regularAfter.length, regularBefore.length);
    assert(
      regularAfter.every((object, index) => object.data.size?.width === regularBefore[index]?.width),
      "regular explosions should stay frozen during simulation pause"
    );
  });
});
