import { ObjectRenderer, ObjectRegistration } from "./ObjectRenderer";
import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneObjectInstance,
} from "../../../logic/services/SceneObjectManager";
import {
  createStaticCirclePrimitive,
  createStaticRectanglePrimitive,
} from "../primitives";

const CIRCLE_SIZE_FACTOR = 0.4;
const INNER_COLOR_LIGHTNESS = 0.85;
const INNER_OFFSET_FACTOR = 0.25;

const lightenColor = (base: SceneColor): SceneColor => ({
  r: Math.min(1, base.r * INNER_COLOR_LIGHTNESS + (1 - INNER_COLOR_LIGHTNESS)),
  g: Math.min(1, base.g * INNER_COLOR_LIGHTNESS + (1 - INNER_COLOR_LIGHTNESS)),
  b: Math.min(1, base.b * INNER_COLOR_LIGHTNESS + (1 - INNER_COLOR_LIGHTNESS)),
  a: typeof base.a === "number" ? base.a : 1,
});

const mapFillColors = (
  fill: SceneFill,
  mapper: (color: SceneColor) => SceneColor
): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID:
      return {
        fillType: FILL_TYPES.SOLID,
        color: mapper(fill.color),
      };
    case FILL_TYPES.LINEAR_GRADIENT:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: mapper(stop.color),
        })),
      };
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT:
      return {
        fillType: fill.fillType,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: mapper(stop.color),
        })),
      };
    default:
      return {
        fillType: FILL_TYPES.SOLID,
        color: mapper({ r: 1, g: 1, b: 1, a: 1 }),
      };
  }
};

export class BrickObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const size = instance.data.size ?? { width: 0, height: 0 };
    const radius = (Math.min(size.width, size.height) * CIRCLE_SIZE_FACTOR) / 2;
    const fill = instance.data.fill;
    const innerFill = mapFillColors(fill, lightenColor);
    const rotation = instance.data.rotation ?? 0;
    const innerOffset = {
      x: -size.width * INNER_OFFSET_FACTOR,
      y: 0,
    };

    return {
      staticPrimitives: [
        createStaticRectanglePrimitive({
          center: instance.data.position,
          size,
          fill,
          rotation,
        }),
        createStaticCirclePrimitive({
          center: instance.data.position,
          radius,
          fill: innerFill,
          rotation,
          offset: innerOffset,
        }),
      ],
      dynamicPrimitives: [],
    };
  }
}
