import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
  transformObjectPoint,
} from "./ObjectRenderer";
import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneObjectInstance,
  SceneVector2,
  SceneStroke,
} from "../../../logic/services/SceneObjectManager";
import {
  createDynamicCirclePrimitive,
  createDynamicPolygonPrimitive,
  createParticleEmitterPrimitive,
} from "../primitives";
import {
  ParticleEmitterBaseConfig,
  ParticleEmitterParticleState,
  sanitizeParticleEmitterConfig,
} from "../primitives/ParticleEmitterPrimitive";
import { cloneSceneFill, sanitizeSceneColor } from "../../../logic/services/particles/ParticleEmitterShared";
import type {
  PlayerUnitEmitterConfig,
  PlayerUnitRendererConfig,
  PlayerUnitRendererLayerConfig,
  PlayerUnitRendererFillConfig,
  PlayerUnitRendererStrokeConfig,
} from "../../../db/player-units-db";
import type { UnitModuleId } from "../../../db/unit-modules-db";
import type { SkillId } from "../../../db/skills-db";

interface PlayerUnitRendererLegacyPayload {
  kind?: string;
  vertices?: SceneVector2[];
  offset?: SceneVector2;
}

interface PlayerUnitCustomData {
  renderer?: PlayerUnitRendererConfig | PlayerUnitRendererLegacyPayload;
  emitter?: PlayerUnitEmitterConfig;
  physicalSize?: number;
  baseFillColor?: SceneColor;
  baseStrokeColor?: SceneColor;
  modules?: UnitModuleId[];
  skills?: SkillId[];
}

interface PlayerUnitEmitterRenderConfig extends ParticleEmitterBaseConfig {
  baseSpeed: number;
  speedVariation: number;
  spread: number;
  physicalSize: number;
}

interface CompositeRendererData {
  kind: "composite";
  baseFillColor: SceneColor;
  baseStrokeColor?: SceneColor;
  layers: RendererLayer[];
}

interface PolygonRendererData {
  kind: "polygon";
  vertices: SceneVector2[];
  offset?: SceneVector2;
}

type RendererData = CompositeRendererData | PolygonRendererData;

interface RendererLayerBase {
  offset?: SceneVector2;
  fill: RendererLayerFill;
  stroke?: RendererLayerStroke;
  requiresModule?: UnitModuleId;
  requiresSkill?: SkillId;
  anim?: {
    type: "sway" | "pulse";
    periodMs?: number;
    amplitude?: number;
    phase?: number;
    falloff?: "tip" | "root" | "none";
    axis?: "normal" | "tangent";
  };
  // line-based meta (optional)
  spine?: Array<{ x: number; y: number; width: number }>;
  segmentIndex?: number;
  buildOpts?: { epsilon?: number; minSegmentLength?: number; winding?: "CW" | "CCW" };
  groupId?: string;
}

interface RendererPolygonLayer extends RendererLayerBase {
  shape: "polygon";
  vertices: SceneVector2[];
}

interface RendererCircleLayer extends RendererLayerBase {
  shape: "circle";
  radius: number;
  segments: number;
}

type RendererLayer = RendererPolygonLayer | RendererCircleLayer;

interface RendererLayerFillBase {
  kind: "base";
  brightness: number;
  alphaMultiplier: number;
}

interface RendererLayerFillSolid {
  kind: "solid";
  color: SceneColor;
}

interface RendererLayerFillGradient {
  kind: "gradient";
  fill: SceneFill;
}

type RendererLayerFill =
  | RendererLayerFillBase
  | RendererLayerFillSolid
  | RendererLayerFillGradient;

interface RendererLayerStrokeBase {
  kind: "base";
  width: number;
  brightness: number;
  alphaMultiplier: number;
}

interface RendererLayerStrokeSolid {
  kind: "solid";
  width: number;
  color: SceneColor;
}

type RendererLayerStroke = RendererLayerStrokeBase | RendererLayerStrokeSolid;

const DEFAULT_VERTICES: SceneVector2[] = [
  { x: 0, y: -18 },
  { x: 17, y: -6 },
  { x: 11, y: 16 },
  { x: -11, y: 16 },
  { x: -17, y: -6 },
];

const DEFAULT_EMITTER_COLOR = { r: 0.2, g: 0.45, b: 0.95, a: 0.5 };
const DEFAULT_BASE_FILL_COLOR: SceneColor = { r: 0.4, g: 0.7, b: 1, a: 1 };
const MIN_CIRCLE_SEGMENTS = 8;

const isVector = (value: unknown): value is SceneVector2 =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as SceneVector2).x === "number" &&
  typeof (value as SceneVector2).y === "number";

const sanitizeVertices = (vertices: SceneVector2[] | undefined): SceneVector2[] => {
  if (!Array.isArray(vertices)) {
    return DEFAULT_VERTICES.map((vertex) => ({ ...vertex }));
  }
  const sanitized = vertices
    .filter((vertex) => isVector(vertex))
    .map((vertex) => ({ x: vertex.x, y: vertex.y }));
  if (sanitized.length < 3) {
    return DEFAULT_VERTICES.map((vertex) => ({ ...vertex }));
  }
  return sanitized;
};

const sanitizeLayerVertices = (
  vertices: readonly SceneVector2[] | undefined
): SceneVector2[] | null => {
  if (!Array.isArray(vertices)) {
    return null;
  }
  const sanitized = vertices
    .filter((vertex) => isVector(vertex))
    .map((vertex) => ({ x: vertex.x, y: vertex.y }));
  if (sanitized.length < 3) {
    return null;
  }
  return sanitized;
};

const sanitizeOffset = (offset: SceneVector2 | undefined): SceneVector2 | undefined => {
  if (!offset || !isVector(offset)) {
    return undefined;
  }
  return { x: offset.x, y: offset.y };
};

const extractRendererData = (instance: SceneObjectInstance): RendererData => {
  const payload = instance.data.customData as PlayerUnitCustomData | undefined;
  if (payload && typeof payload === "object") {
    const renderer = payload.renderer;
    if (renderer && typeof renderer === "object") {
      if ((renderer as PlayerUnitRendererConfig).kind === "composite") {
        const composite = sanitizeCompositeRenderer(
          renderer as PlayerUnitRendererConfig,
          payload
        );
        if (composite) {
          return composite;
        }
      }
      if ((renderer as PlayerUnitRendererLegacyPayload).kind === "polygon") {
        const legacy = renderer as PlayerUnitRendererLegacyPayload;
        return {
          kind: "polygon",
          vertices: sanitizeVertices(legacy.vertices),
          offset: sanitizeOffset(legacy.offset),
        };
      }
    }
  }
  return { kind: "polygon", vertices: DEFAULT_VERTICES.map((vertex) => ({ ...vertex })) };
};

const sanitizeCompositeRenderer = (
  renderer: PlayerUnitRendererConfig,
  payload: PlayerUnitCustomData | undefined
): CompositeRendererData | null => {
  if (renderer.kind !== "composite") {
    return null;
  }
  const fallbackFill = sanitizeSceneColor(renderer.fill, DEFAULT_BASE_FILL_COLOR);
  const baseFillColor = sanitizeSceneColor(payload?.baseFillColor, fallbackFill);
  const fallbackStrokeColor = renderer.stroke
    ? sanitizeSceneColor(renderer.stroke.color, fallbackFill)
    : undefined;
  const baseStrokeColor = renderer.stroke
    ? sanitizeSceneColor(payload?.baseStrokeColor, fallbackStrokeColor!)
    : undefined;

  const layers = renderer.layers
    .map((layer) => sanitizeCompositeLayer(layer))
    .filter((layer): layer is RendererLayer => layer !== null);

  if (layers.length === 0) {
    return null;
  }

  return {
    kind: "composite",
    baseFillColor,
    baseStrokeColor,
    layers,
  };
};

const sanitizeCompositeLayer = (
  layer: PlayerUnitRendererLayerConfig
): RendererLayer | null => {
  if (layer.shape === "polygon") {
    const vertices = sanitizeLayerVertices(layer.vertices);
    if (!vertices) {
      return null;
    }
    return {
      shape: "polygon",
      vertices,
      offset: sanitizeOffset(layer.offset),
      fill: sanitizeFillConfig(layer.fill),
      stroke: sanitizeStrokeConfig(layer.stroke),
      // preserve conditional flags from DB config
      requiresModule: (layer as any).requiresModule,
      requiresSkill: (layer as any).requiresSkill,
      anim: (layer as any).anim,
      spine: (layer as any).spine,
      segmentIndex: (layer as any).segmentIndex,
      buildOpts: (layer as any).buildOpts,
      groupId: (layer as any).groupId,
    };
  }

  const radius =
    typeof layer.radius === "number" && Number.isFinite(layer.radius) ? layer.radius : 0;
  if (radius <= 0) {
    return null;
  }
  const segments =
    typeof layer.segments === "number" && Number.isFinite(layer.segments)
      ? Math.max(Math.round(layer.segments), MIN_CIRCLE_SEGMENTS)
      : 32;
  return {
    shape: "circle",
    radius,
    segments,
    offset: sanitizeOffset(layer.offset),
    fill: sanitizeFillConfig(layer.fill),
    stroke: sanitizeStrokeConfig(layer.stroke),
    // preserve conditional flags from DB config
    requiresModule: (layer as any).requiresModule,
    requiresSkill: (layer as any).requiresSkill,
    anim: (layer as any).anim,
    groupId: (layer as any).groupId,
  };
};

const clampBrightness = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value <= -1) {
    return -1;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
};

const clampAlphaMultiplier = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 10) {
    return 10;
  }
  return value;
};

const sanitizeFillConfig = (
  fill: PlayerUnitRendererFillConfig | undefined
): RendererLayerFill => {
  if (!fill || fill.type === "base") {
    return {
      kind: "base",
      brightness: clampBrightness(fill?.brightness),
      alphaMultiplier: clampAlphaMultiplier(fill?.alphaMultiplier),
    };
  }
  if (fill.type === "solid") {
    return {
      kind: "solid",
      color: { ...fill.color },
    };
  }
  return {
    kind: "gradient",
    fill: cloneSceneFill(fill.fill),
  };
};

const sanitizeStrokeConfig = (
  stroke: PlayerUnitRendererStrokeConfig | undefined
): RendererLayerStroke | undefined => {
  if (!stroke) {
    return undefined;
  }
  const width = typeof stroke.width === "number" && Number.isFinite(stroke.width)
    ? stroke.width
    : 0;
  if (width <= 0) {
    return undefined;
  }
  if (stroke.type === "solid") {
    return {
      kind: "solid",
      width,
      color: { ...stroke.color },
    };
  }
  return {
    kind: "base",
    width,
    brightness: clampBrightness(stroke.brightness),
    alphaMultiplier: clampAlphaMultiplier(stroke.alphaMultiplier),
  };
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

const applyBrightness = (component: number, brightness: number): number => {
  if (brightness > 0) {
    return component + (1 - component) * brightness;
  }
  if (brightness < 0) {
    return component * (1 + brightness);
  }
  return component;
};

const tintColor = (
  color: SceneColor,
  brightness: number,
  alphaMultiplier: number
): SceneColor => {
  const r = clamp01(applyBrightness(color.r, brightness));
  const g = clamp01(applyBrightness(color.g, brightness));
  const b = clamp01(applyBrightness(color.b, brightness));
  const baseAlpha = typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1;
  const a = clamp01(baseAlpha * alphaMultiplier);
  return { r, g, b, a };
};

const createSolidFill = (color: SceneColor): SceneFill => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: color.r,
    g: color.g,
    b: color.b,
    a: typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1,
  },
});

const resolveFillColor = (
  instance: SceneObjectInstance,
  fallback: SceneColor
): SceneColor => {
  const fill = instance.data.fill;
  if (fill?.fillType === FILL_TYPES.SOLID) {
    const color = fill.color;
    return {
      r: color.r,
      g: color.g,
      b: color.b,
      a: typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1,
    };
  }
  return fallback;
};

const resolveStrokeColor = (
  instance: SceneObjectInstance,
  fallbackStroke: SceneColor | undefined,
  fallbackFill: SceneColor
): SceneColor => {
  const stroke = instance.data.stroke;
  if (stroke && stroke.width > 0) {
    const color = stroke.color;
    if (color) {
      return {
        r: color.r,
        g: color.g,
        b: color.b,
        a: typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1,
      };
    }
  }
  if (fallbackStroke) {
    return fallbackStroke;
  }
  return fallbackFill;
};

const resolveLayerFill = (
  instance: SceneObjectInstance,
  fill: RendererLayerFill,
  renderer: CompositeRendererData
): SceneFill => {
  switch (fill.kind) {
    case "solid":
      return createSolidFill(fill.color);
    case "gradient":
      return cloneSceneFill(fill.fill);
    default: {
      const baseColor = resolveFillColor(instance, renderer.baseFillColor);
      const tinted = tintColor(baseColor, fill.brightness, fill.alphaMultiplier);
      return createSolidFill(tinted);
    }
  }
};

const resolveLayerStrokeFill = (
  instance: SceneObjectInstance,
  stroke: RendererLayerStroke,
  renderer: CompositeRendererData
): SceneFill => {
  if (stroke.kind === "solid") {
    return createSolidFill(stroke.color);
  }
  const baseColor = resolveStrokeColor(
    instance,
    renderer.baseStrokeColor,
    renderer.baseFillColor
  );
  const tinted = tintColor(baseColor, stroke.brightness, stroke.alphaMultiplier);
  return createSolidFill(tinted);
};

const createCompositePrimitives = (
  instance: SceneObjectInstance,
  renderer: CompositeRendererData,
  dynamicPrimitives: DynamicPrimitive[]
): void => {
  // Group tentacle segments by groupId for potential future use (not required to animate basic sway)
  renderer.layers.forEach((layer) => {
    // If a layer requires a module, render it only when present
    const payload = instance.data.customData as PlayerUnitCustomData | undefined;
    const required = (layer as any).requiresModule as UnitModuleId | undefined;
    if (required && (!payload || !Array.isArray(payload.modules) || !payload.modules.includes(required))) {
      return;
    }
    const reqSkill = (layer as any).requiresSkill as SkillId | undefined;
    if (reqSkill && (!payload || !Array.isArray(payload.skills) || !payload.skills.includes(reqSkill))) {
      return;
    }
    if (layer.shape === "polygon") {
      // Sway animation for tentacle segments built from a line spine
      if (Array.isArray((layer as any).spine) && (layer as any).anim?.type === "sway") {
        console.log('ANIMATE!');
        const spine = ((layer as any).spine as Array<{ x: number; y: number; width: number }>).map((p) => ({ x: p.x, y: p.y, width: p.width }));
        const segIndex = typeof (layer as any).segmentIndex === "number" ? (layer as any).segmentIndex : 0;
        const build = ((layer as any).buildOpts || {}) as { epsilon?: number; winding?: "CW" | "CCW" };
        const winding = build.winding === "CW" ? "CW" : "CCW";
        const epsilon = typeof build.epsilon === "number" && isFinite(build.epsilon) ? build.epsilon : 0.2;
        const anim = (layer as any).anim as { periodMs?: number; amplitude?: number; phase?: number; falloff?: "tip" | "root" | "none"; axis?: "normal" | "tangent" };
        const period = Math.max(anim?.periodMs ?? 1400, 1);
        const amp = anim?.amplitude ?? 1.0;
        const phase = anim?.phase ?? 0;
        const falloffKind = anim?.falloff ?? "tip";
        const axis = anim?.axis ?? "normal";

        // working buffers
        const deformed = spine.map((p) => ({ x: p.x, y: p.y, width: p.width }));
        const quadVerts: SceneVector2[] = [ { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 } ];

        const deformSpine = (tNow: number) => {
          const n = spine.length;
          if (n < 2) return;
          const omega = (2 * Math.PI) / period;
          for (let i = 0; i < n; i += 1) {
            if (i === 0) { deformed[0]!.x = spine[0]!.x; deformed[0]!.y = spine[0]!.y; continue; }
            const a = spine[i - 1]!; const b = spine[i]!;
            const tx = b.x - a.x; const ty = b.y - a.y;
            const len = Math.hypot(tx, ty) || 1;
            const ux = tx / len; const uy = ty / len;
            const nx = -uy; const ny = ux;
            const ratio = i / (n - 1);
            const falloff = falloffKind === "tip" ? ratio : falloffKind === "root" ? 1 - ratio : 1;
            const angle = omega * tNow + phase + i * 0.35;
            const magnitude = amp * falloff;
            const dx = (axis === "tangent" ? ux : nx) * Math.sin(angle) * magnitude;
            const dy = (axis === "tangent" ? uy : ny) * Math.sin(angle) * magnitude;
            deformed[i]!.x = spine[i]!.x + dx;
            deformed[i]!.y = spine[i]!.y + dy;
          }
        };

        const buildQuad = (k: number) => {
          const a = deformed[k]!; const b = deformed[k + 1]!;
          const ax = a?.x ?? 0, ay = a?.y ?? 0;
          const bx = b?.x ?? ax, by = b?.y ?? ay;
          const tx = bx - ax; const ty = by - ay;
          const len = Math.hypot(tx, ty) || 1;
          const ux = tx / len; const uy = ty / len;
          const nx = -uy; const ny = ux;
          const aCapX = ax - ux * epsilon; const aCapY = ay - uy * epsilon;
          const bCapX = bx + ux * epsilon; const bCapY = by + uy * epsilon;
          const wa = ((a?.width) ?? 0) * 0.5; const wb = ((b?.width) ?? 0) * 0.5;
          const aLx = aCapX + nx * wa; const aLy = aCapY + ny * wa;
          const aRx = aCapX - nx * wa; const aRy = aCapY - ny * wa;
          const bLx = bCapX + nx * wb; const bLy = bCapY + ny * wb;
          const bRx = bCapX - nx * wb; const bRy = bCapY - ny * wb;
          if (winding === "CW") {
            quadVerts[0]!.x = aRx; quadVerts[0]!.y = aRy;
            quadVerts[1]!.x = bRx; quadVerts[1]!.y = bRy;
            quadVerts[2]!.x = bLx; quadVerts[2]!.y = bLy;
            quadVerts[3]!.x = aLx; quadVerts[3]!.y = aLy;
          } else {
            quadVerts[0]!.x = aLx; quadVerts[0]!.y = aLy;
            quadVerts[1]!.x = bLx; quadVerts[1]!.y = bLy;
            quadVerts[2]!.x = bRx; quadVerts[2]!.y = bRy;
            quadVerts[3]!.x = aRx; quadVerts[3]!.y = aRy;
          }
        };

        // Dynamic stroke primitive (optional)
        if (layer.stroke) {
          let strokeVerts: SceneVector2[] = [ {x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0} ];
          dynamicPrimitives.push(
            createDynamicPolygonPrimitive(instance, {
              getVertices: () => {
                deformSpine(Date.now());
                buildQuad(segIndex);
                // expand for stroke
                strokeVerts = expandVerticesForStroke(quadVerts, layer.stroke!.width);
                return strokeVerts;
              },
              offset: layer.offset,
              getFill: (target) => resolveLayerStrokeFill(target, layer.stroke!, renderer),
            })
          );
        }

        dynamicPrimitives.push(
          createDynamicPolygonPrimitive(instance, {
            getVertices: () => {
              deformSpine(Date.now());
              buildQuad(segIndex);
              return quadVerts;
            },
            offset: layer.offset,
            getFill: (target) => resolveLayerFill(target, layer.fill, renderer),
          })
        );
        return; // handled animated tentacle layer
      }
      if (layer.stroke) {
        const strokeVertices = expandVerticesForStroke(layer.vertices, layer.stroke.width);
        dynamicPrimitives.push(
          createDynamicPolygonPrimitive(instance, {
            vertices: strokeVertices,
            offset: layer.offset,
            getFill: (target) => resolveLayerStrokeFill(target, layer.stroke!, renderer),
          })
        );
      }
      dynamicPrimitives.push(
        createDynamicPolygonPrimitive(instance, {
          // For now we pass static vertices; sway animation will be integrated by writing updated vertices upstream
          vertices: layer.vertices,
          offset: layer.offset,
          getFill: (target) => resolveLayerFill(target, layer.fill, renderer),
        })
      );
      return;
    }

    if (layer.stroke) {
      dynamicPrimitives.push(
        createDynamicCirclePrimitive(instance, {
          segments: layer.segments,
          offset: layer.offset,
          radius: layer.radius + layer.stroke.width,
          getFill: (target) => resolveLayerStrokeFill(target, layer.stroke!, renderer),
        })
      );
    }
    dynamicPrimitives.push(
      createDynamicCirclePrimitive(instance, {
        segments: layer.segments,
        offset: layer.offset,
        radius: layer.radius,
        getFill: (target) => resolveLayerFill(target, layer.fill, renderer),
      })
    );
  });
};

const hasStroke = (stroke: SceneStroke | undefined): stroke is SceneStroke =>
  !!stroke && typeof stroke.width === "number" && stroke.width > 0;

export class PlayerUnitObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const rendererData = extractRendererData(instance);

    const dynamicPrimitives: DynamicPrimitive[] = [];
    
    const emitterPrimitive = createEmitterPrimitive(instance);
    if (emitterPrimitive) {
      dynamicPrimitives.push(emitterPrimitive);
    }

    if (rendererData.kind === "composite") {
      createCompositePrimitives(instance, rendererData, dynamicPrimitives);
    } else {
      if (hasStroke(instance.data.stroke)) {
        const strokeVertices = expandVerticesForStroke(
          rendererData.vertices,
          instance.data.stroke.width
        );
        const strokePrimitive = createDynamicPolygonPrimitive(instance, {
          vertices: strokeVertices,
          fill: createStrokeFill(instance.data.stroke),
          offset: rendererData.offset,
        });
        dynamicPrimitives.push(strokePrimitive);
      }

      dynamicPrimitives.push(
        createDynamicPolygonPrimitive(instance, {
          vertices: rendererData.vertices,
          offset: rendererData.offset,
        })
      );
    }

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}

const createStrokeFill = (stroke: SceneStroke) => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: stroke.color.r,
    g: stroke.color.g,
    b: stroke.color.b,
    a: typeof stroke.color.a === "number" ? stroke.color.a : 1,
  },
});

const expandVerticesForStroke = (vertices: SceneVector2[], strokeWidth: number) => {
  if (strokeWidth <= 0) {
    return vertices.map((vertex) => ({ ...vertex }));
  }

  const center = computeCenter(vertices);
  return vertices.map((vertex) => {
    const direction = {
      x: vertex.x - center.x,
      y: vertex.y - center.y,
    };
    const length = Math.hypot(direction.x, direction.y);
    if (length === 0) {
      return {
        x: vertex.x + strokeWidth,
        y: vertex.y,
      };
    }
    const scale = (length + strokeWidth) / Math.max(length, 1e-6);
    return {
      x: center.x + direction.x * scale,
      y: center.y + direction.y * scale,
    };
  });
};

const randomBetween = (min: number, max: number): number => {
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
};

const computeCenter = (vertices: SceneVector2[]): SceneVector2 => {
  if (vertices.length === 0) {
    return { x: 0, y: 0 };
  }

  let minX = vertices[0]!.x;
  let maxX = vertices[0]!.x;
  let minY = vertices[0]!.y;
  let maxY = vertices[0]!.y;

  for (let i = 1; i < vertices.length; i += 1) {
    const vertex = vertices[i]!;
    if (vertex.x < minX) {
      minX = vertex.x;
    } else if (vertex.x > maxX) {
      maxX = vertex.x;
    }
    if (vertex.y < minY) {
      minY = vertex.y;
    } else if (vertex.y > maxY) {
      maxY = vertex.y;
    }
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
};

const getEmitterConfig = (
  instance: SceneObjectInstance
): PlayerUnitEmitterRenderConfig | null => {
  const payload = instance.data.customData as PlayerUnitCustomData | undefined;
  if (!payload || typeof payload !== "object" || !payload.emitter) {
    return null;
  }

  const base = sanitizeParticleEmitterConfig(payload.emitter, {
    defaultColor: DEFAULT_EMITTER_COLOR,
    defaultOffset: { x: 0, y: 0 },
    minCapacity: 4,
  });
  if (!base) {
    return null;
  }

  const baseSpeed = Math.max(
    0,
    Number.isFinite(payload.emitter.baseSpeed)
      ? Number(payload.emitter.baseSpeed)
      : 0
  );
  const speedVariation = Math.max(
    0,
    Number.isFinite(payload.emitter.speedVariation)
      ? Number(payload.emitter.speedVariation)
      : 0
  );
  const spread = Math.max(
    0,
    Number.isFinite(payload.emitter.spread)
      ? Number(payload.emitter.spread)
      : 0
  );
  const physicalSize =
    typeof payload.physicalSize === "number" && Number.isFinite(payload.physicalSize)
      ? Math.max(payload.physicalSize, 0)
      : 0;

  return {
    ...base,
    baseSpeed,
    speedVariation,
    spread,
    physicalSize,
  };
};

const serializeEmitterConfig = (
  config: PlayerUnitEmitterRenderConfig
): string => {
  const serializedFill = config.fill ? JSON.stringify(config.fill) : "";
  return [
    config.particlesPerSecond,
    config.particleLifetimeMs,
    config.fadeStartMs,
    config.sizeRange.min,
    config.sizeRange.max,
    config.offset.x,
    config.offset.y,
    config.color.r,
    config.color.g,
    config.color.b,
    typeof config.color.a === "number" ? config.color.a : 1,
    config.emissionDurationMs ?? -1,
    config.capacity,
    config.baseSpeed,
    config.speedVariation,
    config.spread,
    config.physicalSize,
    serializedFill,
    config.shape,
  ].join(":");
};

const createEmitterPrimitive = (
  instance: SceneObjectInstance
): DynamicPrimitive | null =>
  createParticleEmitterPrimitive<PlayerUnitEmitterRenderConfig>(instance, {
    getConfig: getEmitterConfig,
    getOrigin: getEmitterOrigin,
    spawnParticle: createEmitterParticle,
    serializeConfig: serializeEmitterConfig,
  });

const getEmitterOrigin = (
  instance: SceneObjectInstance,
  config: PlayerUnitEmitterRenderConfig
): SceneVector2 => {
  const scale = Math.max(config.physicalSize, 1);
  const offset = {
    x: config.offset.x * scale,
    y: config.offset.y * scale,
  };
  return transformObjectPoint(instance.data.position, instance.data.rotation, offset);
};

const createEmitterParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: PlayerUnitEmitterRenderConfig
): ParticleEmitterParticleState => {
  const baseDirection = (instance.data.rotation ?? 0) + Math.PI;
  const halfSpread = config.spread / 2;
  const direction =
    baseDirection + (config.spread > 0 ? randomBetween(-halfSpread, halfSpread) : 0);
  const speed = Math.max(
    0,
    config.baseSpeed +
      (config.speedVariation > 0
        ? randomBetween(-config.speedVariation, config.speedVariation)
        : 0)
  );
  const size =
    config.sizeRange.min === config.sizeRange.max
      ? config.sizeRange.min
      : randomBetween(config.sizeRange.min, config.sizeRange.max);

  return {
    position: { x: origin.x, y: origin.y },
    velocity: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
    ageMs: 0,
    lifetimeMs: config.particleLifetimeMs,
    size,
  };
};
