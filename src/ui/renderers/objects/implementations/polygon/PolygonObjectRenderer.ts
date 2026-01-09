import { ObjectRegistration, ObjectRenderer } from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  createStaticPolygonPrimitive,
  createStaticPolygonStrokePrimitive,
} from "../../../primitives";
import { hasStroke } from "@shared/helpers/stroke.helper";
import { extractCustomData } from "./helpers";

export class PolygonObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const { vertices, offset } = extractCustomData(instance);
    const rotation = instance.data.rotation ?? 0;
    const primitives = [];

    if (hasStroke(instance.data.stroke)) {
      const strokePrimitive = createStaticPolygonStrokePrimitive({
        center: instance.data.position,
        vertices,
        stroke: instance.data.stroke,
        rotation,
        offset,
      });
      if (strokePrimitive) {
        primitives.push(strokePrimitive);
      }
    }

    primitives.push(
      createStaticPolygonPrimitive({
        center: instance.data.position,
        vertices,
        fill: instance.data.fill,
        rotation,
        offset,
      })
    );

    return {
      staticPrimitives: primitives,
      dynamicPrimitives: [],
    };
  }
}
