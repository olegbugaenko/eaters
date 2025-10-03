import { ObjectRenderer, ObjectRegistration } from "./ObjectRenderer";
import { SceneObjectInstance } from "../../../logic/services/SceneObjectManager";
import {
  createRectanglePrimitive,
  createStaticCirclePrimitive,
} from "./primitives";

const CIRCLE_SIZE_FACTOR = 0.4;

export class BrickObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const size = instance.data.size ?? { width: 0, height: 0 };
    const radius = (Math.min(size.width, size.height) * CIRCLE_SIZE_FACTOR) / 2;

    return {
      staticPrimitives: [
        createRectanglePrimitive(instance.data.position, size),
        createStaticCirclePrimitive(instance.data.position, radius),
      ],
      dynamicPrimitives: [],
    };
  }
}
