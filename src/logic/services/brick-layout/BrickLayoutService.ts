import { BrickType } from "../../../db/bricks-db";
import type { BrickData } from "../../modules/active-map/bricks/bricks.types";
import type {
  BrickGenerationOptions,
  CircleWithBricksOptions,
  ArcWithBricksOptions,
  PolygonWithBricksOptions,
  SquareWithBricksOptions,
  ConnectorWithBricksOptions,
  TemplateWithBricksOptions,
  BezierCurveWithBricksOptions,
  BezierPolygonWithBricksOptions,
  BrickShapeBlueprint,
} from "./brick-layout.types";
import {
  generateCircleBricks,
  generateArcBricks,
  generatePolygonBricks,
  generateSquareBricks,
  generateConnectorBricks,
  generateTemplateBricks,
  generateBezierCurveBricks,
  generateBezierPolygonBricks,
} from "./brick-layout.generators";

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

export const connectorWithBricks = (
  brickType: BrickType,
  options: ConnectorWithBricksOptions,
  generationOptions?: BrickGenerationOptions
): BrickShapeBlueprint => ({
  shape: "connector",
  brickType,
  options,
  generationOptions,
});

export const templateWithBricks = (
  brickType: BrickType,
  options: TemplateWithBricksOptions,
  generationOptions?: BrickGenerationOptions
): BrickShapeBlueprint => ({
  shape: "template",
  brickType,
  options,
  generationOptions,
});

export const bezierCurveWithBricks = (
  brickType: BrickType,
  options: BezierCurveWithBricksOptions,
  generationOptions?: BrickGenerationOptions
): BrickShapeBlueprint => ({
  shape: "bezierCurve",
  brickType,
  options,
  generationOptions,
});

export const bezierPolygonWithBricks = (
  brickType: BrickType,
  options: BezierPolygonWithBricksOptions,
  generationOptions?: BrickGenerationOptions
): BrickShapeBlueprint => ({
  shape: "bezierPolygon",
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
      case "connector":
        return generateConnectorBricks(
          blueprint.brickType,
          blueprint.options,
          blueprint.generationOptions
        );
      case "template":
        return generateTemplateBricks(
          blueprint.brickType,
          blueprint.options,
          blueprint.generationOptions
        );
      case "bezierCurve":
        return generateBezierCurveBricks(
          blueprint.brickType,
          blueprint.options,
          blueprint.generationOptions
        );
      case "bezierPolygon":
        return generateBezierPolygonBricks(
          blueprint.brickType,
          blueprint.options,
          blueprint.generationOptions
        );
      default:
        return [];
    }
  });

// Re-export types for backward compatibility
export type {
  BrickGenerationOptions,
  CircleWithBricksOptions,
  ArcWithBricksOptions,
  PolygonWithBricksOptions,
  SquareWithBricksOptions,
  ConnectorWithBricksOptions,
  TemplateWithBricksOptions,
  BezierCurveWithBricksOptions,
  BezierPolygonWithBricksOptions,
  BrickShapeBlueprint,
} from "./brick-layout.types";
