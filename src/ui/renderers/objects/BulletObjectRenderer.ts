import { ObjectRegistration, ObjectRenderer } from "./ObjectRenderer";
import { SceneObjectInstance } from "../../../logic/services/SceneObjectManager";
import { createDynamicCirclePrimitive } from "../primitives";

export class BulletObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    return {
      staticPrimitives: [],
      dynamicPrimitives: [createDynamicCirclePrimitive(instance)],
    };
  }
}
