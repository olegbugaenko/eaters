import {
  SceneFill,
  SceneObjectInstance,
  SceneSize,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";
import {
  DynamicPrimitive,
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

interface DynamicRectangleOptions {
  getSize?: (instance: SceneObjectInstance) => SceneSize | undefined;
  getFill?: (instance: SceneObjectInstance) => SceneFill | undefined;
  getRotation?: (instance: SceneObjectInstance) => number | undefined;
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

export const createDynamicRectanglePrimitive = (
  instance: SceneObjectInstance,
  options: DynamicRectangleOptions = {}
): DynamicPrimitive => {
  const initialRotation = resolveRotation(instance, options);
  const initialCenter = transformObjectPoint(
    instance.data.position,
    initialRotation,
    options.offset
  );
  const initialSize = sanitizeSize(resolveSize(instance, options));
  const initialFill = resolveFill(instance, options);

  const fillComponents = createFillVertexComponents({
    fill: initialFill,
    center: initialCenter,
    rotation: initialRotation,
    size: initialSize,
  });

  const data = buildRectangleData(
    initialCenter,
    initialSize,
    initialRotation,
    fillComponents
  );

  return {
    data,
    update(target: SceneObjectInstance) {
      const nextRotation = resolveRotation(target, options);
      const nextCenter = transformObjectPoint(
        target.data.position,
        nextRotation,
        options.offset
      );
      const nextSize = sanitizeSize(resolveSize(target, options));
      const nextFill = resolveFill(target, options);
      const fill = createFillVertexComponents({
        fill: nextFill,
        center: nextCenter,
        rotation: nextRotation,
        size: nextSize,
      });

      const changed = updateRectangleData(
        data,
        nextCenter,
        nextSize,
        nextRotation,
        fill
      );
      return changed ? data : null;
    },
  };
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

const buildRectangleData = (
  center: SceneVector2,
  size: SceneSize,
  rotation: number,
  fillComponents: Float32Array
): Float32Array => {
  const data = new Float32Array(VERTEX_COUNT * VERTEX_COMPONENTS);
  updateRectangleData(data, center, size, rotation, fillComponents);
  return data;
};

const updateRectangleData = (
  target: Float32Array,
  center: SceneVector2,
  size: SceneSize,
  rotation: number,
  fillComponents: Float32Array
): boolean => {
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const bottomLeft = transformCorner(-halfWidth, halfHeight, center, cos, sin);
  const bottomRight = transformCorner(halfWidth, halfHeight, center, cos, sin);
  const topLeft = transformCorner(-halfWidth, -halfHeight, center, cos, sin);
  const topRight = transformCorner(halfWidth, -halfHeight, center, cos, sin);

  const vertices = [
    bottomLeft,
    bottomRight,
    topLeft,
    topLeft,
    bottomRight,
    topRight,
  ];

  let changed = false;
  let offset = 0;
  vertices.forEach((vertex) => {
    changed =
      assignVertex(target, offset, vertex.x, vertex.y, fillComponents) || changed;
    offset += VERTEX_COMPONENTS;
  });
  return changed;
};

const assignVertex = (
  target: Float32Array,
  offset: number,
  x: number,
  y: number,
  fillComponents: Float32Array
): boolean => {
  let changed = false;
  if (target[offset + 0] !== x) {
    target[offset + 0] = x;
    changed = true;
  }
  if (target[offset + 1] !== y) {
    target[offset + 1] = y;
    changed = true;
  }
  for (let i = 0; i < fillComponents.length; i += 1) {
    const index = offset + 2 + i;
    const value = fillComponents[i] ?? 0;
    if (target[index] !== value) {
      target[index] = value;
      changed = true;
    }
  }
  return changed;
};

const resolveSize = (
  instance: SceneObjectInstance,
  options: DynamicRectangleOptions
): SceneSize | undefined => {
  if (typeof options.getSize === "function") {
    return options.getSize(instance);
  }
  return instance.data.size;
};

const resolveFill = (
  instance: SceneObjectInstance,
  options: DynamicRectangleOptions
): SceneFill => {
  if (typeof options.getFill === "function") {
    const fill = options.getFill(instance);
    if (fill) {
      return fill;
    }
  }
  return instance.data.fill;
};

const resolveRotation = (
  instance: SceneObjectInstance,
  options: DynamicRectangleOptions
): number => {
  if (typeof options.getRotation === "function") {
    const rotation = options.getRotation(instance);
    if (typeof rotation === "number" && Number.isFinite(rotation)) {
      return rotation;
    }
  }
  return instance.data.rotation ?? 0;
};

const sanitizeSize = (size: SceneSize | undefined): SceneSize => {
  if (!size) {
    return { width: 0, height: 0 };
  }
  const width = Number.isFinite(size.width) ? size.width : 0;
  const height = Number.isFinite(size.height) ? size.height : 0;
  return { width, height };
};
