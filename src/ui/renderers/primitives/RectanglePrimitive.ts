import {
  SceneColor,
  SceneSize,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";
import {
  StaticPrimitive,
  VERTEX_COMPONENTS,
} from "../objects/ObjectRenderer";

interface RectanglePrimitiveOptions {
  position: SceneVector2;
  size: SceneSize;
  color: SceneColor;
}

const VERTEX_COUNT = 6;

const resolveAlpha = (color: SceneColor): number => {
  if (typeof color.a === "number" && Number.isFinite(color.a)) {
    return color.a;
  }
  return 1;
};

const pushVertex = (
  target: Float32Array,
  offset: number,
  x: number,
  y: number,
  color: SceneColor,
  alpha: number
): number => {
  target[offset + 0] = x;
  target[offset + 1] = y;
  target[offset + 2] = color.r;
  target[offset + 3] = color.g;
  target[offset + 4] = color.b;
  target[offset + 5] = alpha;
  return offset + VERTEX_COMPONENTS;
};

export const createRectanglePrimitive = (
  options: RectanglePrimitiveOptions
): StaticPrimitive => {
  const { position, size, color } = options;
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const left = position.x - halfWidth;
  const right = position.x + halfWidth;
  const top = position.y - halfHeight;
  const bottom = position.y + halfHeight;
  const alpha = resolveAlpha(color);

  const data = new Float32Array(VERTEX_COUNT * VERTEX_COMPONENTS);
  let offset = 0;

  offset = pushVertex(data, offset, left, bottom, color, alpha);
  offset = pushVertex(data, offset, right, bottom, color, alpha);
  offset = pushVertex(data, offset, left, top, color, alpha);
  offset = pushVertex(data, offset, left, top, color, alpha);
  offset = pushVertex(data, offset, right, bottom, color, alpha);
  pushVertex(data, offset, right, top, color, alpha);

  return { data, vertexCount: VERTEX_COUNT };
};
