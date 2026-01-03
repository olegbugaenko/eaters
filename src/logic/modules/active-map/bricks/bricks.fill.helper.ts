import { FILL_TYPES } from "../../../services/scene-object-manager/scene-object-manager.const";
import type {
  SceneFill,
} from "../../../services/scene-object-manager/scene-object-manager.types";
import { BrickConfig } from "../../../../db/bricks-db";
import { cloneSceneFillNoise, cloneSceneFillFilaments } from "@shared/helpers/scene-fill.helper";

export const createBrickFill = (config: BrickConfig): SceneFill => {
  const fill = config.fill;
  switch (fill.type) {
    case "solid":
      return {
        fillType: FILL_TYPES.SOLID,
        color: { ...fill.color },
        ...(fill.noise ? { noise: cloneSceneFillNoise(fill.noise) } : {}),
        ...(fill.filaments ? { filaments: cloneSceneFillFilaments(fill.filaments) } : {}),
      };
    case "radial":
      return {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: fill.center ? { ...fill.center } : undefined,
        end: fill.radius,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
        ...(fill.noise ? { noise: cloneSceneFillNoise(fill.noise) } : {}),
        ...(fill.filaments ? { filaments: cloneSceneFillFilaments(fill.filaments) } : {}),
      };
    case "linear":
    default:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
        ...(fill.noise ? { noise: cloneSceneFillNoise(fill.noise) } : {}),
        ...(fill.filaments ? { filaments: cloneSceneFillFilaments(fill.filaments) } : {}),
      };
  }
};
