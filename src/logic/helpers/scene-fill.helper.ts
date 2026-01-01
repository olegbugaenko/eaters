import { FILL_TYPES } from "../services/SceneObjectManager";
import type {
  SceneDiamondGradientFill,
  SceneFill,
  SceneFillFilaments,
  SceneFillNoise,
  SceneGradientStop,
  SceneLinearGradientFill,
  SceneRadialGradientFill,
  SceneSolidFill,
} from "../services/SceneObjectManager";

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

export const cloneSceneFill = (fill: SceneFill): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID: {
      const cloned: SceneSolidFill = {
        fillType: FILL_TYPES.SOLID,
        color: { ...fill.color },
      };
      return withNoiseAndFilaments(cloned, fill);
    }
    case FILL_TYPES.LINEAR_GRADIENT: {
      const cloned: SceneLinearGradientFill = {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: cloneSceneGradientStops(fill.stops),
      };
      return withNoiseAndFilaments(cloned, fill);
    }
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT: {
      const cloned: SceneRadialGradientFill | SceneDiamondGradientFill = {
        fillType: fill.fillType,
        start: fill.start ? { ...fill.start } : undefined,
        end: typeof fill.end === "number" ? fill.end : undefined,
        stops: cloneSceneGradientStops(fill.stops),
      };
      return withNoiseAndFilaments(cloned, fill);
    }
    default:
      return fill;
  }
};
