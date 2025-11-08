import {
  FILL_TYPES,
  SceneFill,
  SceneObjectInstance,
  SceneVector2,
  SceneStroke,
} from "../../../../logic/services/SceneObjectManager";
import {
  DynamicPrimitive,
  StaticPrimitive,
  VERTEX_COMPONENTS,
  transformObjectPoint,
} from "../../objects/ObjectRenderer";
import {
  copyFillComponents,
  createFillVertexComponents,
  writeFillVertexComponents,
} from "../utils/fill";

interface PolygonPrimitiveOptions {
  center: SceneVector2;
  vertices: SceneVector2[];
  fill: SceneFill;
  rotation?: number;
  offset?: SceneVector2;
}

interface DynamicPolygonPrimitiveOptions {
  vertices?: SceneVector2[];
  getVertices?: (instance: SceneObjectInstance) => SceneVector2[];
  fill?: SceneFill;
  getFill?: (instance: SceneObjectInstance) => SceneFill;
  offset?: SceneVector2;
}

interface PolygonStrokeOptions {
  center: SceneVector2;
  vertices: SceneVector2[];
  stroke: SceneStroke;
  rotation?: number;
  offset?: SceneVector2;
}

type PolygonVertices = SceneVector2[];

type PolygonGeometry = {
  centerOffset: SceneVector2;
  size: { width: number; height: number };
};

const MIN_VERTEX_COUNT = 3;
const MIN_SIZE = 1e-6;

const cloneVertex = (vertex: SceneVector2): SceneVector2 => ({
  x: vertex.x,
  y: vertex.y,
});

const cloneVertices = (vertices: PolygonVertices): PolygonVertices =>
  vertices.map((vertex) => cloneVertex(vertex));

const ensureVertices = (vertices: SceneVector2[] | undefined): PolygonVertices => {
  if (!vertices || vertices.length < MIN_VERTEX_COUNT) {
    return [
      { x: -10, y: -10 },
      { x: 10, y: -10 },
      { x: 0, y: 15 },
    ];
  }
  return vertices.map((vertex) => ({
    x: typeof vertex.x === "number" ? vertex.x : 0,
    y: typeof vertex.y === "number" ? vertex.y : 0,
  }));
};

const resolveVertices = (
  options: DynamicPolygonPrimitiveOptions,
  instance: SceneObjectInstance
): PolygonVertices => {
  if (typeof options.getVertices === "function") {
    return ensureVertices(options.getVertices(instance));
  }
  if (options.vertices) {
    return ensureVertices(options.vertices);
  }
  const data = instance.data.customData as
    | { vertices?: SceneVector2[] }
    | undefined;
  return ensureVertices(data?.vertices);
};

const resolveFill = (
  options: DynamicPolygonPrimitiveOptions,
  instance: SceneObjectInstance
): SceneFill => {
  if (typeof options.getFill === "function") {
    return options.getFill(instance);
  }
  if (options.fill) {
    return options.fill;
  }
  return instance.data.fill;
};

const computeGeometry = (vertices: PolygonVertices): PolygonGeometry => {
  if (vertices.length < MIN_VERTEX_COUNT) {
    return {
      centerOffset: { x: 0, y: 0 },
      size: { width: MIN_SIZE, height: MIN_SIZE },
    };
  }
  let minX = vertices[0]!.x;
  let maxX = vertices[0]!.x;
  let minY = vertices[0]!.y;
  let maxY = vertices[0]!.y;

  for (let i = 1; i < vertices.length; i += 1) {
    const vertex = vertices[i]!;
    if (vertex.x < minX) {
      minX = vertex.x;
    }
    if (vertex.x > maxX) {
      maxX = vertex.x;
    }
    if (vertex.y < minY) {
      minY = vertex.y;
    }
    if (vertex.y > maxY) {
      maxY = vertex.y;
    }
  }

  const centerOffset = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };

  const width = Math.max(MIN_SIZE, maxX - minX);
  const height = Math.max(MIN_SIZE, maxY - minY);

  return {
    centerOffset,
    size: { width, height },
  };
};

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

const buildPolygonData = (
  center: SceneVector2,
  rotation: number,
  vertices: PolygonVertices,
  fillComponents: Float32Array
): Float32Array => {
  const triangleCount = Math.max(vertices.length - 2, 0);
  if (triangleCount <= 0) {
    return new Float32Array(0);
  }
  const transformed = vertices.map((vertex) =>
    transformObjectPoint(center, rotation, vertex)
  );
  const data = new Float32Array(triangleCount * 3 * VERTEX_COMPONENTS);
  let writeOffset = 0;
  const anchor = transformed[0]!;
  for (let i = 1; i < transformed.length - 1; i += 1) {
    writeOffset = pushVertex(
      data,
      writeOffset,
      anchor.x,
      anchor.y,
      fillComponents
    );
    const current = transformed[i]!;
    writeOffset = pushVertex(
      data,
      writeOffset,
      current.x,
      current.y,
      fillComponents
    );
    const next = transformed[i + 1]!;
    writeOffset = pushVertex(data, writeOffset, next.x, next.y, fillComponents);
  }
  return data;
};

const updatePolygonData = (
  target: Float32Array,
  center: SceneVector2,
  rotation: number,
  vertices: PolygonVertices,
  fillComponents: Float32Array
): boolean => {
  const triangleCount = Math.max(vertices.length - 2, 0);
  if (triangleCount <= 0) {
    if (target.length === 0) {
      return false;
    }
    for (let i = 0; i < target.length; i += 1) {
      if (target[i] !== 0) {
        target[i] = 0;
      }
    }
    return true;
  }
  const transformed = vertices.map((vertex) =>
    transformObjectPoint(center, rotation, vertex)
  );
  let offset = 0;
  let changed = false;
  const anchor = transformed[0]!;
  for (let i = 1; i < transformed.length - 1; i += 1) {
    changed =
      assignVertex(target, offset, anchor.x, anchor.y, fillComponents) || changed;
    offset += VERTEX_COMPONENTS;

    const current = transformed[i]!;
    changed =
      assignVertex(target, offset, current.x, current.y, fillComponents) ||
      changed;
    offset += VERTEX_COMPONENTS;

    const next = transformed[i + 1]!;
    changed =
      assignVertex(target, offset, next.x, next.y, fillComponents) || changed;
    offset += VERTEX_COMPONENTS;
  }
  return changed;
};

const expandVertices = (
  vertices: PolygonVertices,
  centerOffset: SceneVector2,
  strokeWidth: number
): PolygonVertices => {
  if (strokeWidth <= 0) {
    return cloneVertices(vertices);
  }
  return vertices.map((vertex) => {
    const dir = {
      x: vertex.x - centerOffset.x,
      y: vertex.y - centerOffset.y,
    };
    const length = Math.hypot(dir.x, dir.y);
    if (length === 0) {
      return {
        x: vertex.x + strokeWidth,
        y: vertex.y,
      };
    }
    const scale = (length + strokeWidth) / Math.max(length, 1e-6);
    return {
      x: centerOffset.x + dir.x * scale,
      y: centerOffset.y + dir.y * scale,
    };
  });
};

const createStrokeFill = (stroke: SceneStroke): SceneFill => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: stroke.color.r,
    g: stroke.color.g,
    b: stroke.color.b,
    a: typeof stroke.color.a === "number" ? stroke.color.a : 1,
  },
});

export const createStaticPolygonPrimitive = (
  options: PolygonPrimitiveOptions
): StaticPrimitive => {
  const { center, vertices, fill, rotation, offset } = options;
  const origin = transformObjectPoint(center, rotation, offset);
  const geometry = computeGeometry(vertices);
  const fillCenter = transformObjectPoint(
    origin,
    rotation ?? 0,
    geometry.centerOffset
  );
  const fillComponents = createFillVertexComponents({
    fill,
    center: fillCenter,
    rotation: rotation ?? 0,
    size: geometry.size,
  });
  return {
    data: buildPolygonData(origin, rotation ?? 0, vertices, fillComponents),
  };
};

export const createDynamicPolygonPrimitive = (
  instance: SceneObjectInstance,
  options: DynamicPolygonPrimitiveOptions = {}
): DynamicPrimitive => {
  const initialVertices = resolveVertices(options, instance);
  let vertexCount = initialVertices.length;
  let geometry = computeGeometry(initialVertices);
  const getCenter = (target: SceneObjectInstance): SceneVector2 =>
    transformObjectPoint(target.data.position, target.data.rotation, options.offset);

  let origin = getCenter(instance);
  let rotation = instance.data.rotation ?? 0;
  let fillCenter = transformObjectPoint(origin, rotation, geometry.centerOffset);
  let fillComponents = createFillVertexComponents({
    fill: resolveFill(options, instance),
    center: fillCenter,
    rotation,
    size: geometry.size,
  });

  let data = buildPolygonData(origin, rotation, initialVertices, fillComponents);
  const fillScratch = new Float32Array(fillComponents.length);

  const primitive: DynamicPrimitive = {
    get data() {
      return data;
    },
    update(target: SceneObjectInstance) {
      const nextVertices = resolveVertices(options, target);
      const nextVertexCount = nextVertices.length;
      geometry = computeGeometry(nextVertices);
      origin = getCenter(target);
      rotation = target.data.rotation ?? 0;
      fillCenter = transformObjectPoint(origin, rotation, geometry.centerOffset);
      // Reuse a single scratch buffer to avoid per-frame allocations
      fillComponents = writeFillVertexComponents(fillScratch, {
        fill: resolveFill(options, target),
        center: fillCenter,
        rotation,
        size: geometry.size,
      });

      if (nextVertexCount !== vertexCount) {
        vertexCount = nextVertexCount;
        data = buildPolygonData(origin, rotation, nextVertices, fillComponents);
        return data;
      }

      const changed = updatePolygonData(
        data,
        origin,
        rotation,
        nextVertices,
        fillComponents
      );
      return changed ? data : null;
    },
  };

  return primitive;
};

interface DynamicPolygonStrokePrimitiveOptions {
  vertices?: SceneVector2[];
  getVertices?: (instance: SceneObjectInstance) => SceneVector2[];
  stroke: SceneStroke;
  offset?: SceneVector2;
}

const buildStrokeBandData = (
  center: SceneVector2,
  rotation: number,
  inner: PolygonVertices,
  outer: PolygonVertices,
  fillComponents: Float32Array
): Float32Array => {
  const n = Math.min(inner.length, outer.length);
  if (n < MIN_VERTEX_COUNT) {
    return new Float32Array(0);
  }
  const innerT = inner.map((v) => transformObjectPoint(center, rotation, v));
  const outerT = outer.map((v) => transformObjectPoint(center, rotation, v));
  // Two triangles per edge
  const triCount = n * 2;
  const data = new Float32Array(triCount * 3 * VERTEX_COMPONENTS);
  let write = 0;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const A = outerT[i]!;
    const B = outerT[j]!;
    const a = innerT[i]!;
    const b = innerT[j]!;
    // Triangle 1: A, B, a
    write = pushVertex(data, write, A.x, A.y, fillComponents);
    write = pushVertex(data, write, B.x, B.y, fillComponents);
    write = pushVertex(data, write, a.x, a.y, fillComponents);
    // Triangle 2: a, B, b
    write = pushVertex(data, write, a.x, a.y, fillComponents);
    write = pushVertex(data, write, B.x, B.y, fillComponents);
    write = pushVertex(data, write, b.x, b.y, fillComponents);
  }
  return data;
};

export const createDynamicPolygonStrokePrimitive = (
  instance: SceneObjectInstance,
  options: DynamicPolygonStrokePrimitiveOptions
): DynamicPrimitive => {
  const resolveVerts = (target: SceneObjectInstance): PolygonVertices => {
    if (typeof options.getVertices === "function") {
      return ensureVertices(options.getVertices(target));
    }
    if (options.vertices) {
      return ensureVertices(options.vertices);
    }
    const data = target.data.customData as { vertices?: SceneVector2[] } | undefined;
    return ensureVertices(data?.vertices);
  };
  const getCenter = (target: SceneObjectInstance): SceneVector2 =>
    transformObjectPoint(target.data.position, target.data.rotation, options.offset);

  let inner = resolveVerts(instance);
  let geometry = computeGeometry(inner);
  let origin = getCenter(instance);
  let rotation = instance.data.rotation ?? 0;
  const strokeFill = createStrokeFill(options.stroke);
  let fillCenter = transformObjectPoint(origin, rotation, geometry.centerOffset);
  let fillComponents = createFillVertexComponents({
    fill: strokeFill,
    center: fillCenter,
    rotation,
    size: geometry.size,
  });
  let outer = expandVertices(inner, geometry.centerOffset, options.stroke.width);
  let data = buildStrokeBandData(origin, rotation, inner, outer, fillComponents);
  const fillScratch = new Float32Array(fillComponents.length);

  const primitive: DynamicPrimitive = {
    get data() {
      return data;
    },
    update(target: SceneObjectInstance) {
      inner = resolveVerts(target);
      geometry = computeGeometry(inner);
      origin = getCenter(target);
      rotation = target.data.rotation ?? 0;
      fillCenter = transformObjectPoint(origin, rotation, geometry.centerOffset);
      fillComponents = writeFillVertexComponents(fillScratch, {
        fill: strokeFill,
        center: fillCenter,
        rotation,
        size: geometry.size,
      });
      outer = expandVertices(inner, geometry.centerOffset, options.stroke.width);
      data = buildStrokeBandData(origin, rotation, inner, outer, fillComponents);
      return data;
    },
  };

  return primitive;
};

export const createStaticPolygonStrokePrimitive = (
  options: PolygonStrokeOptions
): StaticPrimitive | null => {
  const { stroke, vertices } = options;
  if (!stroke || stroke.width <= 0) {
    return null;
  }
  const geometry = computeGeometry(vertices);
  const expanded = expandVertices(vertices, geometry.centerOffset, stroke.width);
  return createStaticPolygonPrimitive({
    center: options.center,
    vertices: expanded,
    fill: createStrokeFill(stroke),
    rotation: options.rotation,
    offset: options.offset,
  });
};
