import type { BrickType } from "../../../db/bricks-db";
import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type {
  BrickGenerationOptions,
  CircleWithBricksOptions,
  PolygonWithBricksOptions,
  SquareWithBricksOptions,
  BrickSpacing,
} from "./brick-layout.types";
import { getBrickConfig } from "../../../db/bricks-db";
import { TAU } from "../../../shared/helpers/geometry.const";
import { GRID_EPSILON } from "./brick-layout.const";

/**
 * Sanitizes a brick level value.
 * Returns 1 if value is not a finite number or < 1, otherwise returns floor(value).
 */
export const sanitizeBrickLevel = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
};

/**
 * Clamps a radius value to non-negative.
 */
export const clampRadius = (value: number): number => (Number.isFinite(value) && value >= 0 ? value : 0);

/**
 * Clamps a positive value, returning fallback if value is not finite or <= 0.
 */
export const clampPositive = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
};

/**
 * Gets brick spacing for a brick type.
 */
export const getBrickSpacing = (brickType: BrickType, overrides?: {
  radialSpacing?: number;
  tangentialSpacing?: number;
}): BrickSpacing => {
  const config = getBrickConfig(brickType);
  const majorSize = Math.max(config.size.width, config.size.height);
  const minorSize = Math.min(config.size.width, config.size.height);
  const radial = overrides?.radialSpacing ?? minorSize;
  const tangential = overrides?.tangentialSpacing ?? majorSize;
  return { radial, tangential };
};

/**
 * Normalizes fill angle to [0, TAU] range.
 */
export const normalizeFillAngle = (fillAngle?: number): number => {
  if (fillAngle === undefined) {
    return TAU;
  }
  if (fillAngle === 0) {
    return 0;
  }
  const turns = Math.floor(fillAngle / TAU);
  const normalized = fillAngle - turns * TAU;
  if (normalized === 0) {
    return TAU;
  }
  return normalized;
};

/**
 * Resolves grid spacing for polygon/square options.
 */
export const resolveGridSpacing = (
  brickType: BrickType,
  options: PolygonWithBricksOptions | SquareWithBricksOptions
): { stepX: number; stepY: number; offsetX: number; offsetY: number } => {
  const config = getBrickConfig(brickType);
  const baseStepX = config.size.width;
  const baseStepY = config.size.height;
  const stepX = clampPositive(options.spacingX ?? options.spacing ?? baseStepX, baseStepX);
  const stepY = clampPositive(options.spacingY ?? options.spacing ?? baseStepY, baseStepY);
  const offsetX = options.offsetX ?? stepX / 2;
  const offsetY = options.offsetY ?? stepY / 2;
  return { stepX, stepY, offsetX, offsetY };
};

/**
 * Checks if a point is on a line segment.
 */
export const isPointOnSegment = (point: SceneVector2, a: SceneVector2, b: SceneVector2): boolean => {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > GRID_EPSILON) {
    return false;
  }
  const dot = (point.x - a.x) * (point.x - b.x) + (point.y - a.y) * (point.y - b.y);
  return dot <= GRID_EPSILON;
};

/**
 * Checks if a point is inside a polygon using ray casting algorithm.
 */
export const isPointInsidePolygon = (point: SceneVector2, vertices: readonly SceneVector2[]): boolean => {
  const vertexCount = vertices.length;
  if (vertexCount < 3) {
    return false;
  }

  let inside = false;

  for (let i = 0; i < vertexCount; i += 1) {
    const vi = vertices[i];
    const previousIndex = i === 0 ? vertexCount - 1 : i - 1;
    const vj = vertices[previousIndex];

    if (!vi || !vj) {
      continue;
    }

    if (isPointOnSegment(point, vi, vj)) {
      return true;
    }

    const intersects =
      (vi.y > point.y) !== (vj.y > point.y) &&
      point.x <=
        ((vj.x - vi.x) * (point.y - vi.y)) / (vj.y - vi.y + GRID_EPSILON) + vi.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

/**
 * Gets bounding box for a polygon.
 */
export const getPolygonBounds = (vertices: readonly SceneVector2[]) => {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  vertices.forEach((vertex) => {
    if (vertex.x < minX) {
      minX = vertex.x;
    }
    if (vertex.x > maxX) {
      maxX = vertex.x;
    }
    if (vertex.y < minY) {
      minY = vertex.y;
    }
    if (vertex.y > maxY) {
      maxY = vertex.y;
    }
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
  };
};
