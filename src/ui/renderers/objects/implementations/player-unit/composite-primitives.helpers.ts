import type {
  SceneObjectInstance,
  SceneVector2,
  SceneFill,
  SceneStroke,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  createDynamicCirclePrimitive,
  createDynamicPolygonPrimitive,
  createDynamicPolygonStrokePrimitive,
  createDynamicSpritePrimitive,
} from "../../../primitives";
import type { DynamicPrimitive } from "../../ObjectRenderer";
import type { CompositeRendererData, RendererLayer, PlayerUnitCustomData } from "./types";
import {
  resolveLayerFill,
  resolveLayerStrokeFill,
  resolveStrokeColor,
} from "./helpers";
import {
  getAuraInstanceMap,
  acquireAuraSlotForInstance,
  writeAuraInstance,
} from "./aura.helpers";
import { TAU, POLYGON_SWAY_PHASE_STEP } from "./constants";
import { getTentacleTimeMs } from "./helpers";

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
      writeAuraInstance(handle, {
        position: { ...instance.data.position },
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
  renderer.layers.forEach((layer) => {
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
        const rawSpine = layer.spine;
        const baseSpine = rawSpine.map((p) => ({ x: p.x, y: p.y, width: p.width }));
        const segIndex = typeof layer.segmentIndex === "number" ? layer.segmentIndex : 0;
        const build = layer.buildOpts || {};
        const winding = build.winding === "CW" ? "CW" : "CCW";
        const epsilon =
          typeof build.epsilon === "number" && isFinite(build.epsilon) ? build.epsilon : 0.2;
        const anim = layer.anim;
        const period = Math.max(anim?.periodMs ?? 1400, 1);
        const amplitude = anim?.amplitude ?? 1.0;
        const phase = anim?.phase ?? 0;
        const falloffKind = anim?.falloff ?? "tip";
        const axis = anim?.axis ?? "normal";

        const segmentCount = Math.max(baseSpine.length - 1, 0);
        const deformed = baseSpine.map((p) => ({ x: p.x, y: p.y, width: p.width }));
        const quadVerts: SceneVector2[] = [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ];

        const falloffFactors = new Float32Array(baseSpine.length);
        if (baseSpine.length > 1) {
          for (let i = 1; i < baseSpine.length; i += 1) {
            const ratio = i / (baseSpine.length - 1);
            falloffFactors[i] =
              falloffKind === "tip"
                ? ratio
                : falloffKind === "root"
                ? 1 - ratio
                : 1;
          }
        }

        const axisX = new Float32Array(segmentCount);
        const axisY = new Float32Array(segmentCount);
        for (let i = 0; i < segmentCount; i += 1) {
          const a = baseSpine[i]!;
          const b = baseSpine[i + 1]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const length = Math.hypot(dx, dy) || 1;
          const tangentX = dx / length;
          const tangentY = dy / length;
          const normalX = -tangentY;
          const normalY = tangentX;
          axisX[i] = axis === "tangent" ? tangentX : normalX;
          axisY[i] = axis === "tangent" ? tangentY : normalY;
        }

        const omega = (2 * Math.PI) / period;

        const deformSpine = (timeMs: number) => {
          if (baseSpine.length === 0) {
            return;
          }
          deformed[0]!.x = baseSpine[0]!.x;
          deformed[0]!.y = baseSpine[0]!.y;
          if (baseSpine.length === 1 || amplitude === 0 || segmentCount === 0) {
            for (let i = 1; i < baseSpine.length; i += 1) {
              deformed[i]!.x = baseSpine[i]!.x;
              deformed[i]!.y = baseSpine[i]!.y;
            }
            return;
          }

          // Спростимо анімацію - використовуємо один sin для всіх сегментів з різними фазами
          const baseAngle = omega * timeMs + phase;

          for (let i = 1; i < baseSpine.length; i += 1) {
            // Фазовий зсув базується на позиції сегмента (простіша версія)
            const segmentPhase = i * 0.5; // Фіксований зсув замість складного розрахунку
            const sinAngle = Math.sin(baseAngle + segmentPhase);
            const displacement = amplitude * falloffFactors[i]! * sinAngle;
            const axisXValue = axisX[i - 1] ?? 0;
            const axisYValue = axisY[i - 1] ?? 0;
            deformed[i]!.x = baseSpine[i]!.x + axisXValue * displacement;
            deformed[i]!.y = baseSpine[i]!.y + axisYValue * displacement;
          }
        };

        const buildQuad = (k: number) => {
          const a = deformed[k]!;
          const b = deformed[k + 1]!;
          const ax = a?.x ?? 0;
          const ay = a?.y ?? 0;
          const bx = b?.x ?? ax;
          const by = b?.y ?? ay;
          const tx = bx - ax;
          const ty = by - ay;
          const len = Math.hypot(tx, ty) || 1;
          const ux = tx / len;
          const uy = ty / len;
          const nx = -uy;
          const ny = ux;
          const aCapX = ax - ux * epsilon;
          const aCapY = ay - uy * epsilon;
          const bCapX = bx + ux * epsilon;
          const bCapY = by + uy * epsilon;
          const wa = (a?.width ?? 0) * 0.5;
          const wb = (b?.width ?? 0) * 0.5;
          const aLx = aCapX + nx * wa;
          const aLy = aCapY + ny * wa;
          const aRx = aCapX - nx * wa;
          const aRy = aCapY - ny * wa;
          const bLx = bCapX + nx * wb;
          const bLy = bCapY + ny * wb;
          const bRx = bCapX - nx * wb;
          const bRy = bCapY - ny * wb;
          if (winding === "CW") {
            quadVerts[0]!.x = aRx;
            quadVerts[0]!.y = aRy;
            quadVerts[1]!.x = bRx;
            quadVerts[1]!.y = bRy;
            quadVerts[2]!.x = bLx;
            quadVerts[2]!.y = bLy;
            quadVerts[3]!.x = aLx;
            quadVerts[3]!.y = aLy;
          } else {
            quadVerts[0]!.x = aLx;
            quadVerts[0]!.y = aLy;
            quadVerts[1]!.x = bLx;
            quadVerts[1]!.y = bLy;
            quadVerts[2]!.x = bRx;
            quadVerts[2]!.y = bRy;
            quadVerts[3]!.x = aRx;
            quadVerts[3]!.y = aRy;
          }
        };

        const sampleVertices = (() => {
          let lastSampleTime = -1;
          const UPDATE_INTERVAL_MS = 32; // Оновлюємо анімацію кожні 32ms (~30 FPS)

          return () => {
            const now = getTentacleTimeMs();
            if (now - lastSampleTime < UPDATE_INTERVAL_MS) {
              return quadVerts; // Повертаємо ті самі вершини без перерахунку
            }
            lastSampleTime = now;
            deformSpine(now);
            buildQuad(segIndex);
            return quadVerts;
          };
        })();

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
        const baseVertices = layer.vertices.map((v) => ({ x: v.x, y: v.y }));
        const center = baseVertices.reduce(
          (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }),
          { x: 0, y: 0 }
        );
        const invCount = baseVertices.length > 0 ? 1 / baseVertices.length : 0;
        center.x *= invCount;
        center.y *= invCount;
        const period = Math.max(1, Math.floor(animCfg.periodMs ?? 1500));
        const amplitude = animCfg.amplitude ?? 6;
        const phase = animCfg.phase ?? 0;
        const axis = animCfg.axis ?? "normal";
        const amplitudePercentage =
          typeof animCfg.amplitudePercentage === "number" &&
          Number.isFinite(animCfg.amplitudePercentage)
            ? animCfg.amplitudePercentage
            : undefined;
        const movementPerp =
          axis === "movement-tangent"
            ? { x: 0, y: 1 }
            : axis === "movement-normal"
            ? { x: -1, y: 0 }
            : null;

        const vertexCount = baseVertices.length;
        const baseX = new Float32Array(vertexCount);
        const baseY = new Float32Array(vertexCount);
        const normalX = new Float32Array(vertexCount);
        const normalY = new Float32Array(vertexCount);
        const tangentX = new Float32Array(vertexCount);
        const tangentY = new Float32Array(vertexCount);
        const normalMagnitude = new Float32Array(vertexCount);
        const tangentMagnitude = new Float32Array(vertexCount);
        for (let i = 0; i < vertexCount; i += 1) {
          const v = baseVertices[i]!;
          const dx = v.x - center.x;
          const dy = v.y - center.y;
          const radius = Math.hypot(dx, dy);
          const invRadius = radius > 1e-6 ? 1 / radius : 0;
          baseX[i] = v.x;
          baseY[i] = v.y;
          normalX[i] = dx * invRadius;
          normalY[i] = dy * invRadius;
          tangentX[i] = -normalY[i]!;
          tangentY[i] = normalX[i]!;
          normalMagnitude[i] =
            amplitudePercentage !== undefined ? radius * amplitudePercentage : amplitude;
          tangentMagnitude[i] = amplitude;
        }
        const deformed = baseVertices.map((v) => ({ x: v.x, y: v.y }));
        const moveToward = movementPerp ? new Float32Array(vertexCount) : null;
        const moveMagnitude = movementPerp ? new Float32Array(vertexCount) : null;
        if (movementPerp && moveToward && moveMagnitude) {
          for (let i = 0; i < vertexCount; i += 1) {
            const signedDist =
              baseX[i]! * movementPerp.x + baseY[i]! * movementPerp.y;
            moveToward[i] = -Math.sign(signedDist) || 0;
            moveMagnitude[i] =
              amplitudePercentage !== undefined
                ? Math.abs(signedDist) * amplitudePercentage
                : amplitude;
          }
        }
        const hasMovement = Boolean(movementPerp && moveToward && moveMagnitude);
        const sinPhaseStep = Math.sin(POLYGON_SWAY_PHASE_STEP);
        const cosPhaseStep = Math.cos(POLYGON_SWAY_PHASE_STEP);

        const sampleSway = (timeMs: number): SceneVector2[] => {
          if (vertexCount === 0) {
            return deformed;
          }
          const omega = TAU / period;
          const baseAngle = omega * timeMs + phase;
          const globalSin = Math.sin(baseAngle);
          const usesVertexPhase = !hasMovement;
          const sinStep = usesVertexPhase ? sinPhaseStep : 0;
          const cosStep = usesVertexPhase ? cosPhaseStep : 1;
          let sinValue = globalSin;
          let cosValue = Math.cos(baseAngle);
          for (let i = 0; i < vertexCount; i += 1) {
            const sinForVertex = usesVertexPhase ? sinValue : globalSin;
            if (movementPerp && moveToward && moveMagnitude && hasMovement) {
              const magnitude = moveMagnitude[i]! * sinForVertex * moveToward[i]!;
              deformed[i]!.x = baseX[i]! + movementPerp.x * magnitude;
              deformed[i]!.y = baseY[i]! + movementPerp.y * magnitude;
            } else if (axis === "tangent") {
              const magnitude = tangentMagnitude[i]! * sinForVertex;
              deformed[i]!.x = baseX[i]! + tangentX[i]! * magnitude;
              deformed[i]!.y = baseY[i]! + tangentY[i]! * magnitude;
            } else {
              const magnitude = normalMagnitude[i]! * sinForVertex;
              deformed[i]!.x = baseX[i]! + normalX[i]! * magnitude;
              deformed[i]!.y = baseY[i]! + normalY[i]! * magnitude;
            }
            if (usesVertexPhase) {
              const prevSin = sinValue;
              const prevCos = cosValue;
              sinValue = prevSin * cosStep + prevCos * sinStep;
              cosValue = prevCos * cosStep - prevSin * sinStep;
            }
          }
          return deformed;
        };

        const samplePulse = (timeMs: number): SceneVector2[] => {
          if (vertexCount === 0) {
            return deformed;
          }
          const omega = TAU / period;
          const baseAngle = omega * timeMs + phase;
          const sinStep = 0;
          const cosStep = 1;
          let sinValue = Math.sin(baseAngle);
          let cosValue = Math.cos(baseAngle);
          for (let i = 0; i < vertexCount; i += 1) {
            const s = sinValue;
            if (movementPerp && moveToward && moveMagnitude) {
              const magnitude = moveMagnitude[i]! * s * moveToward[i]!;
              deformed[i]!.x = baseX[i]! + movementPerp.x * magnitude;
              deformed[i]!.y = baseY[i]! + movementPerp.y * magnitude;
            } else if (axis === "tangent") {
              const magnitude = amplitude * s;
              deformed[i]!.x = baseX[i]! + tangentX[i]! * magnitude;
              deformed[i]!.y = baseY[i]! + tangentY[i]! * magnitude;
            } else {
              const magnitude = amplitude * s;
              deformed[i]!.x = baseX[i]! + normalX[i]! * magnitude;
              deformed[i]!.y = baseY[i]! + normalY[i]! * magnitude;
            }
            if (sinStep !== 0) {
              const prevSin = sinValue;
              const prevCos = cosValue;
              sinValue = prevSin * cosStep + prevCos * sinStep;
              cosValue = prevCos * cosStep - prevSin * sinStep;
            }
          }
          return deformed;
        };

        const getDeformedVertices = (() => {
          const UPDATE_INTERVAL_MS = 32; // Оновлюємо анімацію кожні 32ms (~30 FPS)
          let lastUpdateTime = -1;
          return () => {
            const now = getTentacleTimeMs();
            if (now - lastUpdateTime < UPDATE_INTERVAL_MS) {
              return deformed; // Повертаємо закешовані вершини
            }
            lastUpdateTime = now;
            if (animCfg.type === "sway") {
              sampleSway(now);
            } else {
              samplePulse(now);
            }
            return deformed;
          };
        })();

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
