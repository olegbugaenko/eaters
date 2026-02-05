import { ObjectRenderer, ObjectRegistration } from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { createDynamicRectanglePrimitive } from "../../../primitives";
import { hasStroke, createStrokeFill, expandSize } from "./helpers";
import { brickFillResolver } from "./brick-fill-resolver";

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

    const initialFill = instance.data.fill;
    dynamicPrimitives.push(
      createDynamicRectanglePrimitive(instance, {
        getFill: (target) => brickFillResolver.resolve(target, initialFill),
      })
    );

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
