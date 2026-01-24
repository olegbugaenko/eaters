import { strict as assert } from "assert";

import { describe, test } from "./testRunner";
import { transformBezierOutline } from "../src/logic/services/brick-layout/brick-layout.helpers";

const expectClose = (actual: number, expected: number, epsilon = 1e-6) => {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to be within ${epsilon} of ${expected}`
  );
};

describe("transformBezierOutline", () => {
  test("applies translation, uniform scale, and rotation", () => {
    const outline = [
      {
        start: { x: 0, y: 0 },
        control1: { x: 1, y: 0 },
        control2: { x: 1, y: 1 },
        end: { x: 0, y: 1 },
      },
    ];

    const [segment] = transformBezierOutline(outline, {
      position: { x: 10, y: 5 },
      scale: 2,
      rotation: Math.PI / 2,
    });

    assert.ok(segment);
    expectClose(segment.start.x, 10);
    expectClose(segment.start.y, 5);
    expectClose(segment.control1.x, 10);
    expectClose(segment.control1.y, 7);
    expectClose(segment.control2.x, 8);
    expectClose(segment.control2.y, 7);
    expectClose(segment.end.x, 8);
    expectClose(segment.end.y, 5);
  });

  test("applies non-uniform scale without rotation", () => {
    const outline = [
      {
        start: { x: -1, y: 2 },
        control1: { x: 0, y: 1 },
        control2: { x: 2, y: -2 },
        end: { x: 3, y: 4 },
      },
    ];

    const [segment] = transformBezierOutline(outline, {
      scale: { x: 2, y: 3 },
    });

    assert.ok(segment);
    expectClose(segment.start.x, -2);
    expectClose(segment.start.y, 6);
    expectClose(segment.control1.x, 0);
    expectClose(segment.control1.y, 3);
    expectClose(segment.control2.x, 4);
    expectClose(segment.control2.y, -6);
    expectClose(segment.end.x, 6);
    expectClose(segment.end.y, 12);
  });
});
