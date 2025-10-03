import { ObjectRenderer, ObjectRegistration } from "./ObjectRenderer";
import { FILL_TYPES, SceneObjectInstance } from "../../../logic/services/SceneObjectManager";
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
