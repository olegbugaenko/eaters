import type { BrickType } from "../../../db/bricks-db";
import type { BrickData } from "../../modules/active-map/bricks/bricks.types";
import type { SceneVector2 } from "../scene-object-manager/scene-object-manager.types";
import type {
  BrickGenerationOptions,
  CircleWithBricksOptions,
  ArcWithBricksOptions,
  PolygonWithBricksOptions,
  SquareWithBricksOptions,
} from "./brick-layout.types";
import {
  sanitizeBrickLevel,
  clampRadius,
  getBrickSpacing,
  normalizeFillAngle,
  resolveGridSpacing,
  isPointInsidePolygon,
  getPolygonBounds,
} from "./brick-layout.helpers";
import { GRID_EPSILON } from "./brick-layout.const";

/**
 * Generates bricks in a circle pattern.
 */
export const generateCircleBricks = (
  brickType: BrickType,
  options: CircleWithBricksOptions,
  generationOptions?: BrickGenerationOptions
): BrickData[] => {
  const center = options.center;
  const innerRadius = clampRadius(options.innerRadius ?? 0);
  const outerRadius = Math.max(innerRadius, clampRadius(options.outerRadius));
  const baseAngle = options.angle ?? 0;
  const fillAngle = normalizeFillAngle(options.fillAngle);
  const level = sanitizeBrickLevel(generationOptions?.level);

  if (outerRadius === 0 || fillAngle === 0) {
    return [];
  }

  const spacing = getBrickSpacing(brickType, {
    radialSpacing: options.radialSpacing,
    tangentialSpacing: options.tangentialSpacing,
  });

  const radialSpan = Math.max(outerRadius - innerRadius, 0);
  const layerCount = Math.max(1, Math.ceil(radialSpan / Math.max(spacing.radial, 1)));
  const layerStep = layerCount === 0 ? radialSpan : radialSpan / layerCount;

  const bricks: BrickData[] = [];

  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    const radius =
      layerCount === 1
        ? innerRadius + radialSpan / 2
        : innerRadius + layerStep * layerIndex + Math.min(layerStep, spacing.radial) / 2;

    const effectiveRadius = Math.max(radius, 0);
    const circumference = Math.abs(fillAngle) * effectiveRadius;
    const countEstimate = circumference / Math.max(spacing.tangential, 1);
    const ringCount = Math.max(1, Math.round(countEstimate));

    for (let index = 0; index < ringCount; index += 1) {
      const t = ringCount === 1 ? 0.5 : (index + 0.5) / ringCount;
      const angle = baseAngle + fillAngle * t;
      const position: SceneVector2 = {
        x: center.x + Math.cos(angle) * effectiveRadius,
        y: center.y + Math.sin(angle) * effectiveRadius,
      };
      bricks.push({
        position,
        rotation: angle + Math.PI / 2,
        type: brickType,
        level,
      });
    }
  }

  return bricks;
};

/**
 * Generates bricks in an arc pattern.
 */
export const generateArcBricks = (
  brickType: BrickType,
  options: ArcWithBricksOptions,
  generationOptions?: BrickGenerationOptions
): BrickData[] =>
  generateCircleBricks(
    brickType,
    {
      center: options.center,
      innerRadius: options.innerRadius,
      outerRadius: options.outerRadius,
      angle: options.startAngle,
      fillAngle: options.endAngle - options.startAngle,
      radialSpacing: options.radialSpacing,
      tangentialSpacing: options.tangentialSpacing,
    },
    generationOptions
  );

/**
 * Generates bricks in a polygon pattern.
 */
export const generatePolygonBricks = (
  brickType: BrickType,
  options: PolygonWithBricksOptions,
  generationOptions?: BrickGenerationOptions
): BrickData[] => {
  if (options.vertices.length < 3) {
    return [];
  }

  const { stepX, stepY, offsetX, offsetY } = resolveGridSpacing(brickType, options);
  const bounds = getPolygonBounds(options.vertices);
  const level = sanitizeBrickLevel(generationOptions?.level);

  const startX = Math.floor((bounds.minX - offsetX) / stepX) * stepX + offsetX;
  const endX = Math.ceil((bounds.maxX - offsetX) / stepX) * stepX + offsetX;
  const startY = Math.floor((bounds.minY - offsetY) / stepY) * stepY + offsetY;
  const endY = Math.ceil((bounds.maxY - offsetY) / stepY) * stepY + offsetY;

  const holes = (options.holes ?? []).filter((hole) => hole.length >= 3);
  const rotation = options.brickRotation ?? 0;

  const bricks: BrickData[] = [];

  for (let x = startX; x <= endX + GRID_EPSILON; x += stepX) {
    for (let y = startY; y <= endY + GRID_EPSILON; y += stepY) {
      const position: SceneVector2 = { x, y };
      if (!isPointInsidePolygon(position, options.vertices)) {
        continue;
      }

      if (holes.some((hole) => isPointInsidePolygon(position, hole))) {
        continue;
      }

      bricks.push({
        position,
        rotation,
        type: brickType,
        level,
      });
    }
  }

  return bricks;
};

/**
 * Generates bricks in a square pattern.
 */
export const generateSquareBricks = (
  brickType: BrickType,
  options: SquareWithBricksOptions,
  generationOptions?: BrickGenerationOptions
): BrickData[] => {
  if (!Number.isFinite(options.size) || options.size <= 0) {
    return [];
  }

  const half = options.size / 2;
  const rotation = options.rotation ?? 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const vertices: SceneVector2[] = [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ].map((corner) => ({
    x: options.center.x + corner.x * cos - corner.y * sin,
    y: options.center.y + corner.x * sin + corner.y * cos,
  }));

  return generatePolygonBricks(
    brickType,
    {
      vertices,
      spacing: options.spacing,
      spacingX: options.spacingX,
      spacingY: options.spacingY,
      offsetX: options.offsetX,
      offsetY: options.offsetY,
      brickRotation: options.brickRotation,
    },
    generationOptions
  );
};
