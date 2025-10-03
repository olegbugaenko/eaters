import {
  CUSTOM_DATA_KIND_PARTICLE_SYSTEM,
  FILL_TYPES,
  ParticleSystemCustomData,
  SceneColor,
  SceneObjectInstance,
} from "../../../logic/services/SceneObjectManager";
import {
  DynamicPrimitive,
  FILL_PARAMS1_COMPONENTS,
  POSITION_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
  VERTEX_COMPONENTS,
} from "../objects/ObjectRenderer";

const VERTICES_PER_PARTICLE = 6;

export const createParticleSystemPrimitive = (
  instance: SceneObjectInstance
): DynamicPrimitive => {
  let data = buildParticleBuffer(extractParticleData(instance));

  const primitive: DynamicPrimitive = {
    get data() {
      return data;
    },
    update(target: SceneObjectInstance) {
      const payload = extractParticleData(target);
      const next = buildParticleBuffer(payload, data);
      const lengthChanged = next.length !== data.length;
      data = next;
      if (data.length === 0 && !lengthChanged) {
        return null;
      }
      return data.length > 0 || lengthChanged ? data : null;
    },
  };

  return primitive;
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
  if (typeof typed.capacity !== "number" || typed.capacity < 0) {
    return null;
  }
  if (typeof typed.count !== "number" || typed.count < 0) {
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

  const capacity = Math.min(
    payload.capacity,
    Math.floor(payload.positions.length / 2),
    payload.sizes.length,
    payload.alphas.length
  );

  if (capacity <= 0) {
    return existing && existing.length === 0 ? existing : new Float32Array(0);
  }

  const requiredLength = capacity * VERTICES_PER_PARTICLE * VERTEX_COMPONENTS;
  const buffer =
    existing && existing.length === requiredLength
      ? existing
      : new Float32Array(requiredLength);

  populateParticleBuffer(buffer, payload, capacity);
  return buffer;
};

const populateParticleBuffer = (
  target: Float32Array,
  payload: ParticleSystemCustomData,
  capacity: number
): void => {
  const activeCount = Math.min(Math.max(Math.floor(payload.count), 0), capacity);
  let offset = 0;
  for (let i = 0; i < capacity; i += 1) {
    const centerX = payload.positions[i * 2] ?? 0;
    const centerY = payload.positions[i * 2 + 1] ?? 0;
    const isActive = i < activeCount;
    const size = isActive ? Math.max(payload.sizes[i] ?? 0, 0) : 0;
    const alpha = isActive ? clamp01(payload.alphas[i] ?? 0) : 0;
    const halfSize = size / 2;

    offset = writeParticleQuad(
      target,
      offset,
      centerX - halfSize,
      centerY - halfSize,
      centerX + halfSize,
      centerY + halfSize,
      centerX,
      centerY,
      payload.color,
      alpha
    );
  }
};

const writeParticleQuad = (
  target: Float32Array,
  offset: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  centerX: number,
  centerY: number,
  color: SceneColor,
  alpha: number
): number => {
  offset = writeParticleVertex(target, offset, minX, minY, centerX, centerY, color, alpha);
  offset = writeParticleVertex(target, offset, maxX, minY, centerX, centerY, color, alpha);
  offset = writeParticleVertex(target, offset, maxX, maxY, centerX, centerY, color, alpha);
  offset = writeParticleVertex(target, offset, minX, minY, centerX, centerY, color, alpha);
  offset = writeParticleVertex(target, offset, maxX, maxY, centerX, centerY, color, alpha);
  offset = writeParticleVertex(target, offset, minX, maxY, centerX, centerY, color, alpha);
  return offset;
};

const writeParticleVertex = (
  target: Float32Array,
  offset: number,
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  color: SceneColor,
  alpha: number
): number => {
  target[offset + 0] = x;
  target[offset + 1] = y;
  writeSolidFillComponents(target, offset, centerX, centerY, color, alpha);
  return offset + VERTEX_COMPONENTS;
};

const writeSolidFillComponents = (
  target: Float32Array,
  offset: number,
  centerX: number,
  centerY: number,
  color: SceneColor,
  alpha: number
): void => {
  let write = offset + POSITION_COMPONENTS;
  target[write++] = FILL_TYPES.SOLID;
  target[write++] = 1;
  target[write++] = 0;
  target[write++] = 0;

  target[write++] = centerX;
  target[write++] = centerY;
  target[write++] = 0;
  target[write++] = 0;

  for (let i = 0; i < FILL_PARAMS1_COMPONENTS; i += 1) {
    target[write++] = 0;
  }

  for (let i = 0; i < STOP_OFFSETS_COMPONENTS; i += 1) {
    target[write++] = 0;
  }

  const baseAlpha = clamp01(typeof color.a === "number" ? color.a : 1);
  const composedAlpha = clamp01(alpha * baseAlpha);

  for (let i = 0; i < 3; i += 1) {
    target[write++] = color.r;
    target[write++] = color.g;
    target[write++] = color.b;
    target[write++] = composedAlpha;
  }
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
