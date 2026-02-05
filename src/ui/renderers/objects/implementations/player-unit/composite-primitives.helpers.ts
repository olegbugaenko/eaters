import type {
  SceneObjectInstance,
  SceneFill,
  SceneStroke,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  createDynamicCirclePrimitive,
  createDynamicSpritePrimitive,
  createPolygonGpuPrimitive,
  createJoinedPolygonGpuPrimitive,
  createJoinedCircleGpuPrimitive,
  createJoinedPolygonStrokeGpuPrimitive,
  createJoinedCircleStrokeGpuPrimitive,
  createJoinedSpriteGpuPrimitive,
  createSpineGpuPrimitive,
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
    if (layer.join) {
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
        let strokeGpuPrimitive: DynamicPrimitive | null = null;
        if (layer.stroke) {
          const strokeColor =
            layer.stroke.kind === "solid"
              ? layer.stroke.color
              : resolveStrokeColor(instance, renderer.baseStrokeColor, renderer.baseFillColor);
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
                  color: resolveStrokeColor(inst, renderer.baseStrokeColor, renderer.baseFillColor),
                })
              : undefined,
          });
          // GPU-only: no CPU fallback for stroke
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
      // Sway animation for tentacle segments built from a line spine - GPU only
      if (Array.isArray(layer.spine) && layer.anim?.type === "sway") {
        const anchorConfigs = collectAnchors(layer);
        const hasAnchors = anchorConfigs.length > 0;
        
        // GPU anchors if needed
        if (hasAnchors) {
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

        // GPU spine fill (stroke not supported in GPU spine renderer)
        const tentacleFill = resolveLayerFill(instance, layer.fill, renderer);
        const layerFillForTentacle = layer.fill;
        const spinePrimitive = createSpineGpuPrimitive(instance, {
          spine: layer.spine,
          anim: layer.anim,
          fill: tentacleFill,
          offset: staticOffset,
          buildOpts: layer.buildOpts,
          refreshFill: (inst) => resolveLayerFill(inst, layerFillForTentacle, renderer),
        });
        
        if (spinePrimitive) {
          dynamicPrimitives.push(spinePrimitive);
        }
        return; // handled animated tentacle layer
      }
      // Generic polygon layer (no spine). If it has anim.sway/pulse, deform vertices per-frame.
      const animCfg = layer.anim;

      if (animCfg && (animCfg.type === "sway" || animCfg.type === "pulse")) {
        // GPU-only path for animated polygons
        const anchorConfigs = collectAnchors(layer);
        const hasAnchors = anchorConfigs.length > 0;
        const animatedLayerFill = resolveLayerFill(instance, layer.fill, renderer);
        const layerFillForAnimated = layer.fill;
        
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
        }
        return; // GPU-only, no CPU fallback
      } else {
        // GPU-only path for static polygons
        const cachedFill = resolveLayerFill(instance, layer.fill, renderer);
        const layerFillForStatic = layer.fill;
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
        
        // GPU-only: use regular GPU polygon (joined polygons already handled above)
        const gpuPrimitive = createPolygonGpuPrimitive(instance, {
          vertices: layer.vertices,
          offset: staticOffset ?? layer.offset,
          fill: cachedFill,
          refreshFill: (inst) => resolveLayerFill(inst, layerFillForStatic, renderer),
        });
        if (gpuPrimitive) {
          dynamicPrimitives.push(gpuPrimitive);
        }
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
          circle: { radius: layer.radius, segments: layer.segments },
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
          radius: layer.radius,
          segments: layer.segments,
          fill: resolveLayerFill(instance, layer.fill, renderer),
          anchorIndex,
          joinOffset: joinOffsetForGpu,
          refreshFill: (inst) => resolveLayerFill(inst, layer.fill, renderer),
        });
        let strokeGpuPrimitive: DynamicPrimitive | null = null;
        if (layer.stroke) {
          const strokeColor =
            layer.stroke.kind === "solid"
              ? layer.stroke.color
              : resolveStrokeColor(instance, renderer.baseStrokeColor, renderer.baseFillColor);
          const sceneStroke: SceneStroke = {
            width: layer.stroke.width,
            color: strokeColor,
          };
          strokeGpuPrimitive = createJoinedCircleStrokeGpuPrimitive(instance, {
            radius: layer.radius,
            segments: layer.segments,
            stroke: sceneStroke,
            anchorIndex,
            joinOffset: joinOffsetForGpu,
            refreshStroke: layer.stroke.kind === "base"
              ? (inst) => ({
                  width: layer.stroke!.width,
                  color: resolveStrokeColor(inst, renderer.baseStrokeColor, renderer.baseFillColor),
                })
              : undefined,
          });
          if (!strokeGpuPrimitive) {
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
      const needsCpuAnchors = joinTargets.has(normalizeGroupId(layer.groupId));
      const anchorConfigs = collectAnchors(layer);
      if (anchorConfigs.length > 0 && needsCpuAnchors) {
        const resolved = resolveLayerAnchors({
          anchors: anchorConfigs,
          offset: staticOffset,
          sprite: { width: layer.width, height: layer.height },
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
      if (layer.join && anchorIndex !== null && layer.spritePath) {
        const spritePrimitive = createJoinedSpriteGpuPrimitive(instance, {
          spritePath: layer.spritePath,
          width: layer.width,
          height: layer.height,
          anchorIndex,
          joinOffset: joinOffsetForGpu,
        });
        if (spritePrimitive) {
          dynamicPrimitives.push(spritePrimitive);
          return;
        }
      }
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
