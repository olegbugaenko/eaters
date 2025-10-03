import { DynamicPrimitive, StaticPrimitive } from "./ObjectRenderer";
import { SceneObjectInstance } from "../../../logic/services/SceneObjectManager";

const DEFAULT_CIRCLE_SEGMENTS = 24;

export const createRectanglePrimitive = (
  position: { x: number; y: number },
  size: { width: number; height: number }
): StaticPrimitive => {
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const left = position.x - halfWidth;
  const right = position.x + halfWidth;
  const top = position.y - halfHeight;
  const bottom = position.y + halfHeight;

  return {
    data: new Float32Array([
      left,
      bottom,
      right,
      bottom,
      left,
      top,
      left,
      top,
      right,
      bottom,
      right,
      top,
    ]),
  };
};

export const createStaticCirclePrimitive = (
  position: { x: number; y: number },
  radius: number,
  segments = DEFAULT_CIRCLE_SEGMENTS
): StaticPrimitive => {
  return { data: buildCircleVertices(position, radius, segments) };
};

export const createDynamicCirclePrimitive = (
  instance: SceneObjectInstance,
  radius: number,
  segments = DEFAULT_CIRCLE_SEGMENTS
): DynamicPrimitive => {
  const data = buildCircleVertices(instance.data.position, radius, segments);
  return {
    get data() {
      return data;
    },
    update(target: SceneObjectInstance) {
      updateCircleVertices(data, target.data.position, radius, segments);
      return data;
    },
  };
};

const buildCircleVertices = (
  position: { x: number; y: number },
  radius: number,
  segments: number
): Float32Array => {
  const vertexCount = segments * 3;
  const data = new Float32Array(vertexCount * 2);
  let offset = 0;
  for (let i = 0; i < segments; i += 1) {
    const angle1 = (i / segments) * Math.PI * 2;
    const angle2 = ((i + 1) / segments) * Math.PI * 2;
    data[offset + 0] = position.x;
    data[offset + 1] = position.y;
    data[offset + 2] = position.x + Math.cos(angle1) * radius;
    data[offset + 3] = position.y + Math.sin(angle1) * radius;
    data[offset + 4] = position.x + Math.cos(angle2) * radius;
    data[offset + 5] = position.y + Math.sin(angle2) * radius;
    offset += 6;
  }
  return data;
};

const updateCircleVertices = (
  target: Float32Array,
  position: { x: number; y: number },
  radius: number,
  segments: number
): void => {
  let offset = 0;
  for (let i = 0; i < segments; i += 1) {
    const angle1 = (i / segments) * Math.PI * 2;
    const angle2 = ((i + 1) / segments) * Math.PI * 2;
    target[offset + 0] = position.x;
    target[offset + 1] = position.y;
    target[offset + 2] = position.x + Math.cos(angle1) * radius;
    target[offset + 3] = position.y + Math.sin(angle1) * radius;
    target[offset + 4] = position.x + Math.cos(angle2) * radius;
    target[offset + 5] = position.y + Math.sin(angle2) * radius;
    offset += 6;
  }
};
