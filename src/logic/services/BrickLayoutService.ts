import { BrickType, getBrickConfig } from "../../db/bricks-db";
import { BrickData } from "../modules/active-map/BricksModule";
import { SceneVector2 } from "./SceneObjectManager";

const TAU = Math.PI * 2;

const sanitizeBrickLevel = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
};

export interface BrickGenerationOptions {
  readonly level?: number;
}

export interface CircleWithBricksOptions {
  readonly center: SceneVector2;
  readonly innerRadius?: number;
  readonly outerRadius: number;
  readonly angle?: number;
  readonly fillAngle?: number;
  readonly radialSpacing?: number;
  readonly tangentialSpacing?: number;
}

export interface ArcWithBricksOptions {
  readonly center: SceneVector2;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly radialSpacing?: number;
  readonly tangentialSpacing?: number;
}

export interface PolygonWithBricksOptions {
  readonly vertices: readonly SceneVector2[];
  readonly holes?: readonly (readonly SceneVector2[])[];
  readonly spacing?: number;
  readonly spacingX?: number;
  readonly spacingY?: number;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly brickRotation?: number;
}

export interface SquareWithBricksOptions
  extends Omit<PolygonWithBricksOptions, "vertices" | "holes"> {
  readonly center: SceneVector2;
  readonly size: number;
  readonly rotation?: number;
}

export type BrickShapeBlueprint =
  | {
      readonly shape: "circle";
      readonly brickType: BrickType;
      readonly options: CircleWithBricksOptions;
      readonly generationOptions?: BrickGenerationOptions;
    }
  | {
      readonly shape: "arc";
      readonly brickType: BrickType;
      readonly options: ArcWithBricksOptions;
      readonly generationOptions?: BrickGenerationOptions;
    }
  | {
      readonly shape: "polygon";
      readonly brickType: BrickType;
      readonly options: PolygonWithBricksOptions;
      readonly generationOptions?: BrickGenerationOptions;
    }
  | {
      readonly shape: "square";
      readonly brickType: BrickType;
      readonly options: SquareWithBricksOptions;
      readonly generationOptions?: BrickGenerationOptions;
    };

interface BrickSpacing {
  radial: number;
  tangential: number;
}

const getBrickSpacing = (brickType: BrickType, overrides?: {
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

const normalizeFillAngle = (fillAngle?: number): number => {
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

const clampRadius = (value: number): number => (Number.isFinite(value) && value >= 0 ? value : 0);

const clampPositive = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
};

const GRID_EPSILON = 1e-6;

const generateCircleBricks = (
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

const generateArcBricks = (
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

const resolveGridSpacing = (
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

const isPointOnSegment = (point: SceneVector2, a: SceneVector2, b: SceneVector2): boolean => {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > GRID_EPSILON) {
    return false;
  }
  const dot = (point.x - a.x) * (point.x - b.x) + (point.y - a.y) * (point.y - b.y);
  return dot <= GRID_EPSILON;
};

const isPointInsidePolygon = (point: SceneVector2, vertices: readonly SceneVector2[]): boolean => {
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

const getPolygonBounds = (vertices: readonly SceneVector2[]) => {
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

const generatePolygonBricks = (
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

const generateSquareBricks = (
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

export const circleWithBricks = (
  brickType: BrickType,
  options: CircleWithBricksOptions,
  generationOptions?: BrickGenerationOptions
): BrickShapeBlueprint => ({
  shape: "circle",
  brickType,
  options,
  generationOptions,
});

export const arcWithBricks = (
  brickType: BrickType,
  options: ArcWithBricksOptions,
  generationOptions?: BrickGenerationOptions
): BrickShapeBlueprint => ({
  shape: "arc",
  brickType,
  options,
  generationOptions,
});

export const polygonWithBricks = (
  brickType: BrickType,
  options: PolygonWithBricksOptions,
  generationOptions?: BrickGenerationOptions
): BrickShapeBlueprint => ({
  shape: "polygon",
  brickType,
  options,
  generationOptions,
});

export const squareWithBricks = (
  brickType: BrickType,
  options: SquareWithBricksOptions,
  generationOptions?: BrickGenerationOptions
): BrickShapeBlueprint => ({
  shape: "square",
  brickType,
  options,
  generationOptions,
});

export const buildBricksFromBlueprints = (
  blueprints: readonly BrickShapeBlueprint[]
): BrickData[] =>
  blueprints.flatMap((blueprint) => {
    switch (blueprint.shape) {
      case "circle":
        return generateCircleBricks(
          blueprint.brickType,
          blueprint.options,
          blueprint.generationOptions
        );
      case "arc":
        return generateArcBricks(
          blueprint.brickType,
          blueprint.options,
          blueprint.generationOptions
        );
      case "polygon":
        return generatePolygonBricks(
          blueprint.brickType,
          blueprint.options,
          blueprint.generationOptions
        );
      case "square":
        return generateSquareBricks(
          blueprint.brickType,
          blueprint.options,
          blueprint.generationOptions
        );
      default:
        return [];
    }
  });
