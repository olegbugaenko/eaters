import type { SceneObjectInstance, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { createDynamicPolygonPrimitive, createDynamicPolygonStrokePrimitive } from "../../../primitives";
import type { DynamicPrimitive, StaticPrimitive } from "../../ObjectRenderer";
import type { OctopusTentacleConfig, OctopusTentacleTipGlowConfig } from "@db/enemies-db";
import type { EnemyRendererCompositeConfig } from "@db/enemies-db";
import type { EnemyCustomData } from "./types";
import { resolveLayerFill, resolveStrokeColor } from "./composite-helpers";
import type { EnemyRendererLayerFill, EnemyRendererLayerStroke } from "./composite-helpers";
import { createSpineSwaySampler } from "../../shared/animation-pipeline";
import type { SpineSwaySampler } from "../../shared/animation-pipeline";
import { getNowMs } from "@shared/helpers/time.helper";
import type { RendererFillConfig, RendererStrokeConfig } from "@shared/types/renderer-config";
import { sanitizeCompositeFillConfig, sanitizeCompositeStrokeConfig } from "../../shared/composite-renderer-helpers";
import { createFillVertexComponents, writeFillVertexComponents } from "../../../primitives/utils/fill";
import { VERTEX_COMPONENTS, POSITION_COMPONENTS, getInstanceRenderPosition } from "../../ObjectRenderer";

/**
 * Converts RendererFillConfig (DB format, uses "type") to CompositeRendererLayerFill (runtime, uses "kind")
 */
export const toLayerFill = (fill: RendererFillConfig): EnemyRendererLayerFill =>
  sanitizeCompositeFillConfig(fill);

export const toLayerStroke = (stroke: RendererStrokeConfig): EnemyRendererLayerStroke => {
  const sanitized = sanitizeCompositeStrokeConfig(stroke);
  if (!sanitized) {
    return { kind: "solid", width: stroke.width, color: { r: 1, g: 1, b: 1, a: 1 } };
  }
  return sanitized;
};

const COLLAPSED_VERTS: SceneVector2[] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

const DEFAULT_GLOW_SEGMENTS = 16;

const buildGlowCircleTrig = (segments: number) => {
  const cos = new Float32Array(segments);
  const sin = new Float32Array(segments);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    cos[i] = Math.cos(a);
    sin[i] = Math.sin(a);
  }
  return { cos, sin };
};

const buildGlowCircleData = (
  cx: number,
  cy: number,
  radius: number,
  fillComponents: Float32Array,
  segments: number,
  trig: { cos: Float32Array; sin: Float32Array },
  target: Float32Array,
): void => {
  let offset = 0;
  for (let i = 0; i < segments; i++) {
    const cos1 = trig.cos[i]!;
    const sin1 = trig.sin[i]!;
    const next = (i + 1) % segments;
    const cos2 = trig.cos[next]!;
    const sin2 = trig.sin[next]!;
    target[offset] = cx;
    target[offset + 1] = cy;
    target.set(fillComponents, offset + POSITION_COMPONENTS);
    offset += VERTEX_COMPONENTS;
    target[offset] = cx + cos1 * radius;
    target[offset + 1] = cy + sin1 * radius;
    target.set(fillComponents, offset + POSITION_COMPONENTS);
    offset += VERTEX_COMPONENTS;
    target[offset] = cx + cos2 * radius;
    target[offset + 1] = cy + sin2 * radius;
    target.set(fillComponents, offset + POSITION_COMPONENTS);
    offset += VERTEX_COMPONENTS;
  }
};

const createTipGlowPrimitive = (
  instance: SceneObjectInstance,
  tipGlow: OctopusTentacleTipGlowConfig,
  compositeConfig: EnemyRendererCompositeConfig,
  tipSampler: SpineSwaySampler,
  spineLength: number,
  aliveRef: Int32Array,
  tentacleIdx: number,
  segmentsPerTentacle: number,
): DynamicPrimitive => {
  const segments = Math.max(3, Math.floor(tipGlow.segments ?? DEFAULT_GLOW_SEGMENTS));
  const trig = buildGlowCircleTrig(segments);
  const radius = tipGlow.radius;
  const layerFill = toLayerFill(tipGlow.fill);
  const resolvedFill = resolveLayerFill(instance, layerFill, compositeConfig);
  const fillSize = { width: radius * 2, height: radius * 2 };

  const fillComponents = createFillVertexComponents({
    fill: resolvedFill,
    center: { x: 0, y: 0 },
    rotation: 0,
    size: fillSize,
    radius,
  });
  const isSolidFill = resolvedFill.fillType === 0;
  const tipCenter = { x: 0, y: 0 };

  const vertexCount = segments * 3;
  const data = new Float32Array(vertexCount * VERTEX_COMPONENTS);
  const emptyData = new Float32Array(0);

  const capturedTi = tentacleIdx;

  return {
    get data() {
      return aliveRef[capturedTi]! >= segmentsPerTentacle ? data : emptyData;
    },
    autoAnimate: true,
    update: (inst: SceneObjectInstance) => {
      if (aliveRef[capturedTi]! < segmentsPerTentacle) {
        return null;
      }
      const spine = tipSampler.getDeformedSpine();
      const tip = spine[spineLength - 1];
      if (!tip) return null;
      const pos = getInstanceRenderPosition(inst);
      const rot = inst.data.rotation ?? 0;
      let wx: number, wy: number;
      if (rot !== 0) {
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        wx = pos.x + tip.x * cos - tip.y * sin;
        wy = pos.y + tip.x * sin + tip.y * cos;
      } else {
        wx = pos.x + tip.x;
        wy = pos.y + tip.y;
      }
      if (!isSolidFill) {
        tipCenter.x = wx;
        tipCenter.y = wy;
        writeFillVertexComponents(fillComponents, {
          fill: resolvedFill,
          center: tipCenter,
          rotation: 0,
          size: fillSize,
          radius,
        });
      }
      buildGlowCircleData(wx, wy, radius, fillComponents, segments, trig, data);
      return data;
    },
  };
};

/**
 * Creates tentacle primitives for the Great Octopus body enemy.
 * Each tentacle is a continuous spine with sway animation.
 * A "control" primitive reads customData.aliveSegments each frame
 * and a shared alive ref controls per-segment visibility.
 */
export const createOctopusTentaclePrimitives = (
  instance: SceneObjectInstance,
  tentacles: OctopusTentacleConfig,
  compositeConfig: EnemyRendererCompositeConfig,
  dynamicPrimitives: DynamicPrimitive[]
): void => {
  const { spines, segmentsPerTentacle, anim, fill, stroke, buildOpts } = tentacles;
  const tentacleCount = spines.length;
  const emptyData = new Float32Array(0);

  const aliveRef = new Int32Array(tentacleCount).fill(segmentsPerTentacle);

  const controlPrimitive: DynamicPrimitive = {
    get data() {
      return emptyData;
    },
    autoAnimate: true,
    update: (inst: SceneObjectInstance) => {
      const data = inst.data.customData as EnemyCustomData | undefined;
      const segments = data?.aliveSegments;
      if (segments) {
        for (let i = 0; i < tentacleCount; i++) {
          aliveRef[i] = segments[i] ?? segmentsPerTentacle;
        }
      }
      return null;
    },
  };
  dynamicPrimitives.push(controlPrimitive);

  const tentaclePhaseStep = (Math.PI * 2) / tentacleCount;

  const { tipGlow } = tentacles;

  for (let ti = 0; ti < tentacleCount; ti++) {
    const spine = spines[ti];
    if (!spine || spine.length < 2) continue;

    const numSegments = Math.min(spine.length - 1, segmentsPerTentacle);
    const tentaclePhase = (anim.phase ?? 0) + ti * tentaclePhaseStep;
    const spinePoints = spine.map((p) => ({ x: p.x, y: p.y, width: p.width }));

    let lastSegmentSampler: SpineSwaySampler | null = null;

    for (let si = 0; si < numSegments; si++) {
      const sampler = createSpineSwaySampler({
        spine: spinePoints,
        segmentIndex: si,
        buildOpts: buildOpts ? { ...buildOpts } : undefined,
        anim: { ...anim, phase: tentaclePhase },
        timeSource: getNowMs,
        executionMode: "cpu",
      });

      if (si === numSegments - 1) {
        lastSegmentSampler = sampler;
      }

      const capturedTi = ti;
      const capturedSi = si;

      const getVertices = () => {
        if (capturedSi >= aliveRef[capturedTi]!) {
          return COLLAPSED_VERTS;
        }
        return sampler.getVertices();
      };

      if (stroke) {
        const layerStroke = toLayerStroke(stroke);
        const strokeColor =
          layerStroke.kind === "solid"
            ? layerStroke.color
            : resolveStrokeColor(instance, compositeConfig.stroke?.color, compositeConfig.fill);
        dynamicPrimitives.push(
          createDynamicPolygonStrokePrimitive(instance, {
            getVertices,
            stroke: { width: layerStroke.width, color: strokeColor },
          })
        );
      }

      const layerFill = toLayerFill(fill);
      const segmentFill = resolveLayerFill(instance, layerFill, compositeConfig);
      dynamicPrimitives.push(
        createDynamicPolygonPrimitive(instance, {
          getVertices,
          fill: segmentFill,
        })
      );
    }

    if (tipGlow && lastSegmentSampler) {
      dynamicPrimitives.push(
        createTipGlowPrimitive(
          instance,
          tipGlow,
          compositeConfig,
          lastSegmentSampler,
          spine.length,
          aliveRef,
          ti,
          segmentsPerTentacle,
        )
      );
    }
  }
};
