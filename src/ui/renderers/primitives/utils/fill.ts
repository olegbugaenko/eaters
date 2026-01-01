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

// ============================================================================
// OPTIMIZATION: Static scratch objects to avoid per-frame allocations
// ============================================================================
const scratchStartLocal: SceneVector2 = { x: 0, y: 0 };
const scratchEndLocal: SceneVector2 = { x: 0, y: 0 };
const scratchRotated: SceneVector2 = { x: 0, y: 0 };
const scratchStartWorld: SceneVector2 = { x: 0, y: 0 };
const scratchEndWorld: SceneVector2 = { x: 0, y: 0 };
const scratchGradientCenter: SceneVector2 = { x: 0, y: 0 };

// Mutating version - writes to out parameter
const rotateVectorTo = (
  vector: SceneVector2,
  rotation: number,
  out: SceneVector2
): void => {
  if (rotation === 0) {
    out.x = vector.x;
    out.y = vector.y;
    return;
  }
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  out.x = vector.x * cos - vector.y * sin;
  out.y = vector.x * sin + vector.y * cos;
};

// Mutating version - writes to out parameter
const addVectorsTo = (a: SceneVector2, b: SceneVector2, out: SceneVector2): void => {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
};

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

// Static fallback stops to avoid allocations
const FALLBACK_SOLID_STOP: SceneGradientStop[] = [{ offset: 0, color: { r: 1, g: 1, b: 1, a: 1 } }];

const limitStops = (stops: SceneGradientStop[]): SceneGradientStop[] => {
  // OPTIMIZATION: Don't slice if within limit - just return original array
  // This is safe because we only read from stops, never mutate
  if (stops.length <= MAX_GRADIENT_STOPS) {
    return stops;
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

// Cached solid stop per fill to avoid allocations
const solidStopCache = new WeakMap<SceneFill, SceneGradientStop[]>();

const ensureStops = (fill: SceneFill): SceneGradientStop[] => {
  if (fill.fillType === FILL_TYPES.SOLID) {
    // Cache solid stops per fill object
    let cached = solidStopCache.get(fill);
    if (!cached) {
      cached = [{ offset: 0, color: fill.color }];
      solidStopCache.set(fill, cached);
    }
    return cached;
  }
  if (fill.stops.length === 0) {
    return FALLBACK_SOLID_STOP;
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
      // Use scratch objects instead of creating new ones
      if (fill.start) {
        scratchStartLocal.x = fill.start.x;
        scratchStartLocal.y = fill.start.y;
      } else {
        scratchStartLocal.x = -size.width / 2;
        scratchStartLocal.y = -size.height / 2;
      }
      if (fill.end && typeof fill.end === "object") {
        scratchEndLocal.x = (fill.end as SceneVector2).x;
        scratchEndLocal.y = (fill.end as SceneVector2).y;
      } else {
        scratchEndLocal.x = size.width / 2;
        scratchEndLocal.y = size.height / 2;
      }
      rotateVectorTo(scratchStartLocal, rotation, scratchRotated);
      addVectorsTo(center, scratchRotated, scratchStartWorld);
      rotateVectorTo(scratchEndLocal, rotation, scratchRotated);
      addVectorsTo(center, scratchRotated, scratchEndWorld);
      const dirX = scratchEndWorld.x - scratchStartWorld.x;
      const dirY = scratchEndWorld.y - scratchStartWorld.y;
      const lengthSq = dirX * dirX + dirY * dirY;
      components[params0Index + 0] = scratchStartWorld.x;
      components[params0Index + 1] = scratchStartWorld.y;
      components[params0Index + 2] = scratchEndWorld.x;
      components[params0Index + 3] = scratchEndWorld.y;
      components[params1Index + 0] = dirX;
      components[params1Index + 1] = dirY;
      components[params1Index + 2] = lengthSq > 0 ? 1 / lengthSq : 0;
      components[params1Index + 3] = 0;
      break;
    }
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT: {
      // Use scratch objects instead of creating new ones
      if (fill.start) {
        scratchStartLocal.x = fill.start.x;
        scratchStartLocal.y = fill.start.y;
      } else {
        scratchStartLocal.x = 0;
        scratchStartLocal.y = 0;
      }
      rotateVectorTo(scratchStartLocal, rotation, scratchRotated);
      addVectorsTo(center, scratchRotated, scratchGradientCenter);
      components[params0Index + 0] = scratchGradientCenter.x;
      components[params0Index + 1] = scratchGradientCenter.y;
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
