import { ObjectRenderer, ObjectRegistration } from "./ObjectRenderer";
import {
  SceneColor,
  SceneObjectInstance,
} from "../../../logic/services/SceneObjectManager";
import {
  createCirclePrimitive,
  createRectanglePrimitive,
} from "../primitives";

const CIRCLE_SIZE_FACTOR = 0.4;
const INNER_COLOR_LIGHTNESS = 0.85;

const resolveColor = (color: SceneColor | undefined): SceneColor => {
  if (!color) {
    return { r: 1, g: 1, b: 1, a: 1 };
  }
  return {
    r: color.r,
    g: color.g,
    b: color.b,
    a: typeof color.a === "number" ? color.a : 1,
  };
};

const createInnerColor = (base: SceneColor): SceneColor => {
  return {
    r: Math.min(1, base.r * INNER_COLOR_LIGHTNESS + (1 - INNER_COLOR_LIGHTNESS)),
    g: Math.min(1, base.g * INNER_COLOR_LIGHTNESS + (1 - INNER_COLOR_LIGHTNESS)),
    b: Math.min(1, base.b * INNER_COLOR_LIGHTNESS + (1 - INNER_COLOR_LIGHTNESS)),
    a: base.a,
  };
};

export class BrickObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const size = instance.data.size ?? { width: 0, height: 0 };
    const radius = (Math.min(size.width, size.height) * CIRCLE_SIZE_FACTOR) / 2;
    const color = resolveColor(instance.data.color);
    const innerColor = createInnerColor(color);

    return {
      staticPrimitives: [
        createRectanglePrimitive({
          position: instance.data.position,
          size,
          color,
        }),
        createCirclePrimitive({
          position: instance.data.position,
          radius,
          color: innerColor,
        }),
      ],
      dynamicPrimitives: [],
    };
  }
}
