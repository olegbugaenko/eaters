import { ObjectRenderer, ObjectRegistration } from "./ObjectRenderer";
import { SceneObjectInstance } from "../../../logic/services/SceneObjectManager";
import { createDynamicCirclePrimitive } from "../primitives";

const RING_SEGMENT_COUNT = 48;

export class SpellProjectileRingRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    return {
      staticPrimitives: [],
      dynamicPrimitives: [
        createDynamicCirclePrimitive(instance, { segments: RING_SEGMENT_COUNT }),
      ],
    };
  }
}
