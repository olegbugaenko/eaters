import { ObjectRenderer, ObjectRegistration } from "../../ObjectRenderer";
import type {
  SceneFill,
  SceneObjectInstance,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { createDynamicRectanglePrimitive } from "../../../primitives";
import { hasStroke, createStrokeFill, expandSize } from "./helpers";

export class BrickObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const size = instance.data.size ?? { width: 0, height: 0 };
    const dynamicPrimitives = [];

    if (hasStroke(instance.data.stroke)) {
      const initialSize = size;
      dynamicPrimitives.push(
        createDynamicRectanglePrimitive(instance, {
          getSize: (target) => {
            const sizeSource = target.data.size ?? initialSize;
            const strokeSource = target.data.stroke; // rely on current stroke only
            const strokeWidth = strokeSource?.width ?? 0;
            if (!strokeSource || strokeWidth <= 0) {
              return { ...sizeSource };
            }
            return expandSize(sizeSource, strokeWidth);
          },
          getFill: (target) => {
            const strokeSource = target.data.stroke; // rely on current stroke only
            return strokeSource ? createStrokeFill(strokeSource) : target.data.fill;
          },
        })
      );
    }

    dynamicPrimitives.push(createDynamicRectanglePrimitive(instance));

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
