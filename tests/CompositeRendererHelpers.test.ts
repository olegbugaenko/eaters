import assert from "assert";
import { describe, test } from "./testRunner";
import {
  clampHueShift,
  clampSaturationShift,
  sanitizeCompositeFillConfig,
  sanitizeCompositeStrokeConfig,
  resolveCompositeLayerFill,
} from "../src/ui/renderers/objects/shared/composite-renderer-helpers";
import { SceneObjectManager } from "../src/core/logic/provided/services/scene-object-manager/SceneObjectManager";

describe("CompositeRenderer color transform", () => {
  test("normalizes hue and saturation shifts for base fill", () => {
    const fill = sanitizeCompositeFillConfig({
      type: "base",
      brightness: 0.2,
      hueShift: 1.6,
      saturationShift: 2,
      alphaMultiplier: 2,
    });

    assert.strictEqual(fill.kind, "base");
    if (fill.kind !== "base") {
      return;
    }
    assert.strictEqual(fill.brightnessShift, 0.2);
    assert(Math.abs((fill.hueShift ?? 0) - (-0.4)) < 1e-9);
    assert.strictEqual(fill.saturationShift, 1);
    assert.strictEqual(fill.alphaMultiplier, 1);
  });

  test("supports brightnessShift alias and stroke sanitization", () => {
    const fill = sanitizeCompositeFillConfig({
      type: "base",
      brightness: 0.1,
      brightnessShift: -0.25,
    });
    assert.strictEqual(fill.kind, "base");
    if (fill.kind !== "base") {
      return;
    }
    assert.strictEqual(fill.brightnessShift, -0.25);
    assert.strictEqual(fill.brightness, -0.25);

    const stroke = sanitizeCompositeStrokeConfig({
      type: "base",
      width: 2,
      brightnessShift: 0.3,
      hueShift: -1.2,
      saturationShift: -3,
    });
    assert(stroke && stroke.kind === "base");
    if (!stroke || stroke.kind !== "base") {
      return;
    }
    assert.strictEqual(stroke.brightnessShift, 0.3);
    assert(Math.abs((stroke.hueShift ?? 0) - (-0.2)) < 1e-9);
    assert.strictEqual(stroke.saturationShift, -1);
  });

  test("attaches colorTransform payload when resolving base layer fill", () => {
    const scene = new SceneObjectManager();
    const id = scene.addObject("test", {
      position: { x: 0, y: 0 },
      fill: { fillType: 0, color: { r: 0.3, g: 0.4, b: 0.5, a: 1 } },
    });
    const instance = scene.getObjects().find((object) => object.id === id);
    assert(instance);

    const resolved = resolveCompositeLayerFill(
      instance!,
      {
        kind: "base",
        brightnessShift: 0.2,
        hueShift: 0.15,
        saturationShift: -0.3,
        alphaMultiplier: 0.8,
      },
      { baseFillColor: { r: 0.2, g: 0.2, b: 0.2, a: 1 } }
    );

    assert(resolved.colorTransform);
    assert.strictEqual(resolved.colorTransform?.brightnessShift, 0.2);
    assert(Math.abs((resolved.colorTransform?.hueShift ?? 0) - 0.15) < 1e-9);
    assert.strictEqual(resolved.colorTransform?.saturationShift, -0.3);
    assert.strictEqual(resolved.colorTransform?.alphaMultiplier, 0.8);
  });

  test("clamp helpers provide safe defaults", () => {
    assert.strictEqual(clampHueShift(undefined), 0);
    assert.strictEqual(clampSaturationShift(undefined), 0);
  });
});
