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
  writeFillVertexComponents,
} from "./fill";

interface CirclePrimitiveOptions {
  center: SceneVector2;
  radius: number;
  fill: SceneFill;
  segments?: number;
  rotation?: number;
  offset?: SceneVector2;
}

interface DynamicCircleOptions {
  segments?: number;
  offset?: SceneVector2;
  radius?: number;
  getRadius?: (instance: SceneObjectInstance, previousRadius: number) => number;
  fill?: SceneFill;
  getFill?: (instance: SceneObjectInstance) => SceneFill;
}

const DEFAULT_SEGMENTS = 24;

const getRadiusFromSize = (size: SceneSize | undefined, fallback: number): number => {
  if (!size) {
    return fallback;
  }
  return Math.max(size.width, size.height) / 2;
};

const resolveRadius = (
  options: DynamicCircleOptions,
  instance: SceneObjectInstance,
  fallback: number
): number => {
  if (typeof options.getRadius === "function") {
    const resolved = options.getRadius(instance, fallback);
    if (typeof resolved === "number" && Number.isFinite(resolved)) {
      return resolved;
    }
  }
  if (typeof options.radius === "number" && Number.isFinite(options.radius)) {
    return options.radius;
  }
  return getRadiusFromSize(instance.data.size, fallback);
};

const resolveFill = (
  options: DynamicCircleOptions,
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

const buildCircleData = (
  position: SceneVector2,
  radius: number,
  fillComponents: Float32Array,
  segments: number
): Float32Array => {
  const vertexCount = segments * 3;
  const data = new Float32Array(vertexCount * VERTEX_COMPONENTS);
  let offset = 0;
  for (let i = 0; i < segments; i += 1) {
    const angle1 = (i / segments) * Math.PI * 2;
    const angle2 = ((i + 1) / segments) * Math.PI * 2;
    offset = pushVertex(data, offset, position.x, position.y, fillComponents);
    offset = pushVertex(
      data,
      offset,
      position.x + Math.cos(angle1) * radius,
      position.y + Math.sin(angle1) * radius,
      fillComponents
    );
    offset = pushVertex(
      data,
      offset,
      position.x + Math.cos(angle2) * radius,
      position.y + Math.sin(angle2) * radius,
      fillComponents
    );
  }
  return data;
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

const updateCircleData = (
  target: Float32Array,
  position: SceneVector2,
  radius: number,
  fillComponents: Float32Array,
  segments: number
): boolean => {
  let changed = false;
  let offset = 0;
  for (let i = 0; i < segments; i += 1) {
    const angle1 = (i / segments) * Math.PI * 2;
    const angle2 = ((i + 1) / segments) * Math.PI * 2;

    changed =
      assignVertex(target, offset, position.x, position.y, fillComponents) ||
      changed;
    offset += VERTEX_COMPONENTS;

    const x1 = position.x + Math.cos(angle1) * radius;
    const y1 = position.y + Math.sin(angle1) * radius;
    changed = assignVertex(target, offset, x1, y1, fillComponents) || changed;
    offset += VERTEX_COMPONENTS;

    const x2 = position.x + Math.cos(angle2) * radius;
    const y2 = position.y + Math.sin(angle2) * radius;
    changed = assignVertex(target, offset, x2, y2, fillComponents) || changed;
    offset += VERTEX_COMPONENTS;
  }
  return changed;
};

export const createStaticCirclePrimitive = (
  options: CirclePrimitiveOptions
): StaticPrimitive => {
  const segments = options.segments ?? DEFAULT_SEGMENTS;
  const rotation = options.rotation ?? 0;
  const center = transformObjectPoint(
    options.center,
    options.rotation,
    options.offset
  );
  const fillComponents = createFillVertexComponents({
    fill: options.fill,
    center,
    rotation,
    size: { width: options.radius * 2, height: options.radius * 2 },
    radius: options.radius,
  });
  return {
    data: buildCircleData(center, options.radius, fillComponents, segments),
  };
};

export const createDynamicCirclePrimitive = (
  instance: SceneObjectInstance,
  options: DynamicCircleOptions = {}
): DynamicPrimitive => {
  const segments = options.segments ?? DEFAULT_SEGMENTS;
  const initialCenter = getCenter(instance, options.offset);
  let radius = Math.max(
    resolveRadius(options, instance, getRadiusFromSize(instance.data.size, 0)),
    0
  );
  const data = buildCircleData(
    initialCenter,
    radius,
    createFillVertexComponents({
      fill: resolveFill(options, instance),
      center: initialCenter,
      rotation: instance.data.rotation ?? 0,
      size: {
        width: radius * 2,
        height: radius * 2,
      },
      radius,
    }),
    segments
  );
  const fillScratch = new Float32Array(
    // FILL_COMPONENTS length equals first triangle's fill components size
    (new Float32Array(0)).length + (createFillVertexComponents({
      fill: resolveFill(options, instance),
      center: initialCenter,
      rotation: instance.data.rotation ?? 0,
      size: { width: radius * 2, height: radius * 2 },
      radius,
    }).length)
  );

  return {
    data,
    update(target: SceneObjectInstance) {
      const nextCenter = getCenter(target, options.offset);
      const nextRadius = Math.max(
        resolveRadius(options, target, getRadiusFromSize(target.data.size, radius)),
        0
      );
      const fillComponents = writeFillVertexComponents(fillScratch, {
        fill: resolveFill(options, target),
        center: nextCenter,
        rotation: target.data.rotation ?? 0,
        size: {
          width: nextRadius * 2,
          height: nextRadius * 2,
        },
        radius: nextRadius,
      });
      const changed = updateCircleData(
        data,
        nextCenter,
        nextRadius,
        fillComponents,
        segments
      );
      radius = nextRadius;
      return changed ? data : null;
    },
  };
};

const getCenter = (
  instance: SceneObjectInstance,
  offset: SceneVector2 | undefined
): SceneVector2 => {
  return transformObjectPoint(
    instance.data.position,
    instance.data.rotation,
    offset
  );
};
