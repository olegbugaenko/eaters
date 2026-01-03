import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import type {
  SceneColor,
  SceneDiamondGradientFill,
  SceneFill,
  SceneFillFilaments,
  SceneFillNoise,
  SceneGradientStop,
  SceneLinearGradientFill,
  SceneRadialGradientFill,
  SceneSolidFill,
  SceneVector2,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { clampNumber } from "@shared/helpers/numbers.helper";
import { tintSceneColor, cloneSceneColor } from "@shared/helpers/scene-color.helper";

export const cloneSceneFillNoise = (
  noise: SceneFillNoise | undefined,
): SceneFillNoise | undefined => (noise ? { ...noise } : undefined);

export const cloneSceneFillFilaments = (
  filaments: SceneFillFilaments | undefined,
): SceneFillFilaments | undefined => (filaments ? { ...filaments } : undefined);

export const cloneSceneGradientStops = (
  stops: SceneGradientStop[],
): SceneGradientStop[] =>
  stops.map((stop) => ({
    offset: stop.offset,
    color: { ...stop.color },
  }));

/**
 * Creates a radial gradient fill with optional noise and filaments.
 * @param radius - The radius of the gradient (end point)
 * @param stops - Array of gradient stops
 * @param options - Optional configuration (start center, noise, filaments)
 */
export const createRadialGradientFill = (
  radius: number,
  stops: readonly SceneGradientStop[],
  options?: {
    start?: SceneVector2;
    noise?: SceneFillNoise;
    filaments?: SceneFillFilaments;
  }
): SceneRadialGradientFill => {
  const fill: SceneRadialGradientFill = {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: options?.start ? { ...options.start } : { x: 0, y: 0 },
    end: radius,
    stops: stops.map((stop) => ({
      offset: stop.offset,
      color: { ...stop.color },
    })),
  };

  if (options?.noise) {
    fill.noise = cloneSceneFillNoise(options.noise);
  }

  if (options?.filaments) {
    fill.filaments = cloneSceneFillFilaments(options.filaments);
  }

  return fill;
};

const withNoiseAndFilaments = <T extends { noise?: SceneFillNoise; filaments?: SceneFillFilaments }>(
  fill: T,
  source: SceneFill,
): T => {
  const noise = cloneSceneFillNoise(source.noise);
  const filaments = cloneSceneFillFilaments(source.filaments);

  if (noise) {
    fill.noise = noise;
  }

  if (filaments) {
    fill.filaments = filaments;
  }

  return fill;
};

/**
 * Clones a fill with optional noise and filaments.
 * This is a convenience function for the common pattern of cloning fill with noise/filaments.
 * @param fill - The fill to clone
 * @param options - Optional configuration for noise and filaments
 * @returns Cloned fill with noise/filaments applied if provided
 */
export const cloneSceneFillWithNoiseAndFilaments = (
  fill: SceneFill,
  options?: {
    noise?: SceneFillNoise | undefined;
    filaments?: SceneFillFilaments | undefined;
  }
): SceneFill => {
  const cloned = cloneSceneFill(fill);
  if (options?.noise) {
    cloned.noise = cloneSceneFillNoise(options.noise);
  }
  if (options?.filaments) {
    cloned.filaments = cloneSceneFillFilaments(options.filaments);
  }
  return cloned;
};

export const cloneSceneFill = (fill: SceneFill): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID: {
      const solidFill = fill as SceneSolidFill;
      const cloned: SceneSolidFill = {
        fillType: FILL_TYPES.SOLID,
        color: { ...solidFill.color },
      };
      return withNoiseAndFilaments(cloned, fill);
    }
    case FILL_TYPES.LINEAR_GRADIENT: {
      const linearFill = fill as SceneLinearGradientFill;
      const cloned: SceneLinearGradientFill = {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: linearFill.start ? { ...linearFill.start } : undefined,
        end: linearFill.end ? { ...linearFill.end } : undefined,
        stops: cloneSceneGradientStops(linearFill.stops),
      };
      return withNoiseAndFilaments(cloned, fill);
    }
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT: {
      const gradientFill = fill as SceneRadialGradientFill | SceneDiamondGradientFill;
      const cloned: SceneRadialGradientFill | SceneDiamondGradientFill = {
        fillType: fill.fillType,
        start: gradientFill.start ? { ...gradientFill.start } : undefined,
        end: typeof gradientFill.end === "number" ? gradientFill.end : undefined,
        stops: cloneSceneGradientStops(gradientFill.stops),
      };
      return withNoiseAndFilaments(cloned, fill);
    }
    default:
      return fill;
  }
};

/**
 * Tints a scene fill by blending all color stops with a tint color at a given intensity.
 * Preserves noise and filaments from the original fill.
 */
export const tintSceneFill = (
  fill: SceneFill,
  tint: SceneColor,
  intensity: number
): SceneFill => {
  const ratio = clampNumber(intensity, 0, 1);
  switch (fill.fillType) {
    case FILL_TYPES.SOLID: {
      const solidFill = fill as SceneSolidFill;
      const tinted: SceneSolidFill = {
        fillType: FILL_TYPES.SOLID,
        color: tintSceneColor(solidFill.color, tint, ratio),
      };
      return withNoiseAndFilaments(tinted, fill);
    }
    case FILL_TYPES.LINEAR_GRADIENT: {
      const linearFill = fill as SceneLinearGradientFill;
      const tinted: SceneLinearGradientFill = {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: linearFill.start ? { ...linearFill.start } : undefined,
        end: linearFill.end ? { ...linearFill.end } : undefined,
        stops: linearFill.stops.map((stop) => ({
          offset: stop.offset,
          color: tintSceneColor(stop.color, tint, ratio),
        })),
      };
      return withNoiseAndFilaments(tinted, fill);
    }
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT: {
      const gradientFill = fill as SceneRadialGradientFill | SceneDiamondGradientFill;
      const tinted: SceneRadialGradientFill | SceneDiamondGradientFill = {
        fillType: fill.fillType,
        start: gradientFill.start ? { ...gradientFill.start } : undefined,
        end: typeof gradientFill.end === "number" ? gradientFill.end : undefined,
        stops: gradientFill.stops.map((stop) => ({
          offset: stop.offset,
          color: tintSceneColor(stop.color, tint, ratio),
        })),
      };
      return withNoiseAndFilaments(tinted, fill);
    }
    default:
      return cloneSceneFill(fill);
  }
};

/**
 * Deep clones a scene fill, including deep cloning of all color objects.
 * This is useful when you need to ensure complete independence of the cloned fill.
 */
export const cloneSceneFillDeep = (fill: SceneFill): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID: {
      const solidFill = fill as SceneSolidFill;
      const solid: SceneSolidFill = {
        fillType: FILL_TYPES.SOLID,
        color: cloneSceneColor(solidFill.color),
      };
      if (solidFill.noise) {
        solid.noise = cloneSceneFillNoise(solidFill.noise);
      }
      if (solidFill.filaments) {
        solid.filaments = cloneSceneFillFilaments(solidFill.filaments);
      }
      return solid;
    }
    case FILL_TYPES.LINEAR_GRADIENT: {
      const linearFill = fill as SceneLinearGradientFill;
      const linear: SceneLinearGradientFill = {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: linearFill.start ? { ...linearFill.start } : undefined,
        end: linearFill.end ? { ...linearFill.end } : undefined,
        stops: linearFill.stops.map((stop) => ({
          offset: stop.offset,
          color: stop.color ? cloneSceneColor(stop.color) : stop.color,
        })),
      };
      if (linearFill.noise) {
        linear.noise = cloneSceneFillNoise(linearFill.noise);
      }
      if (linearFill.filaments) {
        linear.filaments = cloneSceneFillFilaments(linearFill.filaments);
      }
      return linear;
    }
    case FILL_TYPES.RADIAL_GRADIENT: {
      const radialFill = fill as SceneRadialGradientFill;
      const radial: SceneRadialGradientFill = {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: radialFill.start ? { ...radialFill.start } : undefined,
        end: typeof radialFill.end === "number" ? radialFill.end : 0,
        stops: radialFill.stops.map((stop) => ({
          offset: stop.offset,
          color: stop.color ? cloneSceneColor(stop.color) : stop.color,
        })),
      };
      if (radialFill.noise) {
        radial.noise = cloneSceneFillNoise(radialFill.noise);
      }
      if (radialFill.filaments) {
        radial.filaments = cloneSceneFillFilaments(radialFill.filaments);
      }
      return radial;
    }
    case FILL_TYPES.DIAMOND_GRADIENT: {
      const diamondFill = fill as SceneDiamondGradientFill;
      const diamond: SceneDiamondGradientFill = {
        fillType: FILL_TYPES.DIAMOND_GRADIENT,
        start: diamondFill.start ? { ...diamondFill.start } : undefined,
        end: typeof diamondFill.end === "number" ? diamondFill.end : 0,
        stops: diamondFill.stops.map((stop) => ({
          offset: stop.offset,
          color: stop.color ? cloneSceneColor(stop.color) : stop.color,
        })),
      };
      if (diamondFill.noise) {
        diamond.noise = cloneSceneFillNoise(diamondFill.noise);
      }
      if (diamondFill.filaments) {
        diamond.filaments = cloneSceneFillFilaments(diamondFill.filaments);
      }
      return diamond;
    }
    default:
      return cloneSceneFill(fill);
  }
};
