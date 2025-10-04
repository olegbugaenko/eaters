import {
  CUSTOM_DATA_KIND_PARTICLE_SYSTEM,
  FILL_TYPES,
  ParticleSystemCustomData,
  SceneColor,
  SceneFill,
  SceneObjectInstance,
} from "../../../logic/services/SceneObjectManager";
import {
  DynamicPrimitive,
  FILL_INFO_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  MAX_GRADIENT_STOPS,
  STOP_COLOR_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
  VERTEX_COMPONENTS,
} from "../objects/ObjectRenderer";
import { copyFillComponents, createFillVertexComponents } from "./fill";

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
    const fillComponents = createFillComponentsForParticle(
      payload,
      centerX,
      centerY,
      size,
      alpha
    );

    offset = writeParticleQuad(
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

const writeParticleQuad = (
  target: Float32Array,
  offset: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  fillComponents: Float32Array
): number => {
  offset = writeParticleVertex(target, offset, minX, minY, fillComponents);
  offset = writeParticleVertex(target, offset, maxX, minY, fillComponents);
  offset = writeParticleVertex(target, offset, maxX, maxY, fillComponents);
  offset = writeParticleVertex(target, offset, minX, minY, fillComponents);
  offset = writeParticleVertex(target, offset, maxX, maxY, fillComponents);
  offset = writeParticleVertex(target, offset, minX, maxY, fillComponents);
  return offset;
};

const writeParticleVertex = (
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

const createFillComponentsForParticle = (
  payload: ParticleSystemCustomData,
  centerX: number,
  centerY: number,
  size: number,
  alpha: number
): Float32Array => {
  const fill = resolveParticleFill(payload);
  const fillComponents = createFillVertexComponents({
    fill,
    center: { x: centerX, y: centerY },
    rotation: 0,
    size: { width: Math.max(size, 0.0001), height: Math.max(size, 0.0001) },
    radius: size / 2,
  });
  applyParticleAlpha(fillComponents, alpha);
  return fillComponents;
};

const resolveParticleFill = (payload: ParticleSystemCustomData): SceneFill => {
  if (payload.fill) {
    return payload.fill;
  }
  const color = payload.color ?? { r: 1, g: 1, b: 1, a: 1 };
  return createSolidFill(color);
};

const createSolidFill = (color: SceneColor): SceneFill => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: color.r,
    g: color.g,
    b: color.b,
    a: typeof color.a === "number" ? color.a : 1,
  },
});

const applyParticleAlpha = (
  components: Float32Array,
  alpha: number
): void => {
  const effectiveAlpha = clamp01(alpha);
  if (effectiveAlpha >= 1) {
    return;
  }
  const baseAlpha = effectiveAlpha;
  const colorsOffset =
    FILL_INFO_COMPONENTS +
    FILL_PARAMS0_COMPONENTS +
    FILL_PARAMS1_COMPONENTS +
    STOP_OFFSETS_COMPONENTS;
  for (let i = 0; i < MAX_GRADIENT_STOPS; i += 1) {
    const base = colorsOffset + i * STOP_COLOR_COMPONENTS;
    const alphaIndex = base + 3;
    const current = components[alphaIndex] ?? 0;
    const composed = clamp01(current * baseAlpha);
    components[alphaIndex] = composed;
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
