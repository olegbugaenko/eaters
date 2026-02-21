import type {
  SceneColor,
  SceneFill,
  SceneSolidFill,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

export type RendererColorAnimationKeyframe =
  | {
      time: number;
      deltaHue?: number;
      deltaSaturation?: number;
      deltaBrightness?: number;
    }
  | {
      time: number;
      rgba: [number, number, number, number?];
    };

export interface RendererColorAnimationConfig {
  interval: number;
  keyframes: RendererColorAnimationKeyframe[];
}

export type RendererFillConfig =
  | {
      type: "base";
      brightness?: number;
      brightnessShift?: number;
      hueShift?: number;
      saturationShift?: number;
      alphaMultiplier?: number;
      colorAnimation?: RendererColorAnimationConfig;
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
      brightnessShift?: number;
      hueShift?: number;
      saturationShift?: number;
      alphaMultiplier?: number;
      colorAnimation?: RendererColorAnimationConfig;
    }
  | {
      type: "solid";
      width: number;
      color: SceneColor;
    };
