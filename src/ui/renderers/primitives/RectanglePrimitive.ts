import {
  SceneColor,
  SceneSize,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";
import {
  StaticPrimitive,
  VERTEX_COMPONENTS,
  transformObjectPoint,
} from "../objects/ObjectRenderer";

interface RectanglePrimitiveOptions {
  center: SceneVector2;
  size: SceneSize;
  color: SceneColor;
  rotation?: number;
  offset?: SceneVector2;
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

export const createStaticRectanglePrimitive = (
  options: RectanglePrimitiveOptions
): StaticPrimitive => {
  const { center, size, color, rotation, offset } = options;
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const alpha = resolveAlpha(color);

  const actualCenter = transformObjectPoint(center, rotation, offset);
  const angle = rotation ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const bottomLeft = transformCorner(-halfWidth, halfHeight, actualCenter, cos, sin);
  const bottomRight = transformCorner(halfWidth, halfHeight, actualCenter, cos, sin);
  const topLeft = transformCorner(-halfWidth, -halfHeight, actualCenter, cos, sin);
  const topRight = transformCorner(halfWidth, -halfHeight, actualCenter, cos, sin);

  const data = new Float32Array(VERTEX_COUNT * VERTEX_COMPONENTS);
  let writeOffset = 0;

  // Triangle 1 (bottom-left, bottom-right, top-left)
  writeOffset = pushVertex(data, writeOffset, bottomLeft.x, bottomLeft.y, color, alpha);
  writeOffset = pushVertex(data, writeOffset, bottomRight.x, bottomRight.y, color, alpha);
  writeOffset = pushVertex(data, writeOffset, topLeft.x, topLeft.y, color, alpha);

  // Triangle 2 (top-left, bottom-right, top-right)
  writeOffset = pushVertex(data, writeOffset, topLeft.x, topLeft.y, color, alpha);
  writeOffset = pushVertex(data, writeOffset, bottomRight.x, bottomRight.y, color, alpha);
  pushVertex(data, writeOffset, topRight.x, topRight.y, color, alpha);

  return { data };
};

const transformCorner = (
  x: number,
  y: number,
  center: SceneVector2,
  cos: number,
  sin: number
): SceneVector2 => ({
  x: center.x + x * cos - y * sin,
  y: center.y + x * sin + y * cos,
});
