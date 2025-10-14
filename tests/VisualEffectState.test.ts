import assert from "assert";
import { describe, test } from "./testRunner";
import {
  computeVisualEffectFillColor,
  computeVisualEffectSizeMultiplier,
  createVisualEffectState,
  setVisualEffectFillOverlay,
  setVisualEffectSizeMultiplier,
} from "../src/logic/visuals/VisualEffectState";

const assertClose = (actual: number, expected: number, epsilon = 1e-6) => {
  assert(Math.abs(actual - expected) <= epsilon, `${actual} is not close to ${expected}`);
};

describe("VisualEffectState", () => {
  test("blends tint overlays in priority order", () => {
    const state = createVisualEffectState();
    const baseColor = { r: 0.2, g: 0.4, b: 0.8, a: 1 };

    const changedHeat = setVisualEffectFillOverlay(state, "heat", {
      color: { r: 1, g: 0, b: 0, a: 1 },
      intensity: 0.5,
      priority: 0,
    });
    assert.strictEqual(changedHeat, true);

    const changedPoison = setVisualEffectFillOverlay(state, "poison", {
      color: { r: 0, g: 1, b: 0, a: 1 },
      intensity: 0.25,
      priority: 100,
    });
    assert.strictEqual(changedPoison, true);

    const result = computeVisualEffectFillColor(baseColor, state);
    assertClose(result.r, 0.45, 1e-3);
    assertClose(result.g, 0.4, 1e-3);
    assertClose(result.b, 0.3, 1e-3);
    assertClose(result.a ?? 1, 1, 1e-6);
  });

  test("supports additive overlays", () => {
    const state = createVisualEffectState();
    const baseColor = { r: 0.2, g: 0.3, b: 0.4, a: 1 };

    setVisualEffectFillOverlay(state, "glow", {
      color: { r: 0.4, g: 0.1, b: 0, a: 0.5 },
      intensity: 0.5,
      blendMode: "add",
    });

    const result = computeVisualEffectFillColor(baseColor, state);
    assertClose(result.r, 0.4, 1e-3);
    assertClose(result.g, 0.35, 1e-3);
    assertClose(result.b, 0.4, 1e-3);
    assertClose(result.a ?? 1, 1, 1e-6);
  });

  test("removes overlays when cleared", () => {
    const state = createVisualEffectState();
    const baseColor = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

    setVisualEffectFillOverlay(state, "heat", {
      color: { r: 1, g: 0, b: 0, a: 1 },
      intensity: 0.75,
    });
    const tinted = computeVisualEffectFillColor(baseColor, state);
    assert(Math.abs(tinted.r - baseColor.r) > 1e-3, "overlay should tint the base color");

    const removed = setVisualEffectFillOverlay(state, "heat", null);
    assert.strictEqual(removed, true);
    assert.strictEqual(state.fillOverlays.size, 0);

    const reset = computeVisualEffectFillColor(baseColor, state);
    assertClose(reset.r, baseColor.r, 1e-6);
    assertClose(reset.g, baseColor.g, 1e-6);
    assertClose(reset.b, baseColor.b, 1e-6);
  });

  test("combines size multipliers", () => {
    const state = createVisualEffectState();

    const first = setVisualEffectSizeMultiplier(state, "enlarge", 1.2);
    assert.strictEqual(first, true);

    const second = setVisualEffectSizeMultiplier(state, "shrink", 0.9);
    assert.strictEqual(second, true);

    const multiplier = computeVisualEffectSizeMultiplier(state);
    assertClose(multiplier, 1.08, 1e-6);

    const removed = setVisualEffectSizeMultiplier(state, "enlarge", 1);
    assert.strictEqual(removed, true);
    const afterRemoval = computeVisualEffectSizeMultiplier(state);
    assertClose(afterRemoval, 0.9, 1e-6);
  });
});
