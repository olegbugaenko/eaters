import { SceneColor } from "../services/scene-object-manager/scene-object-manager.types";
import { cloneSceneColor, sanitizeSceneColor } from "@shared/helpers/scene-color.helper";
import { DEFAULT_COLOR } from "../services/scene-object-manager/scene-object-manager.const";

export type VisualEffectBlendMode = "tint" | "add";

export interface VisualColorOverlayConfig {
  readonly color: SceneColor;
  readonly intensity: number;
  readonly blendMode?: VisualEffectBlendMode;
  readonly priority?: number;
}

interface InternalColorOverlay {
  readonly color: SceneColor;
  readonly intensity: number;
  readonly blendMode: VisualEffectBlendMode;
  readonly priority: number;
}

type ColorOverlayMap = Map<string, InternalColorOverlay>;

export interface VisualEffectState {
  readonly fillOverlays: ColorOverlayMap;
  readonly strokeOverlays: ColorOverlayMap;
  readonly sizeMultipliers: Map<string, number>;
}

const DEFAULT_BLEND_MODE: VisualEffectBlendMode = "tint";
const DEFAULT_PRIORITY = 0;
const EPSILON = 1e-4;

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

// Use shared helpers for color operations
const sanitizeColor = (color: SceneColor): SceneColor => {
  return sanitizeSceneColor(color, DEFAULT_COLOR);
};

const sanitizeOverlay = (
  overlay: VisualColorOverlayConfig | null | undefined
): InternalColorOverlay | null => {
  if (!overlay) {
    return null;
  }
  const intensityRaw = Number.isFinite(overlay.intensity) ? overlay.intensity : 0;
  const intensity = clamp01(intensityRaw);
  if (intensity <= 0) {
    return null;
  }
  const priorityRaw =
    typeof overlay.priority === "number" && Number.isFinite(overlay.priority)
      ? overlay.priority
      : DEFAULT_PRIORITY;
  const priority = Math.round(priorityRaw * 1000) / 1000;
  const blendMode: VisualEffectBlendMode =
    overlay.blendMode === "add" || overlay.blendMode === "tint"
      ? overlay.blendMode
      : DEFAULT_BLEND_MODE;
  return {
    color: sanitizeColor(overlay.color),
    intensity,
    blendMode,
    priority,
  };
};

const overlaysEqual = (
  current: InternalColorOverlay | undefined,
  next: InternalColorOverlay | null
): boolean => {
  if (!current && !next) {
    return true;
  }
  if (!current || !next) {
    return false;
  }
  return (
    Math.abs(current.color.r - next.color.r) <= EPSILON &&
    Math.abs(current.color.g - next.color.g) <= EPSILON &&
    Math.abs(current.color.b - next.color.b) <= EPSILON &&
    Math.abs((current.color.a ?? 1) - (next.color.a ?? 1)) <= EPSILON &&
    Math.abs(current.intensity - next.intensity) <= EPSILON &&
    current.blendMode === next.blendMode &&
    Math.abs(current.priority - next.priority) <= EPSILON
  );
};

const applyOverlay = (
  base: SceneColor,
  overlay: InternalColorOverlay
): SceneColor => {
  if (overlay.intensity <= 0) {
    return base;
  }
  const intensity = clamp01(overlay.intensity);
  switch (overlay.blendMode) {
    case "add": {
      const r = clamp01(base.r + overlay.color.r * intensity);
      const g = clamp01(base.g + overlay.color.g * intensity);
      const b = clamp01(base.b + overlay.color.b * intensity);
      const a = clamp01((base.a ?? 1) + (overlay.color.a ?? 1) * intensity);
      return { r, g, b, a };
    }
    case "tint":
    default: {
      const r = base.r + (overlay.color.r - base.r) * intensity;
      const g = base.g + (overlay.color.g - base.g) * intensity;
      const b = base.b + (overlay.color.b - base.b) * intensity;
      const a = (base.a ?? 1) + ((overlay.color.a ?? 1) - (base.a ?? 1)) * intensity;
      return {
        r,
        g,
        b,
        a: clamp01(a),
      };
    }
  }
};

const sortOverlays = (
  overlays: ColorOverlayMap
): { key: string; overlay: InternalColorOverlay }[] => {
  return [...overlays.entries()]
    .map(([key, overlay]) => ({ key, overlay }))
    .sort((a, b) => {
      if (a.overlay.priority === b.overlay.priority) {
        return a.key.localeCompare(b.key);
      }
      return a.overlay.priority - b.overlay.priority;
    });
};

export const createVisualEffectState = (): VisualEffectState => ({
  fillOverlays: new Map(),
  strokeOverlays: new Map(),
  sizeMultipliers: new Map(),
});

export const setVisualEffectFillOverlay = (
  state: VisualEffectState,
  id: string,
  overlay: VisualColorOverlayConfig | null | undefined
): boolean => {
  const sanitized = sanitizeOverlay(overlay);
  const current = state.fillOverlays.get(id);
  if (overlaysEqual(current, sanitized)) {
    return false;
  }
  if (!sanitized) {
    if (current) {
      state.fillOverlays.delete(id);
      return true;
    }
    return false;
  }
  state.fillOverlays.set(id, sanitized);
  return true;
};

export const setVisualEffectStrokeOverlay = (
  state: VisualEffectState,
  id: string,
  overlay: VisualColorOverlayConfig | null | undefined
): boolean => {
  const sanitized = sanitizeOverlay(overlay);
  const current = state.strokeOverlays.get(id);
  if (overlaysEqual(current, sanitized)) {
    return false;
  }
  if (!sanitized) {
    if (current) {
      state.strokeOverlays.delete(id);
      return true;
    }
    return false;
  }
  state.strokeOverlays.set(id, sanitized);
  return true;
};

export const computeVisualEffectFillColor = (
  baseColor: SceneColor,
  state: VisualEffectState
): SceneColor => {
  let result = cloneSceneColor(sanitizeColor(baseColor));
  const overlays = sortOverlays(state.fillOverlays);
  overlays.forEach(({ overlay }) => {
    result = applyOverlay(result, overlay);
  });
  return result;
};

export const computeVisualEffectStrokeColor = (
  baseColor: SceneColor | undefined,
  state: VisualEffectState
): SceneColor | undefined => {
  if (!baseColor) {
    return undefined;
  }
  let result = cloneSceneColor(sanitizeColor(baseColor));
  const overlays = sortOverlays(state.strokeOverlays);
  overlays.forEach(({ overlay }) => {
    result = applyOverlay(result, overlay);
  });
  return result;
};

export const setVisualEffectSizeMultiplier = (
  state: VisualEffectState,
  id: string,
  multiplier: number | null | undefined
): boolean => {
  const normalized = Number.isFinite(multiplier as number)
    ? Math.max((multiplier as number) ?? 0, 0)
    : 0;
  const current = state.sizeMultipliers.get(id) ?? 0;
  if (normalized <= 0 || Math.abs(normalized - 1) <= EPSILON) {
    if (current > 0) {
      state.sizeMultipliers.delete(id);
      return true;
    }
    return false;
  }
  if (Math.abs(current - normalized) <= EPSILON) {
    return false;
  }
  state.sizeMultipliers.set(id, normalized);
  return true;
};

export const computeVisualEffectSizeMultiplier = (
  state: VisualEffectState
): number => {
  let multiplier = 1;
  state.sizeMultipliers.forEach((value) => {
    if (value > 0) {
      multiplier *= value;
    }
  });
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return 1;
  }
  return multiplier;
};
