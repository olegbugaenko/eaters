import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { createDynamicRectanglePrimitive } from "../../../primitives";

export class ScreenOverlayRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const dynamicPrimitives: DynamicPrimitive[] = [];

    dynamicPrimitives.push(
      createDynamicRectanglePrimitive(instance, {
        getSize: (target) => target.data.size,
        getFill: (target) => target.data.fill,
      })
    );

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
