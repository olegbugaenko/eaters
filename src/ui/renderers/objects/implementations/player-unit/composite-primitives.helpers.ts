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
} from "../../../primitives";
import { getInstanceRenderPosition } from "../../ObjectRenderer";
import type { DynamicPrimitive } from "../../ObjectRenderer";
import type { CompositeRendererData, RendererLayer, PlayerUnitCustomData } from "./types";
import {
  resolveLayerFill,
  resolveLayerStrokeFill,
  resolveStrokeColor,
} from "./helpers";
import { resolveLayerAnchors, writeAnchorsForLayer } from "../../shared/anchors";
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
      // Sway animation for tentacle segments built from a line spine
      if (Array.isArray(layer.spine) && layer.anim?.type === "sway") {
        const executionMode = resolveAnimationExecutionMode({
          requested: layer.anim.executionMode,
          gpuAvailable: false,
          warnKey: `player-unit:${instance.id}:spine:${layer.groupId ?? layerIndex}`,
        });
        void executionMode;
        const sampler = createSpineSwaySampler({
          spine: layer.spine,
          segmentIndex: typeof layer.segmentIndex === "number" ? layer.segmentIndex : 0,
          buildOpts: layer.buildOpts,
          anim: layer.anim,
          timeSource: getTentacleTimeMs,
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
              offset: layer.offset,
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
            offset: layer.offset,
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
          gpuAvailable: false,
          warnKey: `player-unit:${instance.id}:polygon:${layer.groupId ?? layerIndex}`,
        });
        void executionMode;
        const sampler = createPolygonAnimSampler({
          vertices: layer.vertices,
          anim: animCfg,
          timeSource: getTentacleTimeMs,
          enableMovementAxis: true,
          phaseStep: POLYGON_SWAY_PHASE_STEP,
        });
        const hasAnchors = Array.isArray(layer.anchors) && layer.anchors.length > 0;
        const getDeformedVertices = () => {
          const deformed = sampler.getVertices();
          if (hasAnchors) {
            const resolved = resolveLayerAnchors(layer.anchors, deformed, undefined, layer.offset);
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
              offset: layer.offset,
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
        dynamicPrimitives.push(
          createDynamicPolygonPrimitive(instance, {
            getVertices: () => getDeformedVertices(),
            offset: layer.offset,
            fill: animatedLayerFill,
            refreshFill: (inst) => resolveLayerFill(inst, layerFillForAnimated, renderer),
          })
        );
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
              offset: layer.offset,
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
        if (Array.isArray(layer.anchors) && layer.anchors.length > 0) {
          const resolved = resolveLayerAnchors(layer.anchors, layer.vertices, layer.spine, layer.offset);
          writeAnchorsForLayer(instance.id, layer.groupId, resolved);
        }
        dynamicPrimitives.push(
          createDynamicPolygonPrimitive(instance, {
            vertices: layer.vertices,
            offset: layer.offset,
            fill: cachedFill,
            refreshFill: (inst) => resolveLayerFill(inst, layerFillForStatic, renderer),
          })
        );
      }
      return;
    }

    if (layer.shape === "circle") {
      // OPTIMIZATION: Cache fills at registration time for static layers
      if (layer.stroke) {
        const layerStrokeForCircle = layer.stroke;
        const cachedStrokeFill = resolveLayerStrokeFill(instance, layer.stroke, renderer);
        dynamicPrimitives.push(
          createDynamicCirclePrimitive(instance, {
            segments: layer.segments,
            offset: layer.offset,
            radius: layer.radius + layer.stroke.width,
            fill: cachedStrokeFill,
            refreshFill: layerStrokeForCircle.kind === "base"
              ? (inst) => resolveLayerStrokeFill(inst, layerStrokeForCircle, renderer)
              : undefined,
          })
        );
      }
      // Always add refreshFill to track visual effect changes
      const cachedFill = resolveLayerFill(instance, layer.fill, renderer);
      const layerFillForCircle = layer.fill;
      dynamicPrimitives.push(
        createDynamicCirclePrimitive(instance, {
          segments: layer.segments,
          offset: layer.offset,
          radius: layer.radius,
          fill: cachedFill,
          refreshFill: (inst) => resolveLayerFill(inst, layerFillForCircle, renderer),
        })
      );
      return;
    }

    if (layer.shape === "sprite") {
      // Sprite layer - uses RectanglePrimitive as fallback until texture support is added
      dynamicPrimitives.push(
        createDynamicSpritePrimitive(instance, {
          spritePath: layer.spritePath,
          getWidth: () => layer.width,
          getHeight: () => layer.height,
          offset: layer.offset,
        })
      );
      return;
    }
  });
};
