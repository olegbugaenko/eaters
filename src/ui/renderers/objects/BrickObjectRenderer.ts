import { ObjectRenderer, ObjectRegistration } from "./ObjectRenderer";
import {
  SceneFill,
  SceneObjectInstance,
  SceneStroke,
} from "../../../logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import { createDynamicRectanglePrimitive } from "../primitives";

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

    dynamicPrimitives.push(
      createDynamicRectanglePrimitive(instance)
    );

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}

const hasStroke = (stroke: SceneStroke | undefined): stroke is SceneStroke =>
  !!stroke && typeof stroke.width === "number" && stroke.width > 0;

const expandSize = (
  size: { width: number; height: number },
  strokeWidth: number
): { width: number; height: number } => ({
  width: size.width + strokeWidth * 2,
  height: size.height + strokeWidth * 2,
});

const createStrokeFill = (stroke: SceneStroke): SceneFill => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: stroke.color.r,
    g: stroke.color.g,
    b: stroke.color.b,
    a: typeof stroke.color.a === "number" ? stroke.color.a : 1,
  },
});
