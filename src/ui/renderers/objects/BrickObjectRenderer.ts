import { ObjectRenderer, ObjectRegistration } from "./ObjectRenderer";
import {
  FILL_TYPES,
  SceneFill,
  SceneObjectInstance,
  SceneStroke,
} from "../../../logic/services/SceneObjectManager";
import {
  createStaticCirclePrimitive,
  createStaticRectanglePrimitive,
} from "../primitives";

const CIRCLE_SIZE_FACTOR = 0.4;
const INNER_OFFSET_FACTOR = 0.25;
const INNER_CIRCLE_COLOR = { r: 0.85, g: 0.85, b: 0.85, a: 1 } as const;

export class BrickObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const size = instance.data.size ?? { width: 0, height: 0 };
    const radius = (Math.min(size.width, size.height) * CIRCLE_SIZE_FACTOR) / 2;
    const fill = instance.data.fill;
    const innerFill = {
      fillType: FILL_TYPES.SOLID,
      color: { ...INNER_CIRCLE_COLOR },
    };
    const rotation = instance.data.rotation ?? 0;
    const innerOffset = {
      x: -size.width * INNER_OFFSET_FACTOR,
      y: 0,
    };

    const primitives = [];
    if (hasStroke(instance.data.stroke)) {
      primitives.push(
        createStaticRectanglePrimitive({
          center: instance.data.position,
          size: expandSize(size, instance.data.stroke.width),
          fill: createStrokeFill(instance.data.stroke),
          rotation,
        })
      );
    }

    primitives.push(
      createStaticRectanglePrimitive({
        center: instance.data.position,
        size,
        fill,
        rotation,
      })
    );

    primitives.push(
      createStaticCirclePrimitive({
        center: instance.data.position,
        radius,
        fill: innerFill,
        rotation,
        offset: innerOffset,
      })
    );

    return {
      staticPrimitives: primitives,
      dynamicPrimitives: [],
    };
  }
}

const hasStroke = (stroke: SceneStroke | undefined): stroke is SceneStroke =>
  !!stroke && typeof stroke.width === "number" && stroke.width > 0;

const expandSize = (
  size: { width: number; height: number },
  strokeWidth: number
): { width: number; height: number } => ({
  width: size.width + strokeWidth * 2,
  height: size.height + strokeWidth * 2,
});

const createStrokeFill = (stroke: SceneStroke): SceneFill => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: stroke.color.r,
    g: stroke.color.g,
    b: stroke.color.b,
    a: typeof stroke.color.a === "number" ? stroke.color.a : 1,
  },
});
