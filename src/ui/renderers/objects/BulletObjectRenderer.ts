import { ObjectRegistration, ObjectRenderer } from "./ObjectRenderer";
import { SceneObjectInstance } from "../../../logic/services/SceneObjectManager";
import { createDynamicCirclePrimitive } from "./primitives";

export class BulletObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const size = instance.data.size ?? { width: 0, height: 0 };
    const radius = Math.max(size.width, size.height) / 2;

    return {
      staticPrimitives: [],
      dynamicPrimitives: [createDynamicCirclePrimitive(instance, radius)],
    };
  }
}
