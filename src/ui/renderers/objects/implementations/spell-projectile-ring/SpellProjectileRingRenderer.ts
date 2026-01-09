import { ObjectRenderer, ObjectRegistration } from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { createDynamicCirclePrimitive } from "../../../primitives";
import { RING_SEGMENT_COUNT } from "./constants";
import { getAnimatedRingFill, getAnimatedRingRadius } from "./helpers";

export class SpellProjectileRingRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    return {
      staticPrimitives: [],
      dynamicPrimitives: [
        createDynamicCirclePrimitive(instance, {
          segments: RING_SEGMENT_COUNT,
          getFill: getAnimatedRingFill,
          getRadius: getAnimatedRingRadius,
        }),
      ],
    };
  }
}
