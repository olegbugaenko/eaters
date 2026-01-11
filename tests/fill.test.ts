import assert from "assert";
import {
  SceneLinearGradientFill,
  SceneRadialGradientFill,
} from "../src/core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "../src/core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import {
  FILL_COMPONENTS,
  FILL_INFO_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  FILL_FILAMENTS_COMPONENTS,
  MAX_GRADIENT_STOPS,
  STOP_COLOR_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
} from "../src/ui/renderers/objects/ObjectRenderer";
import { createFillVertexComponents } from "../src/ui/renderers/primitives/utils/fill";
import { describe, test } from "./testRunner";

const readComponent = (source: Float32Array, index: number): number => {
  const value = source[index];
  if (value === undefined) {
    throw new Error(`Component at index ${index} is undefined`);
  }
  return value;
};

const assertArrayClose = (
  actual: number[],
  expected: number[],
  epsilon = 0.0001
): void => {
  if (actual.length !== expected.length) {
    throw new Error(
      `Mismatched array lengths: ${actual.length} !== ${expected.length}`
    );
  }
  actual.forEach((value, index) => {
    const expectedValue = expected[index];
    if (expectedValue === undefined) {
      throw new Error(`Missing expected value at index ${index}`);
    }
    assert(Math.abs(value - expectedValue) < epsilon);
  });
};

describe("createFillVertexComponents", () => {
  test("computes linear gradient parameters with rotation", () => {
    const fill: SceneLinearGradientFill = {
      fillType: FILL_TYPES.LINEAR_GRADIENT,
      start: { x: -10, y: 0 },
      end: { x: 10, y: 0 },
      stops: [
        { offset: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { offset: 0.5, color: { r: 0, g: 1, b: 0, a: 1 } },
        { offset: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
      ],
    };

    const components = createFillVertexComponents({
      fill,
      center: { x: 5, y: 5 },
      rotation: Math.PI / 2,
      size: { width: 20, height: 10 },
    });

    assert.strictEqual(components.length, FILL_COMPONENTS);
    assert.strictEqual(components[0], FILL_TYPES.LINEAR_GRADIENT);
    assert.strictEqual(components[1], 3);

    const params0Offset = FILL_INFO_COMPONENTS;
    const params1Offset = params0Offset + FILL_PARAMS0_COMPONENTS;
    const filamentsOffset = params1Offset + FILL_PARAMS1_COMPONENTS;
    const offsetsOffset = filamentsOffset + FILL_FILAMENTS_COMPONENTS;
    const colorsOffset = offsetsOffset + STOP_OFFSETS_COMPONENTS;

    const startX = readComponent(components, params0Offset + 0);
    const startY = readComponent(components, params0Offset + 1);
    const endX = readComponent(components, params0Offset + 2);
    const endY = readComponent(components, params0Offset + 3);
    const dirX = readComponent(components, params1Offset + 0);
    const dirY = readComponent(components, params1Offset + 1);
    const invLenSq = readComponent(components, params1Offset + 2);

    assert(Math.abs(startX - 5) < 0.0001);
    assert(Math.abs(startY + 5) < 0.0001);
    assert(Math.abs(endX - 5) < 0.0001);
    assert(Math.abs(endY - 15) < 0.0001);
    assert(Math.abs(dirX - 0) < 0.0001);
    assert(Math.abs(dirY - 20) < 0.0001);
    assert(Math.abs(invLenSq - 0.0025) < 0.0001);

    const offsets = Array.from(
      components.slice(offsetsOffset, offsetsOffset + STOP_OFFSETS_COMPONENTS)
    );
    const [offset0, offset1, offset2] = offsets;
    if (
      offset0 === undefined ||
      offset1 === undefined ||
      offset2 === undefined
    ) {
      throw new Error("Unexpected stop offsets length");
    }
    assert(Math.abs(offset0 - 0) < 0.0001);
    assert(Math.abs(offset1 - 0.5) < 0.0001);
    assert(Math.abs(offset2 - 1) < 0.0001);

    for (let i = 0; i < MAX_GRADIENT_STOPS; i += 1) {
      const colorStart = colorsOffset + i * STOP_COLOR_COMPONENTS;
      const color = Array.from(
        components.slice(colorStart, colorStart + STOP_COLOR_COMPONENTS)
      );
      assertArrayClose(color, [
        fill.stops[i]!.color.r,
        fill.stops[i]!.color.g,
        fill.stops[i]!.color.b,
        fill.stops[i]!.color.a ?? 1,
      ]);
    }
  });

  test("limits stops and resolves radial gradient defaults", () => {
    const fill: SceneRadialGradientFill = {
      fillType: FILL_TYPES.RADIAL_GRADIENT,
      start: { x: 10, y: 0 },
      end: undefined,
      stops: [
        { offset: 0, color: { r: 0, g: 0, b: 0, a: 1 } },
        { offset: 0.2, color: { r: 0.2, g: 0.2, b: 0.2, a: 1 } },
        { offset: 0.4, color: { r: 0.4, g: 0.4, b: 0.4, a: 1 } },
        { offset: 0.6, color: { r: 0.6, g: 0.6, b: 0.6, a: 1 } },
        { offset: 1, color: { r: 1, g: 1, b: 1, a: 1 } },
      ],
    };

    const components = createFillVertexComponents({
      fill,
      center: { x: 1, y: 2 },
      rotation: Math.PI / 2,
      size: { width: 30, height: 20 },
      radius: 12,
    });

    const params0Offset = FILL_INFO_COMPONENTS;
    const offsetsOffset =
      params0Offset +
      FILL_PARAMS0_COMPONENTS +
      FILL_PARAMS1_COMPONENTS +
      FILL_FILAMENTS_COMPONENTS;
    const colorsOffset = offsetsOffset + STOP_OFFSETS_COMPONENTS;

    assert.strictEqual(components[0], FILL_TYPES.RADIAL_GRADIENT);
    assert.strictEqual(components[1], MAX_GRADIENT_STOPS);

    const centerX = readComponent(components, params0Offset + 0);
    const centerY = readComponent(components, params0Offset + 1);
    const radius = readComponent(components, params0Offset + 2);
    assert(Math.abs(centerX - 1) < 0.0001);
    assert(Math.abs(centerY - 12) < 0.0001);
    assert(Math.abs(radius - 12) < 0.0001);

    const offsets = Array.from(
      components.slice(offsetsOffset, offsetsOffset + STOP_OFFSETS_COMPONENTS)
    );
    const [offsetA, offsetB, offsetC] = offsets;
    if (
      offsetA === undefined ||
      offsetB === undefined ||
      offsetC === undefined
    ) {
      throw new Error("Unexpected stop offsets length");
    }
    assert(Math.abs(offsetA - 0) < 0.0001);
    assert(Math.abs(offsetB - 0.4) < 0.0001);
    assert(Math.abs(offsetC - 1) < 0.0001);

    const expectedStops = [fill.stops[0], fill.stops[2], fill.stops[4]];
    expectedStops.forEach((stop, index) => {
      const colorStart = colorsOffset + index * STOP_COLOR_COMPONENTS;
      const color = Array.from(
        components.slice(colorStart, colorStart + STOP_COLOR_COMPONENTS)
      );
      assertArrayClose(color, [
        stop!.color.r,
        stop!.color.g,
        stop!.color.b,
        stop!.color.a ?? 1,
      ]);
    });
  });
});
