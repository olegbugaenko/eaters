import assert from "assert";
import { describe, test } from "./testRunner";
import { createParticleEmitterPrimitive } from "../src/ui/renderers/primitives/ParticleEmitterPrimitive";
import { FILL_TYPES, SceneObjectInstance } from "../src/logic/services/SceneObjectManager";

describe("ParticleEmitterPrimitive GPU enforcement", () => {
  test("skips CPU fallback when GPU context is unavailable and forceGpu is set", () => {
    const instance: SceneObjectInstance = {
      id: "fireball-1",
      type: "fireball",
      data: {
        position: { x: 0, y: 0 },
        fill: {
          fillType: FILL_TYPES.SOLID,
          color: { r: 1, g: 1, b: 1, a: 1 },
        },
      },
    } as SceneObjectInstance;

    const primitive = createParticleEmitterPrimitive(instance, {
      getConfig: () => ({
        particlesPerSecond: 10,
        particleLifetimeMs: 120,
        fadeStartMs: 60,
        sizeRange: { min: 1, max: 1 },
        offset: { x: 0, y: 0 },
        color: { r: 1, g: 1, b: 1, a: 1 },
        shape: "circle",
        capacity: 8,
      }),
      getOrigin: () => ({ x: 0, y: 0 }),
      spawnParticle: () => ({
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        ageMs: 0,
        lifetimeMs: 120,
        size: 1,
      }),
      forceGpu: true,
    });

    assert.strictEqual(primitive, null);
  });
});
