import { BrickType, getBrickConfig } from "../../db/bricks-db";
import { BrickData } from "../modules/BricksModule";
import { SceneVector2 } from "./SceneObjectManager";

const TAU = Math.PI * 2;

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

export type BrickShapeBlueprint =
  | { readonly shape: "circle"; readonly brickType: BrickType; readonly options: CircleWithBricksOptions }
  | { readonly shape: "arc"; readonly brickType: BrickType; readonly options: ArcWithBricksOptions };

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

const generateCircleBricks = (
  brickType: BrickType,
  options: CircleWithBricksOptions
): BrickData[] => {
  const center = options.center;
  const innerRadius = clampRadius(options.innerRadius ?? 0);
  const outerRadius = Math.max(innerRadius, clampRadius(options.outerRadius));
  const baseAngle = options.angle ?? 0;
  const fillAngle = normalizeFillAngle(options.fillAngle);

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
      });
    }
  }

  return bricks;
};

const generateArcBricks = (brickType: BrickType, options: ArcWithBricksOptions): BrickData[] =>
  generateCircleBricks(brickType, {
    center: options.center,
    innerRadius: options.innerRadius,
    outerRadius: options.outerRadius,
    angle: options.startAngle,
    fillAngle: options.endAngle - options.startAngle,
    radialSpacing: options.radialSpacing,
    tangentialSpacing: options.tangentialSpacing,
  });

export const circleWithBricks = (
  brickType: BrickType,
  options: CircleWithBricksOptions
): BrickShapeBlueprint => ({
  shape: "circle",
  brickType,
  options,
});

export const arcWithBricks = (
  brickType: BrickType,
  options: ArcWithBricksOptions
): BrickShapeBlueprint => ({
  shape: "arc",
  brickType,
  options,
});

export const buildBricksFromBlueprints = (
  blueprints: readonly BrickShapeBlueprint[]
): BrickData[] =>
  blueprints.flatMap((blueprint) => {
    switch (blueprint.shape) {
      case "circle":
        return generateCircleBricks(blueprint.brickType, blueprint.options);
      case "arc":
        return generateArcBricks(blueprint.brickType, blueprint.options);
      default:
        return [];
    }
  });
