import type { BrickType } from "../../../db/bricks-db";
import type { SceneVector2 } from "../scene-object-manager/scene-object-manager.types";

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

export interface TemplateWithBricksOptions {
  readonly center: SceneVector2;
  readonly template: readonly string[]; // Array of strings, where "#" = brick, " " = empty
  readonly horizontalGap?: number; // Gap between bricks horizontally (default: 1)
  readonly verticalGap?: number; // Gap between bricks vertically (default: 1)
  readonly rotation?: number; // Rotation in radians (default: 0)
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
    }
  | {
      readonly shape: "template";
      readonly brickType: BrickType;
      readonly options: TemplateWithBricksOptions;
      readonly generationOptions?: BrickGenerationOptions;
    };

export interface BrickSpacing {
  radial: number;
  tangential: number;
}
