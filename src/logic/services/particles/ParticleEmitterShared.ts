import { FILL_TYPES, SceneColor, SceneFill } from "../SceneObjectManager";

export type ParticleEmitterShape = "square" | "circle";

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
    case FILL_TYPES.SOLID:
      return {
        fillType: FILL_TYPES.SOLID,
        color: { ...fill.color },
      };
    case FILL_TYPES.LINEAR_GRADIENT:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
      };
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT:
      return {
        fillType: fill.fillType,
        start: fill.start ? { ...fill.start } : undefined,
        end: typeof fill.end === "number" ? fill.end : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
      } as SceneFill;
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
