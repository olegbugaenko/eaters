import { DynamicPrimitive, ObjectRegistration, ObjectRenderer } from "./ObjectRenderer";
import {
  FILL_TYPES,
  SceneObjectInstance,
  SceneVector2,
  SceneStroke,
} from "../../../logic/services/SceneObjectManager";
import { createDynamicPolygonPrimitive } from "../primitives";

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

    const dynamicPrimitives: DynamicPrimitive[] = [];

    if (hasStroke(instance.data.stroke)) {
      const strokeVertices = expandVerticesForStroke(vertices, instance.data.stroke.width);
      const strokePrimitive = createDynamicPolygonPrimitive(instance, {
        vertices: strokeVertices,
        fill: createStrokeFill(instance.data.stroke),
        offset,
      });
      dynamicPrimitives.push(strokePrimitive);
    }

    dynamicPrimitives.push(
      createDynamicPolygonPrimitive(instance, {
        vertices,
        offset,
      })
    );

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}

const createStrokeFill = (stroke: SceneStroke) => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: stroke.color.r,
    g: stroke.color.g,
    b: stroke.color.b,
    a: typeof stroke.color.a === "number" ? stroke.color.a : 1,
  },
});

const expandVerticesForStroke = (vertices: SceneVector2[], strokeWidth: number) => {
  if (strokeWidth <= 0) {
    return vertices.map((vertex) => ({ ...vertex }));
  }

  const center = computeCenter(vertices);
  return vertices.map((vertex) => {
    const direction = {
      x: vertex.x - center.x,
      y: vertex.y - center.y,
    };
    const length = Math.hypot(direction.x, direction.y);
    if (length === 0) {
      return {
        x: vertex.x + strokeWidth,
        y: vertex.y,
      };
    }
    const scale = (length + strokeWidth) / Math.max(length, 1e-6);
    return {
      x: center.x + direction.x * scale,
      y: center.y + direction.y * scale,
    };
  });
};

const computeCenter = (vertices: SceneVector2[]): SceneVector2 => {
  if (vertices.length === 0) {
    return { x: 0, y: 0 };
  }

  let minX = vertices[0]!.x;
  let maxX = vertices[0]!.x;
  let minY = vertices[0]!.y;
  let maxY = vertices[0]!.y;

  for (let i = 1; i < vertices.length; i += 1) {
    const vertex = vertices[i]!;
    if (vertex.x < minX) {
      minX = vertex.x;
    } else if (vertex.x > maxX) {
      maxX = vertex.x;
    }
    if (vertex.y < minY) {
      minY = vertex.y;
    } else if (vertex.y > maxY) {
      maxY = vertex.y;
    }
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
};
