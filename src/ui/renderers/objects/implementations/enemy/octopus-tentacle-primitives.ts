import type { SceneObjectInstance, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { createDynamicPolygonPrimitive, createDynamicPolygonStrokePrimitive } from "../../../primitives";
import type { DynamicPrimitive } from "../../ObjectRenderer";
import type { OctopusTentacleConfig } from "@db/enemies-db";
import type { EnemyRendererCompositeConfig } from "@db/enemies-db";
import type { EnemyCustomData } from "./types";
import { resolveLayerFill, resolveStrokeColor } from "./composite-helpers";
import type { EnemyRendererLayerFill, EnemyRendererLayerStroke } from "./composite-helpers";
import { createSpineSwaySampler } from "../../shared/animation-pipeline";
import { getNowMs } from "@shared/helpers/time.helper";
import type { RendererFillConfig, RendererStrokeConfig } from "@shared/types/renderer-config";
import { sanitizeCompositeFillConfig, sanitizeCompositeStrokeConfig } from "../../shared/composite-renderer-helpers";

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

  for (let ti = 0; ti < tentacleCount; ti++) {
    const spine = spines[ti];
    if (!spine || spine.length < 2) continue;

    const numSegments = Math.min(spine.length - 1, segmentsPerTentacle);
    const tentaclePhase = (anim.phase ?? 0) + ti * tentaclePhaseStep;

    for (let si = 0; si < numSegments; si++) {
      const sampler = createSpineSwaySampler({
        spine: spine.map((p) => ({ x: p.x, y: p.y, width: p.width })),
        segmentIndex: si,
        buildOpts: buildOpts ? { ...buildOpts } : undefined,
        anim: { ...anim, phase: tentaclePhase },
        timeSource: getNowMs,
        executionMode: "cpu",
      });

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
  }
};
