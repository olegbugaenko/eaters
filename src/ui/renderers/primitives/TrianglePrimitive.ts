import {
  SceneFill,
  SceneObjectInstance,
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

interface TrianglePrimitiveOptions {
  center: SceneVector2;
  vertices: TriangleVertices;
  fill: SceneFill;
  rotation?: number;
  offset?: SceneVector2;
}

interface DynamicTrianglePrimitiveOptions {
  vertices?: TriangleVertices;
  getVertices?: (instance: SceneObjectInstance) => TriangleVertices;
  fill?: SceneFill;
  getFill?: (instance: SceneObjectInstance) => SceneFill;
  offset?: SceneVector2;
}

type TriangleVertices = [SceneVector2, SceneVector2, SceneVector2];

type TriangleGeometry = {
  centerOffset: SceneVector2;
  size: { width: number; height: number };
};

const VERTEX_COUNT = 3;
const MIN_SIZE = 1e-6;

const cloneVertex = (vertex: SceneVector2): SceneVector2 => ({
  x: vertex.x,
  y: vertex.y,
});

const cloneVertices = (vertices: TriangleVertices): TriangleVertices => [
  cloneVertex(vertices[0]!),
  cloneVertex(vertices[1]!),
  cloneVertex(vertices[2]!),
];

const resolveVertices = (
  options: DynamicTrianglePrimitiveOptions,
  instance: SceneObjectInstance
): TriangleVertices => {
  if (typeof options.getVertices === "function") {
    return cloneVertices(options.getVertices(instance));
  }
  if (options.vertices) {
    return cloneVertices(options.vertices);
  }
  return [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
};

const resolveFill = (
  options: DynamicTrianglePrimitiveOptions,
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

const computeGeometry = (vertices: TriangleVertices): TriangleGeometry => {
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

const buildTriangleData = (
  center: SceneVector2,
  rotation: number,
  vertices: TriangleVertices,
  fillComponents: Float32Array
): Float32Array => {
  const data = new Float32Array(VERTEX_COUNT * VERTEX_COMPONENTS);
  let writeOffset = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const point = transformObjectPoint(center, rotation, vertices[i]);
    writeOffset = pushVertex(data, writeOffset, point.x, point.y, fillComponents);
  }
  return data;
};

const updateTriangleData = (
  target: Float32Array,
  center: SceneVector2,
  rotation: number,
  vertices: TriangleVertices,
  fillComponents: Float32Array
): boolean => {
  let offset = 0;
  let changed = false;
  for (let i = 0; i < vertices.length; i += 1) {
    const point = transformObjectPoint(center, rotation, vertices[i]);
    if (assignVertex(target, offset, point.x, point.y, fillComponents)) {
      changed = true;
    }
    offset += VERTEX_COMPONENTS;
  }
  return changed;
};

export const createStaticTrianglePrimitive = (
  options: TrianglePrimitiveOptions
): StaticPrimitive => {
  const rotation = options.rotation ?? 0;
  const origin = transformObjectPoint(
    options.center,
    options.rotation,
    options.offset
  );
  const vertices = cloneVertices(options.vertices);
  const geometry = computeGeometry(vertices);
  const fillCenter = transformObjectPoint(
    origin,
    rotation,
    geometry.centerOffset
  );
  const fillComponents = createFillVertexComponents({
    fill: options.fill,
    center: fillCenter,
    rotation,
    size: geometry.size,
  });

  return {
    data: buildTriangleData(origin, rotation, vertices, fillComponents),
  };
};

export const createDynamicTrianglePrimitive = (
  instance: SceneObjectInstance,
  options: DynamicTrianglePrimitiveOptions = {}
): DynamicPrimitive => {
  const initialVertices = resolveVertices(options, instance);
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

  const data = buildTriangleData(origin, rotation, initialVertices, fillComponents);

  return {
    data,
    update(target: SceneObjectInstance) {
      const nextVertices = resolveVertices(options, target);
      geometry = computeGeometry(nextVertices);
      origin = getCenter(target);
      rotation = target.data.rotation ?? 0;
      fillCenter = transformObjectPoint(origin, rotation, geometry.centerOffset);
      fillComponents = createFillVertexComponents({
        fill: resolveFill(options, target),
        center: fillCenter,
        rotation,
        size: geometry.size,
      });
      const changed = updateTriangleData(
        data,
        origin,
        rotation,
        nextVertices,
        fillComponents
      );
      return changed ? data : null;
    },
  };
};
