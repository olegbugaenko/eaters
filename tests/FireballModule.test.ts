import assert from "assert";
import { describe, test } from "./testRunner";
import { SceneObjectManager } from "../src/logic/services/SceneObjectManager";
import { FireballModule } from "../src/logic/modules/scene/FireballModule";
import type { ExplosionModule } from "../src/logic/modules/scene/ExplosionModule";

describe("FireballModule", () => {
  test("spawnFireball attaches trail and smoke emitter configs", () => {
    const scene = new SceneObjectManager();
    const explosions: Pick<ExplosionModule, "spawnExplosionByType"> = {
      spawnExplosionByType: () => undefined,
    };

    const module = new FireballModule({
      scene,
      explosions: explosions as ExplosionModule,
      getBrickPosition: (brickId) =>
        brickId === "target" ? { x: 240, y: 180 } : null,
      damageBrick: () => undefined,
      getBricksInRadius: () => [],
      logEvent: () => undefined,
    });

    module.spawnFireball("unit-1", { x: 120, y: 180 }, "target", 42);

    const fireball = scene
      .getObjects()
      .find((instance) => instance.type === "fireball");
    assert(fireball, "fireball should be added to the scene");

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
});
