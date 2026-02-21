import assert from "assert";
import { describe, test } from "./testRunner";
import { toLayerFill, toLayerStroke } from "../src/ui/renderers/objects/implementations/enemy/octopus-tentacle-primitives";

describe("Octopus tentacle fill/stroke mapping", () => {
  test("maps base fill hue/saturation/brightness shifts", () => {
    const mapped = toLayerFill({
      type: "base",
      brightness: 0.1,
      brightnessShift: -0.25,
      hueShift: -0.4,
      saturationShift: 0.35,
      alphaMultiplier: 0.8,
    });

    assert.strictEqual(mapped.kind, "base");
    if (mapped.kind !== "base") {
      return;
    }

    assert.strictEqual(mapped.brightness, 0.1);
    assert.strictEqual(mapped.brightnessShift, -0.25);
    assert.strictEqual(mapped.hueShift, -0.4);
    assert.strictEqual(mapped.saturationShift, 0.35);
    assert.strictEqual(mapped.alphaMultiplier, 0.8);
  });

  test("maps base stroke hue/saturation/brightness shifts", () => {
    const mapped = toLayerStroke({
      type: "base",
      width: 1.2,
      brightness: -0.1,
      brightnessShift: 0.22,
      hueShift: 0.2,
      saturationShift: -0.5,
      alphaMultiplier: 0.65,
    });

    assert.strictEqual(mapped.kind, "base");
    if (mapped.kind !== "base") {
      return;
    }

    assert.strictEqual(mapped.width, 1.2);
    assert.strictEqual(mapped.brightness, -0.1);
    assert.strictEqual(mapped.brightnessShift, 0.22);
    assert.strictEqual(mapped.hueShift, 0.2);
    assert.strictEqual(mapped.saturationShift, -0.5);
    assert.strictEqual(mapped.alphaMultiplier, 0.65);
  });
});
