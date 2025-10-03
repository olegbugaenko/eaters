import {
  SceneFill,
  SceneSize,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";
import {
  StaticPrimitive,
  VERTEX_COMPONENTS,
  transformObjectPoint,
} from "../objects/ObjectRenderer";
import {
  copyFillComponents,
  createFillVertexComponents,
} from "./fill";

interface RectanglePrimitiveOptions {
  center: SceneVector2;
  size: SceneSize;
  fill: SceneFill;
  rotation?: number;
  offset?: SceneVector2;
}

const VERTEX_COUNT = 6;

const pushVertex = (
  target: Float32Array,
  offset: number,
  x: number,
  y: number,
  fillComponents: Float32Array
): number => {
  target[offset + 0] = x;
  target[offset + 1] = y;
  copyFillComponents(target, offset, fillComponents);
  return offset + VERTEX_COMPONENTS;
};

export const createStaticRectanglePrimitive = (
  options: RectanglePrimitiveOptions
): StaticPrimitive => {
  const { center, size, fill, rotation, offset } = options;
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;

  const actualCenter = transformObjectPoint(center, rotation, offset);
  const angle = rotation ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const fillComponents = createFillVertexComponents({
    fill,
    center: actualCenter,
    rotation: angle,
    size,
  });

  const bottomLeft = transformCorner(-halfWidth, halfHeight, actualCenter, cos, sin);
  const bottomRight = transformCorner(halfWidth, halfHeight, actualCenter, cos, sin);
  const topLeft = transformCorner(-halfWidth, -halfHeight, actualCenter, cos, sin);
  const topRight = transformCorner(halfWidth, -halfHeight, actualCenter, cos, sin);

  const data = new Float32Array(VERTEX_COUNT * VERTEX_COMPONENTS);
  let writeOffset = 0;

  // Triangle 1 (bottom-left, bottom-right, top-left)
  writeOffset = pushVertex(
    data,
    writeOffset,
    bottomLeft.x,
    bottomLeft.y,
    fillComponents
  );
  writeOffset = pushVertex(
    data,
    writeOffset,
    bottomRight.x,
    bottomRight.y,
    fillComponents
  );
  writeOffset = pushVertex(data, writeOffset, topLeft.x, topLeft.y, fillComponents);

  // Triangle 2 (top-left, bottom-right, top-right)
  writeOffset = pushVertex(data, writeOffset, topLeft.x, topLeft.y, fillComponents);
  writeOffset = pushVertex(
    data,
    writeOffset,
    bottomRight.x,
    bottomRight.y,
    fillComponents
  );
  pushVertex(data, writeOffset, topRight.x, topRight.y, fillComponents);

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
