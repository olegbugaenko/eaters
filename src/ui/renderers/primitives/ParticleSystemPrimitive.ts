import {
  CUSTOM_DATA_KIND_PARTICLE_SYSTEM,
  FILL_TYPES,
  ParticleSystemCustomData,
  SceneObjectInstance,
} from "../../../logic/services/SceneObjectManager";
import {
  DynamicPrimitive,
  VERTEX_COMPONENTS,
} from "../objects/ObjectRenderer";
import {
  copyFillComponents,
  createFillVertexComponents,
} from "./fill";

const VERTICES_PER_PARTICLE = 6;

export const createParticleSystemPrimitive = (
  instance: SceneObjectInstance
): DynamicPrimitive => {
  let data = buildParticleBuffer(extractParticleData(instance));

  return {
    data,
    update(target: SceneObjectInstance) {
      const payload = extractParticleData(target);
      const next = buildParticleBuffer(payload, data);
      if (next.length === 0) {
        if (data.length === 0) {
          return null;
        }
        data = next;
        return data;
      }
      data = next;
      return data;
    },
  };
};

const extractParticleData = (
  instance: SceneObjectInstance
): ParticleSystemCustomData | null => {
  const payload = instance.data.customData;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const typed = payload as ParticleSystemCustomData;
  if (typed.kind !== CUSTOM_DATA_KIND_PARTICLE_SYSTEM) {
    return null;
  }
  if (
    !(typed.positions instanceof Float32Array) ||
    !(typed.sizes instanceof Float32Array) ||
    !(typed.alphas instanceof Float32Array)
  ) {
    return null;
  }
  return typed;
};

const buildParticleBuffer = (
  payload: ParticleSystemCustomData | null,
  existing?: Float32Array
): Float32Array => {
  if (!payload) {
    return existing && existing.length === 0 ? existing : new Float32Array(0);
  }

  const count = Math.min(
    Math.floor(payload.positions.length / 2),
    payload.sizes.length,
    payload.alphas.length
  );

  if (count <= 0) {
    return existing && existing.length === 0 ? existing : new Float32Array(0);
  }

  const requiredLength = count * VERTICES_PER_PARTICLE * VERTEX_COMPONENTS;
  const buffer =
    existing && existing.length === requiredLength
      ? existing
      : new Float32Array(requiredLength);

  populateParticleBuffer(buffer, payload, count);
  return buffer;
};

const populateParticleBuffer = (
  target: Float32Array,
  payload: ParticleSystemCustomData,
  count: number
): void => {
  let offset = 0;
  for (let i = 0; i < count; i += 1) {
    const centerX = payload.positions[i * 2] ?? 0;
    const centerY = payload.positions[i * 2 + 1] ?? 0;
    const size = Math.max(payload.sizes[i] ?? 0, 0);
    const alpha = clamp01(payload.alphas[i] ?? 0);
    const halfSize = size / 2;

    const fillComponents = createFillVertexComponents({
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: {
          r: payload.color.r,
          g: payload.color.g,
          b: payload.color.b,
          a: alpha,
        },
      },
      center: { x: centerX, y: centerY },
      rotation: 0,
      size: { width: size, height: size },
    });

    offset = pushQuadVertices(
      target,
      offset,
      centerX - halfSize,
      centerY - halfSize,
      centerX + halfSize,
      centerY + halfSize,
      fillComponents
    );
  }
};

const pushQuadVertices = (
  target: Float32Array,
  offset: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  fillComponents: Float32Array
): number => {
  offset = pushVertex(target, offset, minX, minY, fillComponents);
  offset = pushVertex(target, offset, maxX, minY, fillComponents);
  offset = pushVertex(target, offset, maxX, maxY, fillComponents);
  offset = pushVertex(target, offset, minX, minY, fillComponents);
  offset = pushVertex(target, offset, maxX, maxY, fillComponents);
  offset = pushVertex(target, offset, minX, maxY, fillComponents);
  return offset;
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

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
};
