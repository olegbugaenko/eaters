import { ObjectRegistration, ObjectRenderer } from "./ObjectRenderer";
import {
  SceneObjectInstance,
  SceneVector2,
  SceneStroke,
} from "../../../logic/services/SceneObjectManager";
import {
  createStaticPolygonPrimitive,
  createStaticPolygonStrokePrimitive,
} from "../primitives";

interface PolygonCustomData {
  vertices?: SceneVector2[];
  offset?: SceneVector2;
}

const DEFAULT_VERTICES: SceneVector2[] = [
  { x: -20, y: -20 },
  { x: 20, y: -20 },
  { x: 0, y: 30 },
];

const isVector = (value: unknown): value is SceneVector2 =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as SceneVector2).x === "number" &&
  typeof (value as SceneVector2).y === "number";

const normalizeVertices = (vertices: SceneVector2[] | undefined): SceneVector2[] => {
  if (!Array.isArray(vertices)) {
    return DEFAULT_VERTICES.map((vertex) => ({ ...vertex }));
  }
  const sanitized = vertices
    .filter((vertex) => isVector(vertex))
    .map((vertex) => ({ x: vertex.x, y: vertex.y }));
  if (sanitized.length < 3) {
    return DEFAULT_VERTICES.map((vertex) => ({ ...vertex }));
  }
  return sanitized;
};

const normalizeOffset = (offset: SceneVector2 | undefined): SceneVector2 | undefined => {
  if (!offset || !isVector(offset)) {
    return undefined;
  }
  return { x: offset.x, y: offset.y };
};

const extractCustomData = (
  instance: SceneObjectInstance
): { vertices: SceneVector2[]; offset?: SceneVector2 } => {
  const payload = instance.data.customData as PolygonCustomData | undefined;
  if (!payload || typeof payload !== "object") {
    return { vertices: DEFAULT_VERTICES.map((vertex) => ({ ...vertex })) };
  }
  return {
    vertices: normalizeVertices(payload.vertices),
    offset: normalizeOffset(payload.offset),
  };
};

const hasStroke = (stroke: SceneStroke | undefined): stroke is SceneStroke =>
  !!stroke && typeof stroke.width === "number" && stroke.width > 0;

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
