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

    assert.strictEqual(mapped.brightness, -0.25);
    assert.strictEqual(mapped.brightnessShift, -0.25);
    assert(Math.abs((mapped.hueShift ?? 0) - (-0.4)) < 1e-9);
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
    assert.strictEqual(mapped.brightness, 0.22);
    assert.strictEqual(mapped.brightnessShift, 0.22);
    assert(Math.abs((mapped.hueShift ?? 0) - 0.2) < 1e-9);
    assert.strictEqual(mapped.saturationShift, -0.5);
    assert.strictEqual(mapped.alphaMultiplier, 0.65);
  });

  test("maps base fill/stroke colorAnimation payload", () => {
    const fillMapped = toLayerFill({
      type: "base",
      colorAnimation: {
        interval: 1000,
        keyframes: [
          { time: 0, deltaHue: 0.1, deltaSaturation: -0.2, deltaBrightness: 0.3 },
          { time: 0.5, rgba: [0.8, 0.7, 0.6, 0.5] },
        ],
      },
    });

    assert.strictEqual(fillMapped.kind, "base");
    if (fillMapped.kind === "base") {
      assert.strictEqual(fillMapped.colorAnimation?.interval, 1000);
      assert.strictEqual(fillMapped.colorAnimation?.keyframes.length, 2);
    }

    const strokeMapped = toLayerStroke({
      type: "base",
      width: 1,
      colorAnimation: {
        interval: 750,
        keyframes: [{ time: 0.25, deltaBrightness: -0.1 }],
      },
    });

    assert.strictEqual(strokeMapped.kind, "base");
    if (strokeMapped.kind === "base") {
      assert.strictEqual(strokeMapped.colorAnimation?.interval, 750);
      assert.strictEqual(strokeMapped.colorAnimation?.keyframes.length, 1);
    }
  });

});
