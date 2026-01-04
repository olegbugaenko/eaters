import type {
  SceneFill,
  SceneColor,
  SceneSolidFill,
  SceneLinearGradientFill,
  SceneRadialGradientFill,
  SceneDiamondGradientFill,
  SceneVector2,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import { sanitizeSceneColor, cloneSceneColor } from "@shared/helpers/scene-color.helper";
import type { WaveUniformConfig } from "../../../primitives/gpu/explosion-wave";
import { clamp01 } from "@shared/helpers/numbers.helper";

/**
 * Converts a SceneFill to WaveUniformConfig and generates a cache key
 */
export const toWaveUniformsFromFill = (
  fill: SceneFill
): { uniforms: WaveUniformConfig; key: string } => {
  // Normalize batching key to avoid unique keys per radius/end value
  const key = JSON.stringify(
    fill.fillType === FILL_TYPES.SOLID
      ? {
          t: FILL_TYPES.SOLID,
          // RGB only; ignore alpha which changes frame-to-frame
          c: {
            r: fill.fillType === FILL_TYPES.SOLID ? (fill as SceneSolidFill).color?.r ?? 1 : 1,
            g: fill.fillType === FILL_TYPES.SOLID ? (fill as SceneSolidFill).color?.g ?? 1 : 1,
            b: fill.fillType === FILL_TYPES.SOLID ? (fill as SceneSolidFill).color?.b ?? 1 : 1,
          },
        }
      : {
          t: fill.fillType,
          // ignore start/end (radius/offset), and ignore alpha; use only offsets + RGB
          stops: "stops" in fill && Array.isArray(fill.stops)
            ? fill.stops.map((s) => ({
                o: s?.offset ?? 0,
                r: s?.color?.r ?? 1,
                g: s?.color?.g ?? 1,
                b: s?.color?.b ?? 1,
              }))
            : [],
        }
  );
  // Default SOLID white
  let fillType = FILL_TYPES.SOLID as number;
  const stopOffsets = new Float32Array([0, 1, 1, 1, 1]);
  const stopColor0 = new Float32Array([1, 1, 1, 1]);
  const stopColor1 = new Float32Array([1, 1, 1, 0]);
  const stopColor2 = new Float32Array([1, 1, 1, 0]);
  const stopColor3 = new Float32Array([1, 1, 1, 0]);
  const stopColor4 = new Float32Array([1, 1, 1, 0]);
  let stopCount = 1;
  let hasLinearStart = false;
  let hasLinearEnd = false;
  let hasRadialOffset = false;
  let hasExplicitRadius = false;
  let explicitRadius = 0;
  let linearStart: SceneVector2 | undefined;
  let linearEnd: SceneVector2 | undefined;
  let radialOffset: SceneVector2 | undefined;

  const defaultColor: SceneColor = { r: 1, g: 1, b: 1, a: 1 };
  const stopColors = [stopColor0, stopColor1, stopColor2, stopColor3, stopColor4];

  if (fill.fillType === FILL_TYPES.SOLID) {
    const solidFill = fill as SceneSolidFill;
    const color = sanitizeSceneColor(solidFill.color, defaultColor);
    stopColor0[0] = color.r;
    stopColor0[1] = color.g;
    stopColor0[2] = color.b;
    stopColor0[3] = color.a ?? 1;
    stopCount = 1;
    fillType = FILL_TYPES.SOLID;
  } else if (fill.fillType === FILL_TYPES.LINEAR_GRADIENT) {
    const f = fill as SceneLinearGradientFill;
    fillType = FILL_TYPES.LINEAR_GRADIENT;
    hasLinearStart = Boolean(f.start);
    hasLinearEnd = Boolean(f.end);
    if (f.start) linearStart = { x: f.start.x ?? 0, y: f.start.y ?? 0 };
    if (f.end) linearEnd = { x: f.end.x ?? 0, y: f.end.y ?? 0 };
    const stops = Array.isArray(f.stops) ? f.stops : [];
    stopCount = Math.min(5, Math.max(1, stops.length));
    let prevColor: SceneColor = defaultColor;
    for (let i = 0; i < 5; i++) {
      const s = stops[i] ?? stops[stops.length - 1] ?? { offset: 1, color: prevColor };
      stopOffsets[i] = Math.max(0, Math.min(1, s.offset ?? i / 4));
      const c = sanitizeSceneColor(s.color, prevColor);
      stopColors[i]!.set([c.r, c.g, c.b, c.a ?? 1]);
      prevColor = cloneSceneColor(c);
    }
  } else if (
    fill.fillType === FILL_TYPES.RADIAL_GRADIENT ||
    fill.fillType === FILL_TYPES.DIAMOND_GRADIENT
  ) {
    const f = fill as SceneRadialGradientFill | SceneDiamondGradientFill;
    fillType = fill.fillType;
    hasRadialOffset = Boolean(f.start);
    if (f.start) radialOffset = { x: f.start.x ?? 0, y: f.start.y ?? 0 };
    hasExplicitRadius = typeof f.end === "number" && Number.isFinite(f.end) && f.end > 0;
    explicitRadius = hasExplicitRadius ? Number(f.end) : 0;
    const stops = Array.isArray(f.stops) ? f.stops : [];
    stopCount = Math.min(5, Math.max(1, stops.length));
    let prevColor: SceneColor = defaultColor;
    for (let i = 0; i < 5; i++) {
      const s = stops[i] ?? stops[stops.length - 1] ?? { offset: 1, color: prevColor };
      stopOffsets[i] = Math.max(0, Math.min(1, s.offset ?? i / 4));
      const c = sanitizeSceneColor(s.color, prevColor);
      stopColors[i]!.set([c.r, c.g, c.b, c.a ?? 1]);
      prevColor = cloneSceneColor(c);
    }
  }

  const noise = fill.noise;
  const noiseColorAmplitude = noise ? Math.max(0, Math.min(1, noise.colorAmplitude)) : 0;
  const noiseAlphaAmplitude = noise ? Math.max(0, Math.min(1, noise.alphaAmplitude)) : 0;
  const noiseScale = noise ? Math.max(noise.scale, 0.0001) : 1;
  const noiseDensity = noise?.density ?? 1;

  const filaments = fill.filaments;
  const filamentColorContrast = filaments ? clamp01(filaments.colorContrast) : 0;
  const filamentAlphaContrast = filaments ? clamp01(filaments.alphaContrast) : 0;
  const filamentWidth = filaments ? clamp01(filaments.width) : 0;
  const filamentDensity = filaments ? Math.max(filaments.density ?? 0, 0) : 0;
  const filamentEdgeBlur = filaments ? clamp01(filaments.edgeBlur) : 0;

  const uniforms: WaveUniformConfig = {
    fillType,
    stopCount,
    stopOffsets,
    stopColor0,
    stopColor1,
    stopColor2,
    stopColor3,
    stopColor4,
    noiseColorAmplitude,
    noiseAlphaAmplitude,
    noiseScale,
    noiseDensity,
    filamentColorContrast,
    filamentAlphaContrast,
    filamentWidth,
    filamentDensity,
    filamentEdgeBlur,
    hasLinearStart,
    linearStart: linearStart ?? { x: 0, y: 0 },
    hasLinearEnd,
    linearEnd: linearEnd ?? { x: 0, y: 0 },
    hasRadialOffset,
    radialOffset: radialOffset ?? { x: 0, y: 0 },
    hasExplicitRadius,
    explicitRadius,
    fadeStartMs: 0,
    defaultLifetimeMs: 1000,
    lengthMultiplier: 1,
    alignToVelocity: false,
  };

  return { uniforms, key };
};
