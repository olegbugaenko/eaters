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
  createJoinedPolygonGpuPrimitive,
  createJoinedCircleGpuPrimitive,
  createJoinedPolygonStrokeGpuPrimitive,
  createJoinedCircleStrokeGpuPrimitive,
  createJoinedSpriteGpuPrimitive,
} from "../../../primitives";
import type { DynamicPrimitive } from "../../ObjectRenderer";
import type { EnemyRendererCompositeConfig } from "@db/enemies-db";
import {
  resolveLayerFill,
  resolveLayerStrokeFill,
  resolveStrokeColor,
  sanitizeCompositeLayer,
} from "./composite-helpers";
import type { EnemyRendererLayerFill } from "./composite-helpers";
import { getNowMs } from "@shared/helpers/time.helper";
import {
  mergeLayerAnchors,
  resolveJoinOffset,
  resolveLayerAnchors,
  writeAnchorsForLayer,
} from "../../shared/anchors";
import {
  createPolygonAnchorGpuPrimitive,
  createSpineAnchorGpuPrimitive,
  getGpuAnchorIndex,
} from "../../shared/anchors-gpu";
import { FillResolver } from "../../shared/fill-resolver";
import {
  createPolygonAnimSampler,
  createSpineSwaySampler,
  resolveAnimationExecutionMode,
} from "../../shared/animation-pipeline";
import { isAnimationGpuAvailable } from "../../shared/animation-gpu";
import type { RendererLayerAnchorConfig } from "@shared/types/renderer.types";

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
  const emptyData = new Float32Array(0);
  const fillResolver = new FillResolver<EnemyRendererLayerFill>((inst, layerFill) =>
    resolveLayerFill(inst, layerFill, renderer)
  );
  const normalizeGroupId = (groupId: string | undefined): string => groupId ?? "default";
  const gpuJoinAvailable = isAnimationGpuAvailable();
  const supportsGpuJoin = (layer: { shape?: string }): boolean =>
    gpuJoinAvailable && (layer.shape === "polygon" || layer.shape === "circle");
  const warnedJoinFallbacks = new Set<string>();
  const warnJoinFallback = (key: string, reason: string) => {
    if (warnedJoinFallbacks.has(key)) {
      return;
    }
    warnedJoinFallbacks.add(key);
    console.warn(`[CompositeRenderer] GPU join fallback (${reason}) for ${key}.`);
  };
  const joinTargets = new Set<string>();
  renderer.layers.forEach((layer) => {
    if (layer.join && !supportsGpuJoin(layer)) {
      joinTargets.add(normalizeGroupId(layer.join.targetGroupId));
    }
  });
  const collectAnchors = (layer: {
    anchors?: RendererLayerAnchorConfig[];
    connectionSlots?: RendererLayerAnchorConfig[];
  }): RendererLayerAnchorConfig[] => mergeLayerAnchors(layer.anchors, layer.connectionSlots);
  const resolveJoinOffsetForLayer = (layer: {
    join?: { anchorId: string; targetGroupId?: string; offset?: { x: number; y: number } };
    offset?: { x: number; y: number };
  }) =>
    layer.join
      ? (target: SceneObjectInstance) =>
          resolveJoinOffset({
            instanceId: target.id,
            join: layer.join,
            baseOffset: layer.offset,
          })
      : undefined;

  // Process each layer
  renderer.layers.forEach((layerConfig, layerIndex) => {
    const layer = sanitizeCompositeLayer(layerConfig);
    if (!layer) {
      return; // Skip invalid layers
    }

    if (layer.shape === "polygon") {
      const joinOffset = resolveJoinOffsetForLayer(layer);
      const getOffset = joinOffset ? joinOffset : undefined;
      const staticOffset = joinOffset ? undefined : layer.offset;
      const anchorIndex = layer.join && supportsGpuJoin(layer)
        ? getGpuAnchorIndex(instance.id, layer.join.targetGroupId, layer.join.anchorId)
        : null;
      const joinOffsetForGpu = layer.join
        ? {
            x: (layer.offset?.x ?? 0) + (layer.join.offset?.x ?? 0),
            y: (layer.offset?.y ?? 0) + (layer.join.offset?.y ?? 0),
          }
        : undefined;
      const canUseGpuJoin = anchorIndex !== null && !layer.anim;
      const groupKey = normalizeGroupId(layer.groupId);
      const needsCpuAnchors = joinTargets.has(groupKey);
      // Handle polygon layers
      if (!layer.vertices || layer.vertices.length < 3) {
        return;
      }
      if (layer.join && !supportsGpuJoin(layer)) {
        const warnKey = `${instance.id}:${layer.join.targetGroupId ?? "default"}:${layer.join.anchorId}`;
        warnJoinFallback(warnKey, "gpu-unavailable");
      }
      if (layer.join && supportsGpuJoin(layer) && anchorIndex === null) {
        const warnKey = `${instance.id}:${layer.join.targetGroupId ?? "default"}:${layer.join.anchorId}`;
        warnJoinFallback(warnKey, "anchor-missing");
      }
      if (layer.join && canUseGpuJoin) {
        const fillPrimitive = createJoinedPolygonGpuPrimitive(instance, {
          vertices: layer.vertices,
          fill: fillResolver.resolve(instance, layer.fill),
          anchorIndex,
          joinOffset: joinOffsetForGpu,
          refreshFill: (inst) => fillResolver.resolve(inst, layer.fill),
        });
        let strokeGpuPrimitive: DynamicPrimitive | null = null;
        if (layer.stroke) {
          const strokeColor =
            layer.stroke.kind === "solid"
              ? layer.stroke.color
              : resolveStrokeColor(instance, renderer.stroke?.color, renderer.fill);
          const sceneStroke: SceneStroke = {
            width: layer.stroke.width,
            color: strokeColor,
          };
          strokeGpuPrimitive = createJoinedPolygonStrokeGpuPrimitive(instance, {
            vertices: layer.vertices,
            stroke: sceneStroke,
            anchorIndex,
            joinOffset: joinOffsetForGpu,
            refreshStroke: layer.stroke.kind === "base"
              ? (inst) => ({
                  width: layer.stroke!.width,
                  color: resolveStrokeColor(inst, renderer.stroke?.color, renderer.fill),
                })
              : undefined,
          });
          if (!strokeGpuPrimitive) {
            const strokePrimitive = createDynamicPolygonStrokePrimitive(instance, {
              vertices: layer.vertices,
              stroke: sceneStroke,
              offset: staticOffset,
              getOffset,
            });
            if (getOffset) {
              strokePrimitive.autoAnimate = true;
            }
            dynamicPrimitives.push(strokePrimitive);
          }
        }
        if (fillPrimitive) {
          dynamicPrimitives.push(fillPrimitive);
        }
        if (strokeGpuPrimitive) {
          dynamicPrimitives.push(strokeGpuPrimitive);
        }
        if (fillPrimitive || strokeGpuPrimitive) {
          return;
        }
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
        const anchorConfigs = collectAnchors(layer);
        const hasAnchors = anchorConfigs.length > 0;
        if (executionMode === "gpu" && hasAnchors) {
          const gpuAnchorPrimitive = createSpineAnchorGpuPrimitive({
            instance,
            groupId: layer.groupId,
            anchors: anchorConfigs,
            spine: layer.spine,
            anim: layer.anim,
            offset: staticOffset,
          });
          if (gpuAnchorPrimitive) {
            dynamicPrimitives.push(gpuAnchorPrimitive);
          }
        }
        const sampleVertices = () => {
          const quadVerts = sampler.getVertices();
          if (hasAnchors && needsCpuAnchors) {
            const resolved = resolveLayerAnchors({
              anchors: anchorConfigs,
              vertices: quadVerts,
              spine: sampler.getDeformedSpine(),
              offset: staticOffset,
            });
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
              offset: staticOffset,
              getOffset,
            })
          );
        }
        const tentacleFill = fillResolver.resolve(instance, layer.fill);
        dynamicPrimitives.push(
          createDynamicPolygonPrimitive(instance, {
            getVertices: sampleVertices,
            offset: staticOffset,
            getOffset,
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
        const anchorConfigs = collectAnchors(layer);
        const hasAnchors = anchorConfigs.length > 0;
        const needsCpuVertices =
          executionMode !== "gpu" || Boolean(layer.stroke) || (hasAnchors && needsCpuAnchors);
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
          if (hasAnchors && needsCpuAnchors) {
            const resolved = resolveLayerAnchors({
              anchors: anchorConfigs,
              vertices: deformed,
              offset: staticOffset,
            });
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
              offset: staticOffset,
              getOffset,
            })
          );
        }
        const animatedLayerFill = fillResolver.resolve(instance, layer.fill);
        if (executionMode === "gpu") {
          const gpuPrimitive = createPolygonGpuPrimitive(instance, {
            vertices: baseVertices,
            anim: animCfg,
            fill: animatedLayerFill,
            offset: staticOffset,
            phaseStep: POLYGON_SWAY_PHASE_STEP,
          });
          if (gpuPrimitive) {
            dynamicPrimitives.push(gpuPrimitive);
            if (hasAnchors) {
              const anchorGpuPrimitive = createPolygonAnchorGpuPrimitive({
                instance,
                groupId: layer.groupId,
                anchors: anchorConfigs,
                vertices: baseVertices,
                anim: animCfg,
                offset: staticOffset,
                phaseStep: POLYGON_SWAY_PHASE_STEP,
              });
              if (anchorGpuPrimitive) {
                dynamicPrimitives.push(anchorGpuPrimitive);
              }
            }
            if (hasAnchors && sampler && needsCpuAnchors) {
              const anchorPrimitive: DynamicPrimitive = {
                get data() {
                  return emptyData;
                },
                autoAnimate: true,
                update: () => {
                  const deformed = sampler.getVertices();
                  const resolved = resolveLayerAnchors({
                    anchors: anchorConfigs,
                    vertices: deformed,
                    offset: staticOffset,
                  });
                  writeAnchorsForLayer(instance.id, layer.groupId, resolved);
                  return null;
                },
              };
              dynamicPrimitives.push(anchorPrimitive);
            }
          } else {
            const primitive = createDynamicPolygonPrimitive(instance, {
              getVertices: () => getDeformedVertices(),
              offset: staticOffset,
              getOffset,
              fill: animatedLayerFill,
            });
            if (getOffset) {
              primitive.autoAnimate = true;
            }
            dynamicPrimitives.push(primitive);
          }
        } else {
          const primitive = createDynamicPolygonPrimitive(instance, {
            getVertices: () => getDeformedVertices(),
            offset: staticOffset,
            getOffset,
            fill: animatedLayerFill,
          });
          if (getOffset) {
            primitive.autoAnimate = true;
          }
          dynamicPrimitives.push(primitive);
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
              offset: staticOffset,
              getOffset,
            })
          );
        }
        const cachedFill = fillResolver.resolve(instance, layer.fill);
        const anchorConfigs = collectAnchors(layer);
        if (anchorConfigs.length > 0 && needsCpuAnchors) {
          const resolved = resolveLayerAnchors({
            anchors: anchorConfigs,
            vertices: layer.vertices,
            spine: layer.spine,
            offset: staticOffset,
          });
          writeAnchorsForLayer(instance.id, layer.groupId, resolved);
        }
        const primitive = createDynamicPolygonPrimitive(instance, {
          vertices: layer.vertices,
          offset: staticOffset,
          getOffset,
          fill: cachedFill,
        });
        if (getOffset) {
          primitive.autoAnimate = true;
        }
        dynamicPrimitives.push(primitive);
      }
      return;
    }

    if (layer.shape === "circle") {
      const joinOffset = resolveJoinOffsetForLayer(layer);
      const getOffset = joinOffset ? joinOffset : undefined;
      const staticOffset = joinOffset ? undefined : layer.offset;
      const needsCpuAnchors = joinTargets.has(normalizeGroupId(layer.groupId));
      const anchorConfigs = collectAnchors(layer);
      if (anchorConfigs.length > 0 && needsCpuAnchors) {
        const resolved = resolveLayerAnchors({
          anchors: anchorConfigs,
          offset: staticOffset,
          circle: { radius: layer.radius!, segments: layer.segments },
        });
        writeAnchorsForLayer(instance.id, layer.groupId, resolved);
      }
      const anchorIndex = layer.join && supportsGpuJoin(layer)
        ? getGpuAnchorIndex(instance.id, layer.join.targetGroupId, layer.join.anchorId)
        : null;
      const joinOffsetForGpu = layer.join
        ? {
            x: (layer.offset?.x ?? 0) + (layer.join.offset?.x ?? 0),
            y: (layer.offset?.y ?? 0) + (layer.join.offset?.y ?? 0),
          }
        : undefined;
      if (layer.join && anchorIndex !== null) {
        const fillPrimitive = createJoinedCircleGpuPrimitive(instance, {
          radius: layer.radius!,
          segments: layer.segments,
          fill: fillResolver.resolve(instance, layer.fill),
          anchorIndex,
          joinOffset: joinOffsetForGpu,
          refreshFill: (inst) => fillResolver.resolve(inst, layer.fill),
        });
        let strokeGpuPrimitive: DynamicPrimitive | null = null;
        if (layer.stroke) {
          const strokeColor =
            layer.stroke.kind === "solid"
              ? layer.stroke.color
              : resolveStrokeColor(instance, renderer.stroke?.color, renderer.fill);
          const sceneStroke: SceneStroke = {
            width: layer.stroke.width,
            color: strokeColor,
          };
          strokeGpuPrimitive = createJoinedCircleStrokeGpuPrimitive(instance, {
            radius: layer.radius!,
            segments: layer.segments,
            stroke: sceneStroke,
            anchorIndex,
            joinOffset: joinOffsetForGpu,
            refreshStroke: layer.stroke.kind === "base"
              ? (inst) => ({
                  width: layer.stroke!.width,
                  color: resolveStrokeColor(inst, renderer.stroke?.color, renderer.fill),
                })
              : undefined,
          });
          if (!strokeGpuPrimitive) {
            const cachedStrokeFill = resolveLayerStrokeFill(instance, layer.stroke, renderer);
            const strokePrimitive = createDynamicCirclePrimitive(instance, {
              segments: layer.segments,
              offset: staticOffset,
              getOffset,
              radius: layer.radius! + layer.stroke.width,
              fill: cachedStrokeFill,
            });
            if (getOffset) {
              strokePrimitive.autoAnimate = true;
            }
            dynamicPrimitives.push(strokePrimitive);
          }
        }
        if (fillPrimitive) {
          dynamicPrimitives.push(fillPrimitive);
        }
        if (strokeGpuPrimitive) {
          dynamicPrimitives.push(strokeGpuPrimitive);
        }
        if (fillPrimitive || strokeGpuPrimitive) {
          return;
        }
      }
      // Circle layer
      if (layer.stroke) {
        const cachedStrokeFill = resolveLayerStrokeFill(instance, layer.stroke, renderer);
        const strokePrimitive = createDynamicCirclePrimitive(instance, {
          segments: layer.segments,
          offset: staticOffset,
          getOffset,
          radius: layer.radius! + layer.stroke.width,
          fill: cachedStrokeFill,
        });
        if (getOffset) {
          strokePrimitive.autoAnimate = true;
        }
        dynamicPrimitives.push(strokePrimitive);
      }
      const cachedFill = fillResolver.resolve(instance, layer.fill);
      const circlePrimitive = createDynamicCirclePrimitive(instance, {
        segments: layer.segments,
        offset: staticOffset,
        getOffset,
        radius: layer.radius!,
        fill: cachedFill,
      });
      if (getOffset) {
        circlePrimitive.autoAnimate = true;
      }
      dynamicPrimitives.push(circlePrimitive);
      return;
    }

    if (layer.shape === "sprite") {
      const joinOffset = resolveJoinOffsetForLayer(layer);
      const getOffset = joinOffset ? joinOffset : undefined;
      const staticOffset = joinOffset ? undefined : layer.offset;
      const needsCpuAnchors = joinTargets.has(normalizeGroupId(layer.groupId));
      const anchorConfigs = collectAnchors(layer);
      if (anchorConfigs.length > 0 && needsCpuAnchors) {
        const resolved = resolveLayerAnchors({
          anchors: anchorConfigs,
          offset: staticOffset,
          sprite: { width: layer.width!, height: layer.height! },
        });
        writeAnchorsForLayer(instance.id, layer.groupId, resolved);
      }
      const anchorIndex = layer.join
        ? getGpuAnchorIndex(instance.id, layer.join.targetGroupId, layer.join.anchorId)
        : null;
      const joinOffsetForGpu = layer.join
        ? {
            x: (layer.offset?.x ?? 0) + (layer.join.offset?.x ?? 0),
            y: (layer.offset?.y ?? 0) + (layer.join.offset?.y ?? 0),
          }
        : undefined;
      // Sprite layer - uses RectanglePrimitive as fallback until texture support is added
      if (!layer.spritePath || typeof layer.width !== "number" || typeof layer.height !== "number") {
        return; // Skip invalid sprite layers
      }
      if (layer.join && anchorIndex !== null) {
        const spritePrimitive = createJoinedSpriteGpuPrimitive(instance, {
          spritePath: layer.spritePath,
          width: layer.width!,
          height: layer.height!,
          anchorIndex,
          joinOffset: joinOffsetForGpu,
        });
        if (spritePrimitive) {
          dynamicPrimitives.push(spritePrimitive);
          return;
        }
      }
      const spritePrimitive = createDynamicSpritePrimitive(instance, {
        spritePath: layer.spritePath,
        getWidth: () => layer.width!,
        getHeight: () => layer.height!,
        offset: staticOffset,
        getOffset,
      });
      if (getOffset) {
        spritePrimitive.autoAnimate = true;
      }
      dynamicPrimitives.push(spritePrimitive);
      return;
    }
  });
};
