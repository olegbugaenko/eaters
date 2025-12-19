import {
  SceneFill,
  SceneObjectInstance,
  SceneSize,
  SceneVector2,
} from "../../../../logic/services/SceneObjectManager";
import {
  DynamicPrimitive,
  POSITION_COMPONENTS,
  StaticPrimitive,
  VERTEX_COMPONENTS,
  transformObjectPoint,
} from "../../objects/ObjectRenderer";
import {
  copyFillComponents,
  createFillVertexComponents,
  writeFillVertexComponents,
} from "../utils/fill";

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

interface CircleTrigLut {
  cos: Float32Array;
  sin: Float32Array;
}

const circleTrigCache = new Map<number, CircleTrigLut>();

const getCircleTrigLut = (segments: number): CircleTrigLut => {
  const normalized = Math.max(3, Math.floor(segments));
  const cached = circleTrigCache.get(normalized);
  if (cached) {
    return cached;
  }
  const cos = new Float32Array(normalized);
  const sin = new Float32Array(normalized);
  for (let i = 0; i < normalized; i += 1) {
    const angle = (i / normalized) * Math.PI * 2;
    cos[i] = Math.cos(angle);
    sin[i] = Math.sin(angle);
  }
  const lut = { cos, sin };
  circleTrigCache.set(normalized, lut);
  return lut;
};

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

const areFloatArraysEqual = (a: Float32Array, b: Float32Array): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av === bv || (Number.isNaN(av) && Number.isNaN(bv))) {
      continue;
    }
    return false;
  }
  return true;
};

const buildCircleData = (
  position: SceneVector2,
  radius: number,
  fillComponents: Float32Array,
  segments: number,
  trig: CircleTrigLut
): Float32Array => {
  const vertexCount = segments * 3;
  const data = new Float32Array(vertexCount * VERTEX_COMPONENTS);
  let offset = 0;
  for (let i = 0; i < segments; i += 1) {
    const cos1 = trig.cos[i] ?? 1;
    const sin1 = trig.sin[i] ?? 0;
    const nextIndex = (i + 1) % segments;
    const cos2 = trig.cos[nextIndex] ?? trig.cos[0] ?? 1;
    const sin2 = trig.sin[nextIndex] ?? trig.sin[0] ?? 0;
    offset = pushVertex(data, offset, position.x, position.y, fillComponents);
    offset = pushVertex(
      data,
      offset,
      position.x + cos1 * radius,
      position.y + sin1 * radius,
      fillComponents
    );
    offset = pushVertex(
      data,
      offset,
      position.x + cos2 * radius,
      position.y + sin2 * radius,
      fillComponents
    );
  }
  return data;
};

// Optimized: skip work when nothing changes, write data in bulk
const updateCircleData = (
  target: Float32Array,
  position: SceneVector2,
  radius: number,
  fillComponents: Float32Array,
  segments: number,
  trig: CircleTrigLut,
  updateGeometry: boolean,
  updateFill: boolean
): boolean => {
  if (!updateGeometry && !updateFill) {
    return false;
  }
  const posX = position.x;
  const posY = position.y;
  const cosArr = trig.cos;
  const sinArr = trig.sin;
  let offset = 0;

  for (let i = 0; i < segments; i += 1) {
    // Center vertex
    if (updateGeometry) {
      target[offset] = posX;
      target[offset + 1] = posY;
    }
    if (updateFill) {
      target.set(fillComponents, offset + POSITION_COMPONENTS);
    }
    offset += VERTEX_COMPONENTS;

    // First edge vertex
    const cos1 = cosArr[i]!;
    const sin1 = sinArr[i]!;
    if (updateGeometry) {
      target[offset] = posX + cos1 * radius;
      target[offset + 1] = posY + sin1 * radius;
    }
    if (updateFill) {
      target.set(fillComponents, offset + POSITION_COMPONENTS);
    }
    offset += VERTEX_COMPONENTS;

    // Second edge vertex
    const nextIndex = (i + 1) % segments;
    const cos2 = cosArr[nextIndex]!;
    const sin2 = sinArr[nextIndex]!;
    if (updateGeometry) {
      target[offset] = posX + cos2 * radius;
      target[offset + 1] = posY + sin2 * radius;
    }
    if (updateFill) {
      target.set(fillComponents, offset + POSITION_COMPONENTS);
    }
    offset += VERTEX_COMPONENTS;
  }
  return true;
};

export const createStaticCirclePrimitive = (
  options: CirclePrimitiveOptions
): StaticPrimitive => {
  const segments = Math.max(3, Math.floor(options.segments ?? DEFAULT_SEGMENTS));
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
    data: buildCircleData(
      center,
      options.radius,
      fillComponents,
      segments,
      getCircleTrigLut(segments)
    ),
  };
};

export const createDynamicCirclePrimitive = (
  instance: SceneObjectInstance,
  options: DynamicCircleOptions = {}
): DynamicPrimitive => {
  const segments = Math.max(3, Math.floor(options.segments ?? DEFAULT_SEGMENTS));
  const trig = getCircleTrigLut(segments);
  const initialCenter = getCenter(instance, options.offset);
  let radius = Math.max(
    resolveRadius(options, instance, getRadiusFromSize(instance.data.size, 0)),
    0
  );
  const initialFillComponents = createFillVertexComponents({
    fill: resolveFill(options, instance),
    center: initialCenter,
    rotation: instance.data.rotation ?? 0,
    size: {
      width: radius * 2,
      height: radius * 2,
    },
    radius,
  });
  const data = buildCircleData(
    initialCenter,
    radius,
    initialFillComponents,
    segments,
    trig
  );
  const fillScratch = new Float32Array(initialFillComponents.length);
  fillScratch.set(initialFillComponents);
  const previousFill = new Float32Array(initialFillComponents.length);
  previousFill.set(initialFillComponents);
  let previousCenterX = initialCenter.x;
  let previousCenterY = initialCenter.y;

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
      const geometryChanged =
        nextRadius !== radius ||
        nextCenter.x !== previousCenterX ||
        nextCenter.y !== previousCenterY;
      const fillChanged = !areFloatArraysEqual(fillComponents, previousFill);
      const changed = updateCircleData(
        data,
        nextCenter,
        nextRadius,
        fillComponents,
        segments,
        trig,
        geometryChanged,
        fillChanged
      );
      if (!changed) {
        return null;
      }
      radius = nextRadius;
      previousCenterX = nextCenter.x;
      previousCenterY = nextCenter.y;
      if (fillChanged) {
        previousFill.set(fillComponents);
      }
      return data;
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
