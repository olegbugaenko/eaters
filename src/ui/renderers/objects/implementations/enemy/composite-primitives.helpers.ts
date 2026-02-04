import type {
  SceneObjectInstance,
  SceneFill,
  SceneStroke,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  createDynamicCirclePrimitive,
  createDynamicPolygonPrimitive,
  createDynamicPolygonStrokePrimitive,
  createDynamicSpritePrimitive,
  createPolygonGpuPrimitive,
} from "../../../primitives";
import type { DynamicPrimitive } from "../../ObjectRenderer";
import type { EnemyRendererCompositeConfig } from "@db/enemies-db";
import {
  resolveLayerFill,
  resolveLayerStrokeFill,
  resolveStrokeColor,
  sanitizeCompositeLayer,
} from "./composite-helpers";
import { getNowMs } from "@shared/helpers/time.helper";
import { resolveLayerAnchors, writeAnchorsForLayer } from "../../shared/anchors";
import {
  createPolygonAnimSampler,
  createSpineSwaySampler,
  resolveAnimationExecutionMode,
} from "../../shared/animation-pipeline";
import { isAnimationGpuAvailable } from "../../shared/animation-gpu";

const POLYGON_SWAY_PHASE_STEP = 0.3; // Phase difference between vertices for wave-like animation

/**
 * Gets current timestamp for animations
 */
const getAnimationTimeMs = getNowMs;

/**
 * Creates composite primitives for enemy renderer
 */
export const createCompositePrimitives = (
  instance: SceneObjectInstance,
  renderer: EnemyRendererCompositeConfig,
  dynamicPrimitives: DynamicPrimitive[]
): void => {
  // Process each layer
  renderer.layers.forEach((layerConfig, layerIndex) => {
    const layer = sanitizeCompositeLayer(layerConfig);
    if (!layer) {
      return; // Skip invalid layers
    }

    if (layer.shape === "polygon") {
      // Handle polygon layers
      if (!layer.vertices || layer.vertices.length < 3) {
        return;
      }

      // Sway animation for tentacle segments built from a line spine (like player units)
      if (Array.isArray(layer.spine) && layer.anim?.type === "sway") {
        const executionMode = resolveAnimationExecutionMode({
          requested: layer.anim.executionMode,
          gpuAvailable: isAnimationGpuAvailable(),
          warnKey: `enemy:${instance.id}:spine:${layer.groupId ?? layerIndex}`,
        });
        const sampler = createSpineSwaySampler({
          spine: layer.spine,
          segmentIndex: typeof layer.segmentIndex === "number" ? layer.segmentIndex : 0,
          buildOpts: layer.buildOpts,
          anim: layer.anim,
          timeSource: getAnimationTimeMs,
          executionMode,
        });
        const hasAnchors = Array.isArray(layer.anchors) && layer.anchors.length > 0;
        const sampleVertices = () => {
          const quadVerts = sampler.getVertices();
          if (hasAnchors) {
            const resolved = resolveLayerAnchors(
              layer.anchors,
              quadVerts,
              sampler.getDeformedSpine(),
              layer.offset
            );
            writeAnchorsForLayer(instance.id, layer.groupId, resolved);
          }
          return quadVerts;
        };

        if (layer.stroke) {
          const strokeColor =
            layer.stroke.kind === "solid"
              ? layer.stroke.color
              : resolveStrokeColor(instance, renderer.stroke?.color, renderer.fill);
          const sceneStroke: SceneStroke = {
            width: layer.stroke.width,
            color: strokeColor,
          };
          dynamicPrimitives.push(
            createDynamicPolygonStrokePrimitive(instance, {
              getVertices: sampleVertices,
              stroke: sceneStroke,
              offset: layer.offset,
            })
          );
        }
        const tentacleFill = resolveLayerFill(instance, layer.fill, renderer);
        dynamicPrimitives.push(
          createDynamicPolygonPrimitive(instance, {
            getVertices: sampleVertices,
            offset: layer.offset,
            fill: tentacleFill,
          })
        );
        return; // handled animated tentacle layer
      }

      // Check for animation
      const animCfg = layer.anim;
      if (animCfg && (animCfg.type === "sway" || animCfg.type === "pulse")) {
        const baseVertices = layer.vertices ?? [];
        // Animated polygon layer
        const executionMode = resolveAnimationExecutionMode({
          requested: animCfg.executionMode,
          gpuAvailable: isAnimationGpuAvailable(),
          warnKey: `enemy:${instance.id}:polygon:${layer.groupId ?? layerIndex}`,
        });
        const hasAnchors = Array.isArray(layer.anchors) && layer.anchors.length > 0;
        const needsCpuVertices = executionMode !== "gpu" || Boolean(layer.stroke || hasAnchors);
        const sampler = needsCpuVertices
          ? createPolygonAnimSampler({
              vertices: baseVertices,
              anim: animCfg,
              timeSource: getAnimationTimeMs,
              phaseStep: POLYGON_SWAY_PHASE_STEP,
              executionMode: "cpu",
            })
          : null;
        const getDeformedVertices = () => {
          const deformed = sampler ? sampler.getVertices() : baseVertices;
          if (hasAnchors) {
            const resolved = resolveLayerAnchors(layer.anchors, deformed, undefined, layer.offset);
            writeAnchorsForLayer(instance.id, layer.groupId, resolved);
          }
          return deformed;
        };

        if (layer.stroke) {
          const strokeColor =
            layer.stroke.kind === "solid"
              ? layer.stroke.color
              : resolveStrokeColor(instance, renderer.stroke?.color, renderer.fill);
          const sceneStroke: SceneStroke = { width: layer.stroke.width, color: strokeColor };
          dynamicPrimitives.push(
            createDynamicPolygonStrokePrimitive(instance, {
              getVertices: () => getDeformedVertices(),
              stroke: sceneStroke,
              offset: layer.offset,
            })
          );
        }
        const animatedLayerFill = resolveLayerFill(instance, layer.fill, renderer);
        if (executionMode === "gpu") {
          const gpuPrimitive = createPolygonGpuPrimitive(instance, {
            vertices: baseVertices,
            anim: animCfg,
            fill: animatedLayerFill,
            offset: layer.offset,
            phaseStep: POLYGON_SWAY_PHASE_STEP,
          });
          if (gpuPrimitive) {
            dynamicPrimitives.push(gpuPrimitive);
          } else {
            dynamicPrimitives.push(
              createDynamicPolygonPrimitive(instance, {
                getVertices: () => getDeformedVertices(),
                offset: layer.offset,
                fill: animatedLayerFill,
              })
            );
          }
        } else {
          dynamicPrimitives.push(
            createDynamicPolygonPrimitive(instance, {
              getVertices: () => getDeformedVertices(),
              offset: layer.offset,
              fill: animatedLayerFill,
            })
          );
        }
      } else {
        // Static polygon layer
        if (layer.stroke) {
          const strokeColor =
            layer.stroke.kind === "solid"
              ? layer.stroke.color
              : resolveStrokeColor(instance, renderer.stroke?.color, renderer.fill);
          const sceneStroke: SceneStroke = {
            width: layer.stroke.width,
            color: strokeColor,
          };
          dynamicPrimitives.push(
            createDynamicPolygonStrokePrimitive(instance, {
              vertices: layer.vertices,
              stroke: sceneStroke,
              offset: layer.offset,
            })
          );
        }
        const cachedFill = resolveLayerFill(instance, layer.fill, renderer);
        if (Array.isArray(layer.anchors) && layer.anchors.length > 0) {
          const resolved = resolveLayerAnchors(layer.anchors, layer.vertices, layer.spine, layer.offset);
          writeAnchorsForLayer(instance.id, layer.groupId, resolved);
        }
        dynamicPrimitives.push(
          createDynamicPolygonPrimitive(instance, {
            vertices: layer.vertices,
            offset: layer.offset,
            fill: cachedFill,
          })
        );
      }
      return;
    }

    if (layer.shape === "circle") {
      // Circle layer
      if (layer.stroke) {
        const cachedStrokeFill = resolveLayerStrokeFill(instance, layer.stroke, renderer);
        dynamicPrimitives.push(
          createDynamicCirclePrimitive(instance, {
            segments: layer.segments,
            offset: layer.offset,
            radius: layer.radius! + layer.stroke.width,
            fill: cachedStrokeFill,
          })
        );
      }
      const cachedFill = resolveLayerFill(instance, layer.fill, renderer);
      dynamicPrimitives.push(
        createDynamicCirclePrimitive(instance, {
          segments: layer.segments,
          offset: layer.offset,
          radius: layer.radius!,
          fill: cachedFill,
        })
      );
      return;
    }

    if (layer.shape === "sprite") {
      // Sprite layer - uses RectanglePrimitive as fallback until texture support is added
      if (!layer.spritePath || typeof layer.width !== "number" || typeof layer.height !== "number") {
        return; // Skip invalid sprite layers
      }
      dynamicPrimitives.push(
        createDynamicSpritePrimitive(instance, {
          spritePath: layer.spritePath,
          getWidth: () => layer.width!,
          getHeight: () => layer.height!,
          offset: layer.offset,
        })
      );
      return;
    }
  });
};
