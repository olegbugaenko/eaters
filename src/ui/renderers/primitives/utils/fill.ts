import {
  FILL_TYPES,
  SceneFill,
  SceneFillFilaments,
  SceneGradientStop,
  SceneSize,
  SceneVector2,
} from "../../../../logic/services/SceneObjectManager";
import {
  FILL_COMPONENTS,
  FILL_FILAMENTS1_COMPONENTS,
  FILL_FILAMENTS0_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  MAX_GRADIENT_STOPS,
  POSITION_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
} from "../../objects/ObjectRenderer";

interface FillVertexOptions {
  fill: SceneFill;
  center: SceneVector2;
  rotation: number;
  size: SceneSize;
  radius?: number;
}

const DEFAULT_LINEAR_START = (size: SceneSize): SceneVector2 => ({
  x: -size.width / 2,
  y: -size.height / 2,
});

const DEFAULT_LINEAR_END = (size: SceneSize): SceneVector2 => ({
  x: size.width / 2,
  y: size.height / 2,
});

const rotateVector = (
  vector: SceneVector2,
  rotation: number
): SceneVector2 => {
  if (rotation === 0) {
    return { x: vector.x, y: vector.y };
  }
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
};

const addVectors = (a: SceneVector2, b: SceneVector2): SceneVector2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

const resolveRadius = (
  explicit: number | undefined,
  size: SceneSize,
  fallback?: number
): number => {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  if (typeof fallback === "number" && Number.isFinite(fallback) && fallback > 0) {
    return fallback;
  }
  return Math.max(size.width, size.height) / 2;
};

const limitStops = (stops: SceneGradientStop[]): SceneGradientStop[] => {
  if (stops.length <= MAX_GRADIENT_STOPS) {
    return stops.slice();
  }
  const limited: SceneGradientStop[] = [];
  const lastIndex = stops.length - 1;
  limited.push(stops[0]!);
  const middleCount = MAX_GRADIENT_STOPS - 2;
  if (middleCount > 0) {
    const step = lastIndex / (middleCount + 1);
    for (let i = 1; i <= middleCount; i += 1) {
      const rawIndex = Math.round(i * step);
      const index = Math.min(lastIndex - 1, Math.max(1, rawIndex));
      const candidate = (stops[index] ?? stops[lastIndex])!;
      limited.push(candidate);
    }
  }
  limited.push(stops[lastIndex]!);
  return limited;
};

const ensureStops = (fill: SceneFill): SceneGradientStop[] => {
  if (fill.fillType === FILL_TYPES.SOLID) {
    return [
      {
        offset: 0,
        color: fill.color,
      },
    ];
  }
  if (fill.stops.length === 0) {
    return [
      {
        offset: 0,
        color: { r: 1, g: 1, b: 1, a: 1 },
      },
    ];
  }
  return limitStops(fill.stops);
};

const populateFillVertexComponents = (
  components: Float32Array,
  options: FillVertexOptions
): Float32Array => {
  const { fill, center, rotation, size, radius } = options;
  let write = 0;

  const stops = ensureStops(fill);
  const effectiveStops =
    stops.length > 0 ? stops : [{ offset: 0, color: { r: 1, g: 1, b: 1, a: 1 } }];
  const stopCount = Math.min(MAX_GRADIENT_STOPS, effectiveStops.length);

  components[write++] = fill.fillType;
  components[write++] = stopCount;
  const noise = fill.noise;
  components[write++] = noise ? noise.colorAmplitude : 0;
  components[write++] = noise ? noise.alphaAmplitude : 0;

  const params0Index = write;
  const params1Index = params0Index + FILL_PARAMS0_COMPONENTS;
  const filaments0Index = params1Index + FILL_PARAMS1_COMPONENTS;
  const filaments1Index = filaments0Index + FILL_FILAMENTS0_COMPONENTS;
  const stopOffsetsIndex = filaments1Index + FILL_FILAMENTS1_COMPONENTS;

  for (let i = 0; i < FILL_PARAMS0_COMPONENTS + FILL_PARAMS1_COMPONENTS; i += 1) {
    components[params0Index + i] = 0;
  }

  for (let i = 0; i < FILL_FILAMENTS0_COMPONENTS + FILL_FILAMENTS1_COMPONENTS; i += 1) {
    components[filaments0Index + i] = 0;
  }

  switch (fill.fillType) {
    case FILL_TYPES.LINEAR_GRADIENT: {
      const startLocal = fill.start ? { ...fill.start } : DEFAULT_LINEAR_START(size);
      const endLocal = fill.end ? { ...fill.end } : DEFAULT_LINEAR_END(size);
      const startWorld = addVectors(center, rotateVector(startLocal, rotation));
      const endWorld = addVectors(center, rotateVector(endLocal, rotation));
      const dir = {
        x: endWorld.x - startWorld.x,
        y: endWorld.y - startWorld.y,
      };
      const lengthSq = dir.x * dir.x + dir.y * dir.y;
      components[params0Index + 0] = startWorld.x;
      components[params0Index + 1] = startWorld.y;
      components[params0Index + 2] = endWorld.x;
      components[params0Index + 3] = endWorld.y;
      components[params1Index + 0] = dir.x;
      components[params1Index + 1] = dir.y;
      components[params1Index + 2] = lengthSq > 0 ? 1 / lengthSq : 0;
      components[params1Index + 3] = 0;
      break;
    }
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT: {
      const startLocal = fill.start ? { ...fill.start } : { x: 0, y: 0 };
      const gradientCenter = addVectors(center, rotateVector(startLocal, rotation));
      components[params0Index + 0] = gradientCenter.x;
      components[params0Index + 1] = gradientCenter.y;
      components[params0Index + 2] = resolveRadius(fill.end, size, radius);
      components[params0Index + 3] = 0;
      break;
    }
    case FILL_TYPES.SOLID:
    default: {
      components[params0Index + 0] = center.x;
      components[params0Index + 1] = center.y;
      break;
    }
  }

  components[params1Index + 3] = noise ? noise.scale : 0;
  // For non-linear fills, store noiseDensity in params1[1] (unused for radial/diamond/solid)
  if (fill.fillType !== FILL_TYPES.LINEAR_GRADIENT) {
    components[params1Index + 1] = noise?.density ?? 1;
  }

  const filaments: SceneFillFilaments | undefined = fill.filaments;
  components[filaments0Index + 0] = filaments ? filaments.colorContrast : 0;
  components[filaments0Index + 1] = filaments ? filaments.alphaContrast : 0;
  components[filaments0Index + 2] = filaments ? filaments.width : 0;
  components[filaments0Index + 3] = filaments ? filaments.density : 0;
  components[filaments1Index + 0] = filaments ? filaments.edgeBlur : 0;

  write = stopOffsetsIndex;

  const referenceStop = effectiveStops[Math.max(0, stopCount - 1)]!;
  for (let i = 0; i < STOP_OFFSETS_COMPONENTS; i += 1) {
    const stop = i < stopCount ? effectiveStops[i]! : referenceStop;
    components[write++] = stop.offset;
  }

  for (let i = 0; i < MAX_GRADIENT_STOPS; i += 1) {
    const stop = i < stopCount ? effectiveStops[i]! : referenceStop;
    const color = stop.color;
    components[write++] = color.r;
    components[write++] = color.g;
    components[write++] = color.b;
    components[write++] = typeof color.a === "number" ? color.a : 1;
  }

  return components;
};

export const createFillVertexComponents = (
  options: FillVertexOptions
): Float32Array => {
  const components = new Float32Array(FILL_COMPONENTS);
  return populateFillVertexComponents(components, options);
};

export const writeFillVertexComponents = (
  target: Float32Array,
  options: FillVertexOptions
): Float32Array => populateFillVertexComponents(target, options);

export const copyFillComponents = (
  target: Float32Array,
  offset: number,
  components: Float32Array
): void => {
  target.set(components, offset + POSITION_COMPONENTS);
};
