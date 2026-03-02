import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { BezierCurveSegment } from "../brick-layout.types";

/**
 * Control point shift for one edge. Both shift along the outward normal.
 * Positive = bulge outward, negative = concave.
 */
export interface EdgeConvexity {
  readonly control1?: number;
  readonly control2?: number;
}

/**
 * Convexity parameters for each edge of the trapezoid.
 * Each edge can have independent control1 and control2 shift.
 */
export interface TrapezoidConvexity {
  readonly left?: EdgeConvexity | number;
  readonly right?: EdgeConvexity | number;
  readonly top?: EdgeConvexity | number;
  readonly bottom?: EdgeConvexity | number;
}

export interface GenerateTrapezoidOptions {
  /** Width of the bottom base */
  readonly bottomWidth: number;
  /** Width of the top base */
  readonly topWidth: number;
  /** Height of the trapezoid */
  readonly height: number;
  /** Control point shift per edge (positive = bulge outward) */
  readonly convexity?: TrapezoidConvexity;
}

/**
 * Generates a trapezoid outline as Bezier curve segments.
 * Trapezoid is centered at origin: bottom at y = height/2, top at y = -height/2.
 * Returns outline suitable for transformBezierOutline + bezierPolygonWithBricks.
 */
const resolveEdge = (v: EdgeConvexity | number | undefined): { c1: number; c2: number } => {
  if (v === undefined) return { c1: 0, c2: 0 };
  if (typeof v === "number") return { c1: v, c2: v };
  return { c1: v.control1 ?? 0, c2: v.control2 ?? 0 };
};

export const generateTrapezoidOutline = (
  options: GenerateTrapezoidOptions
): BezierCurveSegment[] => {
  const { bottomWidth, topWidth, height, convexity = {} } = options;
  const bottom = resolveEdge(convexity.bottom);
  const right = resolveEdge(convexity.right);
  const top = resolveEdge(convexity.top);
  const left = resolveEdge(convexity.left);

  const bHalf = bottomWidth / 2;
  const tHalf = topWidth / 2;
  const hHalf = height / 2;

  const seg = (
    start: SceneVector2,
    end: SceneVector2,
    normalX: number,
    normalY: number,
    c1Shift: number,
    c2Shift: number
  ): BezierCurveSegment => {
    const t1 = 1 / 3;
    const t2 = 2 / 3;
    const c1 = {
      x: start.x + (end.x - start.x) * t1 + normalX * c1Shift,
      y: start.y + (end.y - start.y) * t1 + normalY * c1Shift,
    };
    const c2 = {
      x: start.x + (end.x - start.x) * t2 + normalX * c2Shift,
      y: start.y + (end.y - start.y) * t2 + normalY * c2Shift,
    };
    return { start, control1: c1, control2: c2, end };
  };

  return [
    seg({ x: -bHalf, y: hHalf }, { x: bHalf, y: hHalf }, 0, 1, bottom.c1, bottom.c2),
    seg({ x: bHalf, y: hHalf }, { x: tHalf, y: -hHalf }, 1, 0, right.c1, right.c2),
    seg({ x: tHalf, y: -hHalf }, { x: -tHalf, y: -hHalf }, 0, -1, top.c1, top.c2),
    seg({ x: -tHalf, y: -hHalf }, { x: -bHalf, y: hHalf }, -1, 0, left.c1, left.c2),
  ];
};
