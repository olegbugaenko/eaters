import { ObjectRenderer, ObjectRegistration } from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { createDynamicCirclePrimitive } from "../../../primitives";

const HIGHLIGHT_SEGMENTS = 48;

export class SpellAreaHighlightRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    return {
      staticPrimitives: [],
      dynamicPrimitives: [
        createDynamicCirclePrimitive(instance, {
          segments: HIGHLIGHT_SEGMENTS,
          getFill: (target) => target.data.fill,
        }),
      ],
    };
  }
}
