import {
  SceneColor,
  SceneObjectInstance,
  SceneSize,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";
import {
  DynamicPrimitive,
  StaticPrimitive,
  VERTEX_COMPONENTS,
} from "../objects/ObjectRenderer";

interface CirclePrimitiveOptions {
  position: SceneVector2;
  radius: number;
  color: SceneColor;
  segments?: number;
}

const DEFAULT_SEGMENTS = 24;

const resolveAlpha = (color: SceneColor): number => {
  if (typeof color.a === "number" && Number.isFinite(color.a)) {
    return color.a;
  }
  return 1;
};

const getColor = (color: SceneColor | undefined): SceneColor => {
  if (color) {
    return color;
  }
  return { r: 1, g: 1, b: 1, a: 1 };
};

const getRadiusFromSize = (size: SceneSize | undefined, fallback: number): number => {
  if (!size) {
    return fallback;
  }
  return Math.max(size.width, size.height) / 2;
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

const buildCircleData = (
  position: SceneVector2,
  radius: number,
  color: SceneColor,
  alpha: number,
  segments: number
): Float32Array => {
  const vertexCount = segments * 3;
  const data = new Float32Array(vertexCount * VERTEX_COMPONENTS);
  let offset = 0;
  for (let i = 0; i < segments; i += 1) {
    const angle1 = (i / segments) * Math.PI * 2;
    const angle2 = ((i + 1) / segments) * Math.PI * 2;
    offset = pushVertex(data, offset, position.x, position.y, color, alpha);
    offset = pushVertex(
      data,
      offset,
      position.x + Math.cos(angle1) * radius,
      position.y + Math.sin(angle1) * radius,
      color,
      alpha
    );
    offset = pushVertex(
      data,
      offset,
      position.x + Math.cos(angle2) * radius,
      position.y + Math.sin(angle2) * radius,
      color,
      alpha
    );
  }
  return data;
};

const updateCircleData = (
  target: Float32Array,
  position: SceneVector2,
  radius: number,
  color: SceneColor,
  alpha: number,
  segments: number
): boolean => {
  let changed = false;
  let offset = 0;
  for (let i = 0; i < segments; i += 1) {
    const angle1 = (i / segments) * Math.PI * 2;
    const angle2 = ((i + 1) / segments) * Math.PI * 2;

    changed =
      assignVertex(target, offset, position.x, position.y, color, alpha) ||
      changed;
    offset += VERTEX_COMPONENTS;

    changed =
      assignVertex(
        target,
        offset,
        position.x + Math.cos(angle1) * radius,
        position.y + Math.sin(angle1) * radius,
        color,
        alpha
      ) || changed;
    offset += VERTEX_COMPONENTS;

    changed =
      assignVertex(
        target,
        offset,
        position.x + Math.cos(angle2) * radius,
        position.y + Math.sin(angle2) * radius,
        color,
        alpha
      ) || changed;
    offset += VERTEX_COMPONENTS;
  }
  return changed;
};

const assignVertex = (
  target: Float32Array,
  offset: number,
  x: number,
  y: number,
  color: SceneColor,
  alpha: number
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
  if (target[offset + 2] !== color.r) {
    target[offset + 2] = color.r;
    changed = true;
  }
  if (target[offset + 3] !== color.g) {
    target[offset + 3] = color.g;
    changed = true;
  }
  if (target[offset + 4] !== color.b) {
    target[offset + 4] = color.b;
    changed = true;
  }
  if (target[offset + 5] !== alpha) {
    target[offset + 5] = alpha;
    changed = true;
  }
  return changed;
};

export const createStaticCirclePrimitive = (
  options: CirclePrimitiveOptions
): StaticPrimitive => {
  const segments = options.segments ?? DEFAULT_SEGMENTS;
  const alpha = resolveAlpha(options.color);
  return {
    data: buildCircleData(options.position, options.radius, options.color, alpha, segments),
  };
};

export const createDynamicCirclePrimitive = (
  instance: SceneObjectInstance,
  segments = DEFAULT_SEGMENTS
): DynamicPrimitive => {
  const position = instance.data.position;
  const color = getColor(instance.data.color);
  let radius = getRadiusFromSize(instance.data.size, 0);
  const alpha = resolveAlpha(color);
  const data = buildCircleData(position, radius, color, alpha, segments);

  return {
    data,
    update(target: SceneObjectInstance) {
      const nextColor = getColor(target.data.color);
      const nextAlpha = resolveAlpha(nextColor);
      const nextRadius = getRadiusFromSize(target.data.size, radius);
      const changed = updateCircleData(
        data,
        target.data.position,
        nextRadius,
        nextColor,
        nextAlpha,
        segments
      );
      radius = nextRadius;
      return changed ? data : null;
    },
  };
};
