import type {
  SceneColor,
  SceneFill,
  SceneSolidFill,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

export type RendererFillConfig =
  | {
      type: "base";
      brightness?: number;
      alphaMultiplier?: number;
    }
  | {
      type: "solid";
      fill: SceneSolidFill;
    }
  | {
      type: "gradient";
      fill: SceneFill;
    };

export type RendererStrokeConfig =
  | {
      type: "base";
      width: number;
      brightness?: number;
      alphaMultiplier?: number;
    }
  | {
      type: "solid";
      width: number;
      color: SceneColor;
    };
