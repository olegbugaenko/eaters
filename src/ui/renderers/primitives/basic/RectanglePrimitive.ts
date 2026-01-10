import {
  SceneFill,
  SceneObjectInstance,
  SceneSize,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  DynamicPrimitive,
  FILL_COMPONENTS,
  POSITION_COMPONENTS,
  CRACK_MASK_COMPONENTS,
  CRACK_EFFECTS_COMPONENTS,
  CRACK_UV_COMPONENTS,
  StaticPrimitive,
  VERTEX_COMPONENTS,
  transformObjectPoint,
} from "../../objects/ObjectRenderer";
import {
  copyFillComponents,
  createFillVertexComponents,
  writeFillVertexComponents,
} from "../utils/fill";

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
const CRACK_UV_OFFSET =
  POSITION_COMPONENTS +
  FILL_COMPONENTS -
  CRACK_EFFECTS_COMPONENTS -
  CRACK_MASK_COMPONENTS -
  CRACK_UV_COMPONENTS;

const pushVertex = (
  target: Float32Array,
  offset: number,
  x: number,
  y: number,
  u: number,
  v: number,
  fillComponents: Float32Array
): number => {
  target[offset + 0] = x;
  target[offset + 1] = y;
  copyFillComponents(target, offset, fillComponents);
  const uvOffset = offset + CRACK_UV_OFFSET;
  target[uvOffset + 0] = u;
  target[uvOffset + 1] = v;
  return offset + VERTEX_COMPONENTS;
};

// Maximum tile size for crack texture tiling
const MAX_CRACK_TILE_SIZE = 32;

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

  // Calculate number of tiles for crack texture
  const numTilesX = Math.ceil(size.width / MAX_CRACK_TILE_SIZE);
  const numTilesY = Math.ceil(size.height / MAX_CRACK_TILE_SIZE);

  const data = new Float32Array(VERTEX_COUNT * VERTEX_COMPONENTS);
  let writeOffset = 0;

  // Triangle 1 (bottom-left, bottom-right, top-left)
  writeOffset = pushVertex(
    data,
    writeOffset,
    bottomLeft.x,
    bottomLeft.y,
    0,
    numTilesY,
    fillComponents
  );
  writeOffset = pushVertex(
    data,
    writeOffset,
    bottomRight.x,
    bottomRight.y,
    numTilesX,
    numTilesY,
    fillComponents
  );
  writeOffset = pushVertex(
    data,
    writeOffset,
    topLeft.x,
    topLeft.y,
    0,
    0,
    fillComponents
  );

  // Triangle 2 (top-left, bottom-right, top-right)
  writeOffset = pushVertex(
    data,
    writeOffset,
    topLeft.x,
    topLeft.y,
    0,
    0,
    fillComponents
  );
  writeOffset = pushVertex(
    data,
    writeOffset,
    bottomRight.x,
    bottomRight.y,
    numTilesX,
    numTilesY,
    fillComponents
  );
  pushVertex(data, writeOffset, topRight.x, topRight.y, numTilesX, 0, fillComponents);

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

  // Reusable scratch buffer to avoid per-frame allocations for fill components
  const fillScratch = new Float32Array(fillComponents.length);
  // Track previous state to skip updates when nothing changed
  let prevCenterX = initialCenter.x;
  let prevCenterY = initialCenter.y;
  let prevWidth = initialSize.width;
  let prevHeight = initialSize.height;
  let prevRotation = initialRotation;

  // Reusable center object to avoid allocations
  const centerScratch: SceneVector2 = { x: initialCenter.x, y: initialCenter.y };

  return {
    data,
    update(target: SceneObjectInstance) {
      const nextRotation = resolveRotation(target, options);
      // Inline transformObjectPoint to avoid object allocation
      const pos = target.data.position;
      const offset = options.offset;
      let nextCenterX: number;
      let nextCenterY: number;
      if (!offset) {
        nextCenterX = pos.x;
        nextCenterY = pos.y;
      } else {
        const angle = nextRotation;
        if (angle === 0) {
          nextCenterX = pos.x + offset.x;
          nextCenterY = pos.y + offset.y;
        } else {
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          nextCenterX = pos.x + offset.x * cos - offset.y * sin;
          nextCenterY = pos.y + offset.x * sin + offset.y * cos;
        }
      }
      const nextSize = sanitizeSize(resolveSize(target, options));
      
      // Early bail if nothing changed geometrically
      const geometryChanged =
        nextCenterX !== prevCenterX ||
        nextCenterY !== prevCenterY ||
        nextSize.width !== prevWidth ||
        nextSize.height !== prevHeight ||
        nextRotation !== prevRotation;

      if (!geometryChanged) {
        // Still check fill - but skip geometry recalc
        centerScratch.x = nextCenterX;
        centerScratch.y = nextCenterY;
        const nextFill = resolveFill(target, options);
        const fill = writeFillVertexComponents(fillScratch, {
          fill: nextFill,
          center: centerScratch,
          rotation: nextRotation,
          size: nextSize,
        });
        // Just check if fill changed
        let fillChanged = false;
        const fillLen = fill.length;
        for (let i = 0; i < fillLen && !fillChanged; i++) {
          if (data[2 + i] !== fill[i]) {
            fillChanged = true;
          }
        }
        if (!fillChanged) {
          return null;
        }
        // Update fill only for all vertices
        for (let v = 0; v < VERTEX_COUNT; v++) {
          data.set(fill, v * VERTEX_COMPONENTS + 2);
        }
        const uvOffset = CRACK_UV_OFFSET;
        const vertStride = VERTEX_COMPONENTS;
        data[uvOffset + 0] = 0;
        data[uvOffset + 1] = 1;
        data[uvOffset + vertStride + 0] = 1;
        data[uvOffset + vertStride + 1] = 1;
        data[uvOffset + vertStride * 2 + 0] = 0;
        data[uvOffset + vertStride * 2 + 1] = 0;
        data[uvOffset + vertStride * 3 + 0] = 0;
        data[uvOffset + vertStride * 3 + 1] = 0;
        data[uvOffset + vertStride * 4 + 0] = 1;
        data[uvOffset + vertStride * 4 + 1] = 1;
        data[uvOffset + vertStride * 5 + 0] = 1;
        data[uvOffset + vertStride * 5 + 1] = 0;
        return data;
      }

      // Full update
      prevCenterX = nextCenterX;
      prevCenterY = nextCenterY;
      prevWidth = nextSize.width;
      prevHeight = nextSize.height;
      prevRotation = nextRotation;

      centerScratch.x = nextCenterX;
      centerScratch.y = nextCenterY;
      const nextFill = resolveFill(target, options);
      const fill = writeFillVertexComponents(fillScratch, {
        fill: nextFill,
        center: centerScratch,
        rotation: nextRotation,
        size: nextSize,
      });

      const changed = updateRectangleData(
        data,
        centerScratch,
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

// Optimized: zero allocations, inline corner writes
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
  const cx = center.x;
  const cy = center.y;

  // Pre-compute transformed corners inline (avoid object allocation)
  const negHalfW = -halfWidth;
  const negHalfH = -halfHeight;
  // bottomLeft: (-halfWidth, halfHeight)
  const blX = cx + negHalfW * cos - halfHeight * sin;
  const blY = cy + negHalfW * sin + halfHeight * cos;
  // bottomRight: (halfWidth, halfHeight)
  const brX = cx + halfWidth * cos - halfHeight * sin;
  const brY = cy + halfWidth * sin + halfHeight * cos;
  // topLeft: (-halfWidth, -halfHeight)
  const tlX = cx + negHalfW * cos - negHalfH * sin;
  const tlY = cy + negHalfW * sin + negHalfH * cos;
  // topRight: (halfWidth, -halfHeight)
  const trX = cx + halfWidth * cos - negHalfH * sin;
  const trY = cy + halfWidth * sin + negHalfH * cos;

  // Calculate number of tiles for crack texture
  const numTilesX = Math.ceil(size.width / MAX_CRACK_TILE_SIZE);
  const numTilesY = Math.ceil(size.height / MAX_CRACK_TILE_SIZE);

  let changed = false;
  const fillLen = fillComponents.length;

  // Helper to write vertex inline
  const writeVert = (offset: number, x: number, y: number, u: number, v: number): void => {
    if (target[offset] !== x) {
      target[offset] = x;
      changed = true;
    }
    if (target[offset + 1] !== y) {
      target[offset + 1] = y;
      changed = true;
    }
    // Copy fill components first
    const fillOffset = offset + 2;
    for (let j = 0; j < fillLen; j++) {
      const value = fillComponents[j]!;
      if (target[fillOffset + j] !== value) {
        target[fillOffset + j] = value;
        changed = true;
      }
    }
    // Then override crackUv with actual UV coordinates (fill has zeros)
    const uvOffset = offset + CRACK_UV_OFFSET;
    if (target[uvOffset] !== u) {
      target[uvOffset] = u;
      changed = true;
    }
    if (target[uvOffset + 1] !== v) {
      target[uvOffset + 1] = v;
      changed = true;
    }
  };

  // Triangle 1: bottomLeft, bottomRight, topLeft
  writeVert(0, blX, blY, 0, numTilesY);
  writeVert(VERTEX_COMPONENTS, brX, brY, numTilesX, numTilesY);
  writeVert(VERTEX_COMPONENTS * 2, tlX, tlY, 0, 0);
  // Triangle 2: topLeft, bottomRight, topRight
  writeVert(VERTEX_COMPONENTS * 3, tlX, tlY, 0, 0);
  writeVert(VERTEX_COMPONENTS * 4, brX, brY, numTilesX, numTilesY);
  writeVert(VERTEX_COMPONENTS * 5, trX, trY, numTilesX, 0);

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
