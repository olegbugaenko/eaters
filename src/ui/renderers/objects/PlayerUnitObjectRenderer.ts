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

interface PlayerUnitRendererPayload {
  kind?: string;
  vertices?: SceneVector2[];
  offset?: SceneVector2;
}

interface PlayerUnitCustomData {
  renderer?: PlayerUnitRendererPayload;
}

const DEFAULT_VERTICES: SceneVector2[] = [
  { x: 0, y: -18 },
  { x: 17, y: -6 },
  { x: 11, y: 16 },
  { x: -11, y: 16 },
  { x: -17, y: -6 },
];

const isVector = (value: unknown): value is SceneVector2 =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as SceneVector2).x === "number" &&
  typeof (value as SceneVector2).y === "number";

const sanitizeVertices = (vertices: SceneVector2[] | undefined): SceneVector2[] => {
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

const sanitizeOffset = (offset: SceneVector2 | undefined): SceneVector2 | undefined => {
  if (!offset || !isVector(offset)) {
    return undefined;
  }
  return { x: offset.x, y: offset.y };
};

const extractRendererData = (
  instance: SceneObjectInstance
): { vertices: SceneVector2[]; offset?: SceneVector2 } => {
  const payload = instance.data.customData as PlayerUnitCustomData | undefined;
  if (!payload || typeof payload !== "object") {
    return { vertices: DEFAULT_VERTICES.map((vertex) => ({ ...vertex })) };
  }
  const renderer = payload.renderer;
  if (!renderer || renderer.kind !== "polygon") {
    return { vertices: DEFAULT_VERTICES.map((vertex) => ({ ...vertex })) };
  }
  return {
    vertices: sanitizeVertices(renderer.vertices),
    offset: sanitizeOffset(renderer.offset),
  };
};

const hasStroke = (stroke: SceneStroke | undefined): stroke is SceneStroke =>
  !!stroke && typeof stroke.width === "number" && stroke.width > 0;

export class PlayerUnitObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const { vertices, offset } = extractRendererData(instance);
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
