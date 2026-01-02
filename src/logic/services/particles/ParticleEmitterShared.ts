import { FILL_TYPES } from "../scene-object-manager/scene-object-manager.const";
import type {
  SceneColor,
  SceneFill,
  SceneSolidFill,
  SceneLinearGradientFill,
  SceneRadialGradientFill,
  SceneDiamondGradientFill,
} from "../scene-object-manager/scene-object-manager.types";

export type ParticleEmitterShape = "square" | "circle" | "triangle";

export const cloneSceneColor = (color: SceneColor): SceneColor => ({
  r: color.r,
  g: color.g,
  b: color.b,
  a: typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1,
});

export const sanitizeSceneColor = (
  color: SceneColor | undefined,
  fallback: SceneColor
): SceneColor => ({
  r: typeof color?.r === "number" && Number.isFinite(color.r)
    ? color.r
    : fallback.r,
  g: typeof color?.g === "number" && Number.isFinite(color.g)
    ? color.g
    : fallback.g,
  b: typeof color?.b === "number" && Number.isFinite(color.b)
    ? color.b
    : fallback.b,
  a: typeof color?.a === "number" && Number.isFinite(color.a)
    ? color.a
    : typeof fallback.a === "number"
    ? fallback.a
    : 1,
});

export const cloneSceneFill = (fill: SceneFill): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID: {
      const solidFill = fill as SceneSolidFill;
      return {
        fillType: FILL_TYPES.SOLID,
        color: { ...solidFill.color },
        ...(solidFill.noise ? { noise: { ...solidFill.noise } } : {}),
        ...(solidFill.filaments ? { filaments: { ...solidFill.filaments } } : {}),
      };
    }
    case FILL_TYPES.LINEAR_GRADIENT: {
      const linearFill = fill as SceneLinearGradientFill;
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: linearFill.start ? { ...linearFill.start } : undefined,
        end: linearFill.end ? { ...linearFill.end } : undefined,
        stops: linearFill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
        ...(linearFill.noise ? { noise: { ...linearFill.noise } } : {}),
        ...(linearFill.filaments ? { filaments: { ...linearFill.filaments } } : {}),
      };
    }
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT: {
      const radialOrDiamondFill = fill as SceneRadialGradientFill | SceneDiamondGradientFill;
      return {
        fillType: radialOrDiamondFill.fillType,
        start: radialOrDiamondFill.start ? { ...radialOrDiamondFill.start } : undefined,
        end: typeof radialOrDiamondFill.end === "number" ? radialOrDiamondFill.end : undefined,
        stops: radialOrDiamondFill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
        ...(radialOrDiamondFill.noise ? { noise: { ...radialOrDiamondFill.noise } } : {}),
        ...(radialOrDiamondFill.filaments ? { filaments: { ...radialOrDiamondFill.filaments } } : {}),
      };
    }
    default:
      return fill;
  }
};

export const normalizeAngle = (angle: number): number => {
  if (!Number.isFinite(angle)) {
    return 0;
  }
  const wrapped = angle % (Math.PI * 2);
  return wrapped < 0 ? wrapped + Math.PI * 2 : wrapped;
};

export const sanitizeAngle = (
  value: number | undefined,
  fallback = 0
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return normalizeAngle(fallback);
  }
  return normalizeAngle(value);
};

export const sanitizeArc = (
  value: number | undefined,
  min = 0,
  max = Math.PI * 2
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return max;
  }
  if (value <= min) {
    return min;
  }
  if (value >= max) {
    return max;
  }
  return value;
};
