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
} from "../../../primitives";
import { getInstanceRenderPosition } from "../../ObjectRenderer";
import type { DynamicPrimitive } from "../../ObjectRenderer";
import type { CompositeRendererData, RendererLayer, PlayerUnitCustomData } from "./types";
import {
  resolveLayerFill,
  resolveLayerStrokeFill,
  resolveStrokeColor,
} from "./helpers";
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
import {
  getAuraInstanceMap,
  acquireAuraSlotForInstance,
  writeAuraInstance,
} from "./aura.helpers";
import { POLYGON_SWAY_PHASE_STEP } from "./constants";
import { getTentacleTimeMs } from "./helpers";
import {
  createPolygonAnimSampler,
  createSpineSwaySampler,
  resolveAnimationExecutionMode,
} from "../../shared/animation-pipeline";
import { isAnimationGpuAvailable } from "../../shared/animation-gpu";
import type { RendererLayerAnchorConfig } from "@shared/types/renderer.types";

/**
 * Creates composite primitives for player unit renderer
 */
export const createCompositePrimitives = (
  instance: SceneObjectInstance,
  renderer: CompositeRendererData,
  dynamicPrimitives: DynamicPrimitive[]
): void => {
  const payload = instance.data.customData as PlayerUnitCustomData | undefined;
  // Створюємо аури, якщо вони є в конфігу
  if (renderer.auras && Array.isArray(payload?.modules)) {
    const instanceId = instance.id;
    const auraInstanceMap = getAuraInstanceMap();

    // Очищаємо старі аури для цього instance
    const existingSlots = auraInstanceMap.get(instanceId);
    if (existingSlots) {
      const { petalAuraGpuRenderer } = require("../../../primitives/gpu/petal-aura");
      existingSlots.forEach(({ handle }) => {
        // releaseSlot marks slots as inactive and returns them to the pool
        petalAuraGpuRenderer.releaseSlot(handle);
      });
    }

    const newSlots: typeof existingSlots = [];

    renderer.auras.forEach((auraConfig) => {
      if (auraConfig.requiresModule) {
        if (!payload?.modules?.includes(auraConfig.requiresModule)) {
          return;
        }
      }
      const petalCount = Math.max(1, Math.floor(auraConfig.petalCount));
      const handle = acquireAuraSlotForInstance(instanceId, petalCount);
      if (!handle) {
        return;
      }
      const basePhase = Math.random() * Math.PI * 2;

      newSlots.push({
        instanceId,
        handle,
        auraConfig,
        basePhase,
      });

      // Записуємо пелюстки одразу
      const renderPosition = getInstanceRenderPosition(instance);
      writeAuraInstance(handle, {
        position: { ...renderPosition },
        basePhase,
        active: true,
        petalCount: auraConfig.petalCount,
        innerRadius: auraConfig.innerRadius,
        outerRadius: auraConfig.outerRadius,
        petalWidth:
          auraConfig.petalWidth ??
          (auraConfig.outerRadius - auraConfig.innerRadius) * 0.5,
        rotationSpeed: auraConfig.rotationSpeed,
        color: [auraConfig.color.r, auraConfig.color.g, auraConfig.color.b],
        alpha: auraConfig.alpha,
        pointInward: auraConfig.pointInward ?? false,
      });
    });

    auraInstanceMap.set(instanceId, newSlots);
  }

  const emptyData = new Float32Array(0);
  const normalizeGroupId = (groupId: string | undefined): string => groupId ?? "default";
  const gpuJoinAvailable = isAnimationGpuAvailable();
  const supportsGpuJoin = (layer: RendererLayer): boolean =>
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
  const collectAnchors = (layer: RendererLayer): RendererLayerAnchorConfig[] =>
    mergeLayerAnchors(layer.anchors, layer.connectionSlots);
  const resolveJoinOffsetForLayer = (layer: RendererLayer) =>
    layer.join
      ? (target: SceneObjectInstance) =>
          resolveJoinOffset({
            instanceId: target.id,
            join: layer.join,
            baseOffset: layer.offset,
          })
      : undefined;

  // Group tentacle segments by groupId for potential future use (not required to animate basic sway)
  renderer.layers.forEach((layer, layerIndex) => {
    // If a layer requires a module, render it only when present
    const payload = instance.data.customData as PlayerUnitCustomData | undefined;
    const required = layer.requiresModule;
    if (
      required &&
      (!payload || !Array.isArray(payload.modules) || !payload.modules.includes(required))
    ) {
      return;
    }
    const reqSkill = layer.requiresSkill;
    if (
      reqSkill &&
      (!payload || !Array.isArray(payload.skills) || !payload.skills.includes(reqSkill))
    ) {
      return;
    }
    const reqEffect = layer.requiresEffect;
    if (reqEffect) {
      const effects: string[] = Array.isArray(payload?.effects) ? payload.effects : [];
      if (!effects.includes(reqEffect)) {
        return;
      }
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
          fill: resolveLayerFill(instance, layer.fill, renderer),
          anchorIndex,
          joinOffset: joinOffsetForGpu,
          refreshFill: (inst) => resolveLayerFill(inst, layer.fill, renderer),
        });
        if (fillPrimitive) {
          dynamicPrimitives.push(fillPrimitive);
        } else {
          // Fallback to CPU path if GPU primitive could not be created
          // Continue with regular handling below.
        }
        if (layer.stroke) {
          const strokeColor =
            layer.stroke.kind === "solid"
              ? layer.stroke.color
              : resolveStrokeColor(instance, renderer.baseStrokeColor, renderer.baseFillColor);
          const sceneStroke: SceneStroke = {
            width: layer.stroke.width,
            color: strokeColor,
          };
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
        if (fillPrimitive) {
          return;
        }
      }
      // Sway animation for tentacle segments built from a line spine
      if (Array.isArray(layer.spine) && layer.anim?.type === "sway") {
        const executionMode = resolveAnimationExecutionMode({
          requested: layer.anim.executionMode,
          gpuAvailable: isAnimationGpuAvailable(),
          warnKey: `player-unit:${instance.id}:spine:${layer.groupId ?? layerIndex}`,
        });
        const sampler = createSpineSwaySampler({
          spine: layer.spine,
          segmentIndex: typeof layer.segmentIndex === "number" ? layer.segmentIndex : 0,
          buildOpts: layer.buildOpts,
          anim: layer.anim,
          timeSource: getTentacleTimeMs,
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
            const resolved = resolveLayerAnchors(
              anchorConfigs,
              quadVerts,
              sampler.getDeformedSpine(),
              staticOffset
            );
            writeAnchorsForLayer(instance.id, layer.groupId, resolved);
          }
          return quadVerts;
        };

        if (layer.stroke) {
          const layerStrokeForTentacle = layer.stroke;
          const strokeColor =
            layer.stroke.kind === "solid"
              ? layer.stroke.color
              : resolveStrokeColor(instance, renderer.baseStrokeColor, renderer.baseFillColor);
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
              refreshStroke: layerStrokeForTentacle.kind === "base"
                ? (inst) => ({
                    width: layerStrokeForTentacle.width,
                    color: resolveStrokeColor(inst, renderer.baseStrokeColor, renderer.baseFillColor),
                  })
                : undefined,
            })
          );
        }

        // OPTIMIZATION: Cache fill for tentacle layers - vertices animate but fill is static
        // Always add refreshFill to track visual effect changes
        const tentacleFill = resolveLayerFill(instance, layer.fill, renderer);
        const layerFillForTentacle = layer.fill;
        dynamicPrimitives.push(
          createDynamicPolygonPrimitive(instance, {
            getVertices: sampleVertices,
            offset: staticOffset,
            getOffset,
            fill: tentacleFill,
            refreshFill: (inst) => resolveLayerFill(inst, layerFillForTentacle, renderer),
          })
        );
        return; // handled animated tentacle layer
      }
      // Generic polygon layer (no spine). If it has anim.sway/pulse, deform vertices per-frame.
      const animCfg = layer.anim;

      if (animCfg && (animCfg.type === "sway" || animCfg.type === "pulse")) {
        const executionMode = resolveAnimationExecutionMode({
          requested: animCfg.executionMode,
          gpuAvailable: isAnimationGpuAvailable(),
          warnKey: `player-unit:${instance.id}:polygon:${layer.groupId ?? layerIndex}`,
        });
        const anchorConfigs = collectAnchors(layer);
        const hasAnchors = anchorConfigs.length > 0;
        const needsCpuVertices =
          executionMode !== "gpu" || Boolean(layer.stroke) || (hasAnchors && needsCpuAnchors);
        const sampler = needsCpuVertices
          ? createPolygonAnimSampler({
              vertices: layer.vertices,
              anim: animCfg,
              timeSource: getTentacleTimeMs,
              enableMovementAxis: true,
              phaseStep: POLYGON_SWAY_PHASE_STEP,
              executionMode: "cpu",
            })
          : null;
        const getDeformedVertices = () => {
          const deformed = sampler ? sampler.getVertices() : layer.vertices;
          if (hasAnchors && needsCpuAnchors) {
            const resolved = resolveLayerAnchors(anchorConfigs, deformed, undefined, staticOffset);
            writeAnchorsForLayer(instance.id, layer.groupId, resolved);
          }
          return deformed;
        };

        if (layer.stroke) {
          const layerStrokeForAnimated = layer.stroke;
          const strokeColor =
            layer.stroke.kind === "solid"
              ? layer.stroke.color
              : resolveStrokeColor(instance, renderer.baseStrokeColor, renderer.baseFillColor);
          const sceneStroke: SceneStroke = { width: layer.stroke.width, color: strokeColor };
          dynamicPrimitives.push(
            createDynamicPolygonStrokePrimitive(instance, {
              getVertices: () => getDeformedVertices(),
              stroke: sceneStroke,
              offset: staticOffset,
              getOffset,
              refreshStroke: layerStrokeForAnimated.kind === "base"
                ? (inst) => ({
                    width: layerStrokeForAnimated.width,
                    color: resolveStrokeColor(inst, renderer.baseStrokeColor, renderer.baseFillColor),
                  })
                : undefined,
            })
          );
        }
        // OPTIMIZATION: Cache fill for animated layers too - vertices change but fill is usually static
        // Always add refreshFill to track visual effect changes
        const animatedLayerFill = resolveLayerFill(instance, layer.fill, renderer);
        const layerFillForAnimated = layer.fill;
        if (executionMode === "gpu") {
          const gpuPrimitive = createPolygonGpuPrimitive(instance, {
            vertices: layer.vertices,
            anim: animCfg,
            fill: animatedLayerFill,
            offset: staticOffset,
            phaseStep: POLYGON_SWAY_PHASE_STEP,
            enableMovementAxis: true,
            refreshFill: (inst) => resolveLayerFill(inst, layerFillForAnimated, renderer),
          });
          if (gpuPrimitive) {
            dynamicPrimitives.push(gpuPrimitive);
            if (hasAnchors) {
              const anchorGpuPrimitive = createPolygonAnchorGpuPrimitive({
                instance,
                groupId: layer.groupId,
                anchors: anchorConfigs,
                vertices: layer.vertices,
                anim: animCfg,
                offset: staticOffset,
                phaseStep: POLYGON_SWAY_PHASE_STEP,
                enableMovementAxis: true,
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
                  const resolved = resolveLayerAnchors(anchorConfigs, deformed, undefined, staticOffset);
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
              refreshFill: (inst) => resolveLayerFill(inst, layerFillForAnimated, renderer),
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
            refreshFill: (inst) => resolveLayerFill(inst, layerFillForAnimated, renderer),
          });
          if (getOffset) {
            primitive.autoAnimate = true;
          }
          dynamicPrimitives.push(primitive);
        }
      } else {
        if (layer.stroke) {
          const layerStrokeForStatic = layer.stroke;
          const strokeColor =
            layer.stroke.kind === "solid"
              ? layer.stroke.color
              : resolveStrokeColor(instance, renderer.baseStrokeColor, renderer.baseFillColor);
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
              refreshStroke: layerStrokeForStatic.kind === "base"
                ? (inst) => ({
                    width: layerStrokeForStatic.width,
                    color: resolveStrokeColor(inst, renderer.baseStrokeColor, renderer.baseFillColor),
                  })
                : undefined,
            })
          );
        }
        // OPTIMIZATION: Cache fill at registration time for static layers
        // Always add refreshFill to track visual effect changes
        const cachedFill = resolveLayerFill(instance, layer.fill, renderer);
        const layerFillForStatic = layer.fill;
        const anchorConfigs = collectAnchors(layer);
        if (anchorConfigs.length > 0 && needsCpuAnchors) {
          const resolved = resolveLayerAnchors(anchorConfigs, layer.vertices, layer.spine, staticOffset);
          writeAnchorsForLayer(instance.id, layer.groupId, resolved);
        }
        const primitive = createDynamicPolygonPrimitive(instance, {
          vertices: layer.vertices,
          offset: staticOffset,
          getOffset,
          fill: cachedFill,
          refreshFill: (inst) => resolveLayerFill(inst, layerFillForStatic, renderer),
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
      const anchorIndex = layer.join && supportsGpuJoin(layer)
        ? getGpuAnchorIndex(instance.id, layer.join.targetGroupId, layer.join.anchorId)
        : null;
      const joinOffsetForGpu = layer.join
        ? {
            x: (layer.offset?.x ?? 0) + (layer.join.offset?.x ?? 0),
            y: (layer.offset?.y ?? 0) + (layer.join.offset?.y ?? 0),
          }
        : undefined;
      if (layer.join && anchorIndex !== null && !layer.stroke) {
        const fillPrimitive = createJoinedCircleGpuPrimitive(instance, {
          radius: layer.radius,
          segments: layer.segments,
          fill: resolveLayerFill(instance, layer.fill, renderer),
          anchorIndex,
          joinOffset: joinOffsetForGpu,
          refreshFill: (inst) => resolveLayerFill(inst, layer.fill, renderer),
        });
        if (fillPrimitive) {
          dynamicPrimitives.push(fillPrimitive);
          return;
        }
      }
      // OPTIMIZATION: Cache fills at registration time for static layers
      if (layer.stroke) {
        const layerStrokeForCircle = layer.stroke;
        const cachedStrokeFill = resolveLayerStrokeFill(instance, layer.stroke, renderer);
        const strokePrimitive = createDynamicCirclePrimitive(instance, {
          segments: layer.segments,
          offset: staticOffset,
          getOffset,
          radius: layer.radius + layer.stroke.width,
          fill: cachedStrokeFill,
          refreshFill: layerStrokeForCircle.kind === "base"
            ? (inst) => resolveLayerStrokeFill(inst, layerStrokeForCircle, renderer)
            : undefined,
        });
        if (getOffset) {
          strokePrimitive.autoAnimate = true;
        }
        dynamicPrimitives.push(strokePrimitive);
      }
      // Always add refreshFill to track visual effect changes
      const cachedFill = resolveLayerFill(instance, layer.fill, renderer);
      const layerFillForCircle = layer.fill;
      const circlePrimitive = createDynamicCirclePrimitive(instance, {
        segments: layer.segments,
        offset: staticOffset,
        getOffset,
        radius: layer.radius,
        fill: cachedFill,
        refreshFill: (inst) => resolveLayerFill(inst, layerFillForCircle, renderer),
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
      // Sprite layer - uses RectanglePrimitive as fallback until texture support is added
      const spritePrimitive = createDynamicSpritePrimitive(instance, {
        spritePath: layer.spritePath,
        getWidth: () => layer.width,
        getHeight: () => layer.height,
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
