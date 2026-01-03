import type {
  SceneColor,
  SceneFill,
  SceneFillNoise,
  SceneFillFilaments,
  SceneGradientStop,
  SceneSolidFill,
  SceneLinearGradientFill,
  SceneRadialGradientFill,
  SceneDiamondGradientFill,
  SceneStroke,
  SceneVector2,
  MutableCloneResult,
} from "./scene-object-manager.types";
import {
  FILL_TYPES,
  DEFAULT_COLOR,
  DEFAULT_FILL,
  MIN_NOISE_SCALE,
  MAX_NOISE_SCALE,
  DEFAULT_NOISE_SCALE,
  MIN_FILAMENT_DENSITY,
  MAX_FILAMENT_DENSITY,
  DEFAULT_FILAMENT_WIDTH,
  DEFAULT_FILAMENT_DENSITY,
  DEFAULT_FILAMENT_EDGE_BLUR,
  DEFAULT_ROTATION,
} from "./scene-object-manager.const";
import { clamp01, clampNumber } from "@shared/helpers/numbers.helper";
import { sanitizeColor } from "@shared/helpers/scene-color.helper";
import { cloneSceneFill } from "@shared/helpers/scene-fill.helper";
import { normalizeRotation } from "@shared/helpers/angle.helper";

// ============================================================================
// Custom Data Cloning
// ============================================================================

export function cloneCustomDataMutable<T>(value: T, previous: unknown): MutableCloneResult<T> {
  return cloneCustomDataMutableInternal(value, previous, new WeakMap<object, unknown>()) as MutableCloneResult<T>;
}

function cloneCustomDataMutableInternal(
  value: unknown,
  previous: unknown,
  seen: WeakMap<object, unknown>
): MutableCloneResult<unknown> {
  if (value === undefined || value === null || typeof value !== "object") {
    return { clone: value, changed: value !== previous };
  }

  if (value instanceof ArrayBuffer) {
    return cloneArrayBufferValue(value, previous);
  }

  if (ArrayBuffer.isView(value)) {
    return cloneArrayBufferViewValue(value as ArrayBufferView, previous);
  }

  if (seen.has(value)) {
    const cached = seen.get(value)!;
    return { clone: cached, changed: cached !== previous };
  }

  if (Array.isArray(value)) {
    return cloneArrayMutable(value, previous, seen);
  }

  if (isPlainObject(value)) {
    return clonePlainObjectMutable(value as Record<string, unknown>, previous, seen);
  }

  const fallback = cloneCustomDataValue(value);
  return { clone: fallback, changed: true };
}

function cloneArrayMutable(
  source: unknown[],
  previous: unknown,
  seen: WeakMap<object, unknown>
): MutableCloneResult<unknown[]> {
  const reusable = Array.isArray(previous) && !Object.isFrozen(previous);
  const previousArray = reusable ? (previous as unknown[]) : null;
  const target = previousArray ?? new Array(source.length);
  seen.set(source, target);
  const previousLength = previousArray ? previousArray.length : 0;
  let changed = !reusable || previousLength !== source.length;

  if (reusable && previousArray && previousArray.length !== source.length) {
    previousArray.length = source.length;
  }

  for (let i = 0; i < source.length; i += 1) {
    const previousValue = reusable && i < previousLength ? target[i] : undefined;
    const result = cloneCustomDataMutableInternal(source[i], previousValue, seen);
    if (!reusable || i >= previousLength || result.clone !== previousValue) {
      target[i] = result.clone;
      if (reusable && i < previousLength && result.clone === previousValue && !result.changed) {
        // no-op
      } else {
        changed = true;
      }
    } else if (result.changed) {
      changed = true;
    }
  }

  if (reusable && previousLength > source.length && previousArray) {
    previousArray.length = source.length;
    changed = true;
  }

  return { clone: target, changed };
}

function clonePlainObjectMutable(
  source: Record<string, unknown>,
  previous: unknown,
  seen: WeakMap<object, unknown>
): MutableCloneResult<Record<string, unknown>> {
  const prototype = Object.getPrototypeOf(source);
  const reusable =
    previous &&
    typeof previous === "object" &&
    !Array.isArray(previous) &&
    !Object.isFrozen(previous) &&
    Object.getPrototypeOf(previous) === prototype;
  const target = reusable
    ? (previous as Record<string, unknown>)
    : Object.create(prototype === null ? null : prototype);
  seen.set(source, target);
  let changed = !reusable;

  if (reusable) {
    for (const key of Object.keys(target)) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        delete target[key];
        changed = true;
      }
    }
  }

  for (const key of Object.keys(source)) {
    const previousValue = reusable ? target[key] : undefined;
    const result = cloneCustomDataMutableInternal(source[key], previousValue, seen);
    if (!reusable || result.clone !== previousValue) {
      target[key] = result.clone;
      if (reusable && result.clone === previousValue && !result.changed) {
        // no-op
      } else {
        changed = true;
      }
    } else if (result.changed) {
      changed = true;
    }
  }

  return { clone: target, changed };
}

function cloneArrayBufferValue(
  buffer: ArrayBufferLike,
  previous: unknown
): MutableCloneResult<ArrayBuffer> {
  const previousBuffer = previous instanceof ArrayBuffer ? previous : null;
  const sourceView = new Uint8Array(buffer);
  const targetView =
    previousBuffer && !Object.isFrozen(previousBuffer) && previousBuffer.byteLength === buffer.byteLength
      ? new Uint8Array(previousBuffer)
      : new Uint8Array(buffer.byteLength);
  let changed = !previousBuffer || previousBuffer.byteLength !== buffer.byteLength;
  for (let i = 0; i < sourceView.length; i += 1) {
    const value = sourceView[i]!;
    if (!changed && targetView[i] !== value) {
      changed = true;
    }
    targetView[i] = value;
  }
  return { clone: targetView.buffer, changed };
}

function cloneArrayBufferViewValue(
  view: ArrayBufferView,
  previous: unknown
): MutableCloneResult<ArrayBufferView> {
  if (view instanceof DataView) {
    const previousView = previous instanceof DataView ? previous : null;
    const previousBuffer = previousView && previousView.buffer instanceof ArrayBuffer ? previousView.buffer : undefined;
    const result = cloneArrayBufferValue(view.buffer, previousBuffer);
    const cloneView = new DataView(result.clone, view.byteOffset, view.byteLength);
    return {
      clone: cloneView,
      changed:
        result.changed ||
        !previousView ||
        previousView.byteOffset !== view.byteOffset ||
        previousView.byteLength !== view.byteLength,
    };
  }

  type NumericArrayView = ArrayBufferView & { length: number; [index: number]: number };
  const sourceArray = view as NumericArrayView;
  const previousArray =
    previous &&
    ArrayBuffer.isView(previous) &&
    previous.constructor === view.constructor &&
    !Object.isFrozen(previous)
      ? (previous as NumericArrayView)
      : null;
  const targetArray =
    previousArray ??
    (new (view.constructor as unknown as { new (length: number): NumericArrayView })(sourceArray.length) as NumericArrayView);
  let changed = !previousArray || previousArray.length !== sourceArray.length;
  for (let i = 0; i < sourceArray.length; i += 1) {
    const value = sourceArray[i]!;
    if (!changed && targetArray[i] !== value) {
      changed = true;
    }
    targetArray[i] = value;
  }
  return { clone: targetArray, changed };
}

function cloneCustomDataValue<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return value.slice(0) as T;
  }

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView & { slice?: () => ArrayBufferView };
    if (typeof view.slice === "function") {
      return view.slice() as T;
    }
    const bufferCopy = view.buffer.slice(0);
    return new (view.constructor as { new (buffer: ArrayBufferLike): ArrayBufferView })(
      bufferCopy
    ) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneCustomDataValue(item)) as T;
  }

  if (typeof value === "object") {
    const source = value as Record<string | number | symbol, unknown>;
    const clone: Record<string | number | symbol, unknown> = {};
    Object.keys(source).forEach((key) => {
      clone[key] = cloneCustomDataValue(source[key]);
    });
    return clone as T;
  }

  return value;
}

export function cloneCustomDataSnapshot<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  const snapshot = cloneCustomDataValue(value);
  freezeCustomDataValue(snapshot, new WeakSet<object>());
  return snapshot;
}

function freezeCustomDataValue(value: unknown, seen: WeakSet<object>): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    Object.freeze(value);
    return;
  }

  const objectValue = value as Record<string | number | symbol, unknown>;
  if (seen.has(objectValue)) {
    return;
  }
  seen.add(objectValue);

  if (Array.isArray(objectValue)) {
    objectValue.forEach((item) => freezeCustomDataValue(item, seen));
  } else {
    Object.keys(objectValue).forEach((key) =>
      freezeCustomDataValue(objectValue[key], seen)
    );
  }

  Object.freeze(objectValue);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// ============================================================================
// Color & Fill Helpers
// ============================================================================

// Re-export sanitizeColor for backward compatibility
export { sanitizeColor } from "@shared/helpers/scene-color.helper";

export function createSolidFill(color: SceneColor): SceneSolidFill {
  return {
    fillType: FILL_TYPES.SOLID,
    color: sanitizeColor(color),
  };
}

export function sanitizeVector(
  value: SceneVector2 | undefined
): SceneVector2 | undefined {
  if (!value) {
    return undefined;
  }
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  return { x, y };
}

export function sanitizeRadius(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  if (value <= 0) {
    return undefined;
  }
  return value;
}

export function sanitizeGradientStops(
  stops: SceneGradientStop[] | undefined
): SceneGradientStop[] {
  if (!stops || stops.length === 0) {
    return [
      {
        offset: 0,
        color: sanitizeColor(undefined),
      },
    ];
  }
  const sanitized: SceneGradientStop[] = [];
  stops.forEach((stop) => {
    if (!stop || typeof stop !== "object") {
      return;
    }
    sanitized.push({
      offset: clamp01(stop.offset),
      color: sanitizeColor(stop.color),
    });
  });
  if (sanitized.length === 0) {
    sanitized.push({
      offset: 0,
      color: sanitizeColor(undefined),
    });
  } else {
    sanitized.sort((a, b) => a.offset - b.offset);
  }
  return sanitized;
}

export function sanitizeFillNoise(noise: SceneFillNoise | undefined): SceneFillNoise | undefined {
  if (!noise || typeof noise !== "object") {
    return undefined;
  }
  const colorAmplitude = clamp01(noise.colorAmplitude);
  const alphaAmplitude = clamp01(noise.alphaAmplitude);
  if (colorAmplitude <= 0 && alphaAmplitude <= 0) {
    return undefined;
  }
  const scaleRaw =
    typeof noise.scale === "number" && Number.isFinite(noise.scale)
      ? Math.abs(noise.scale)
      : DEFAULT_NOISE_SCALE;
  const scale = clampNumber(scaleRaw, MIN_NOISE_SCALE, MAX_NOISE_SCALE);
  return {
    colorAmplitude,
    alphaAmplitude,
    scale,
  };
}

export function sanitizeFillFilaments(
  filaments: SceneFillFilaments | undefined
): SceneFillFilaments | undefined {
  if (!filaments || typeof filaments !== "object") {
    return undefined;
  }
  const colorContrast = clamp01(filaments.colorContrast);
  const alphaContrast = clamp01(filaments.alphaContrast);
  if (colorContrast <= 0 && alphaContrast <= 0) {
    return undefined;
  }
  const width = clamp01(
    typeof filaments.width === "number" && Number.isFinite(filaments.width)
      ? filaments.width
      : DEFAULT_FILAMENT_WIDTH
  );
  if (width <= 0) {
    return undefined;
  }
  const densityRaw =
    typeof filaments.density === "number" && Number.isFinite(filaments.density)
      ? Math.abs(filaments.density)
      : DEFAULT_FILAMENT_DENSITY;
  const density = clampNumber(densityRaw, MIN_FILAMENT_DENSITY, MAX_FILAMENT_DENSITY);
  const edgeBlurRaw =
    typeof filaments.edgeBlur === "number" && Number.isFinite(filaments.edgeBlur)
      ? Math.abs(filaments.edgeBlur)
      : DEFAULT_FILAMENT_EDGE_BLUR;
  const edgeBlur = clamp01(edgeBlurRaw);

  return {
    colorContrast,
    alphaContrast,
    width,
    density,
    edgeBlur,
  };
}

export function sanitizeFill(fill: SceneFill | undefined): SceneFill {
  if (!fill) {
    return cloneSceneFill(DEFAULT_FILL);
  }
  switch (fill.fillType) {
    case FILL_TYPES.SOLID: {
      const solidFill = fill as SceneSolidFill;
      return {
        fillType: FILL_TYPES.SOLID,
        color: sanitizeColor(solidFill.color),
        ...(() => {
          const noise = sanitizeFillNoise(solidFill.noise);
          const filaments = sanitizeFillFilaments(solidFill.filaments);
          return {
            ...(noise ? { noise } : {}),
            ...(filaments ? { filaments } : {}),
          };
        })(),
      };
    }
    case FILL_TYPES.LINEAR_GRADIENT: {
      const linearFill = fill as SceneLinearGradientFill;
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: sanitizeVector(linearFill.start),
        end: sanitizeVector(linearFill.end),
        stops: sanitizeGradientStops(linearFill.stops),
        ...(() => {
          const noise = sanitizeFillNoise(linearFill.noise);
          const filaments = sanitizeFillFilaments(linearFill.filaments);
          return {
            ...(noise ? { noise } : {}),
            ...(filaments ? { filaments } : {}),
          };
        })(),
      };
    }
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT: {
      const gradientFill = fill as SceneRadialGradientFill | SceneDiamondGradientFill;
      return {
        fillType: fill.fillType,
        start: sanitizeVector(gradientFill.start),
        end: sanitizeRadius(gradientFill.end),
        stops: sanitizeGradientStops(gradientFill.stops),
        ...(() => {
          const noise = sanitizeFillNoise(gradientFill.noise);
          const filaments = sanitizeFillFilaments(gradientFill.filaments);
          return {
            ...(noise ? { noise } : {}),
            ...(filaments ? { filaments } : {}),
          };
        })(),
      };
    }
    default:
      return cloneSceneFill(DEFAULT_FILL);
  }
}

export function sanitizeStroke(stroke: SceneStroke | undefined): SceneStroke | undefined {
  if (!stroke || typeof stroke.width !== "number") {
    return undefined;
  }
  const width = Number.isFinite(stroke.width) ? Math.max(0, stroke.width) : 0;
  if (width <= 0) {
    return undefined;
  }
  return {
    color: sanitizeColor(stroke.color),
    width,
  };
}

export function cloneStroke(stroke: SceneStroke | undefined): SceneStroke | undefined {
  if (!stroke) {
    return undefined;
  }
  return {
    color: { ...stroke.color },
    width: stroke.width,
  };
}

// cloneStops is no longer needed - using cloneSceneGradientStops from shared

export function extractPrimaryColor(fill: SceneFill): SceneColor {
  if (fill.fillType === FILL_TYPES.SOLID) {
    return { ...(fill as SceneSolidFill).color };
  }
  const gradientFill = fill as SceneLinearGradientFill | SceneRadialGradientFill | SceneDiamondGradientFill;
  const first = gradientFill.stops?.[0];
  if (!first) {
    return { ...DEFAULT_COLOR };
  }
  return { ...first.color };
}

// ============================================================================
// Utility Helpers
// ============================================================================

