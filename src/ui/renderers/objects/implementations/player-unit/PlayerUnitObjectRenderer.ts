import {
  DynamicPrimitive,
  DynamicPrimitiveUpdate,
  ObjectRegistration,
  ObjectRenderer,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import {
  createDynamicPolygonPrimitive,
  createParticleEmitterPrimitive,
} from "../../../primitives";
import { hasStroke, expandVerticesForStroke, createStrokeFill } from "@shared/helpers/stroke.helper";
import {
  extractRendererData,
} from "./helpers";
import { createCompositePrimitives } from "./composite-primitives.helpers";
import {
  getEmitterConfig,
  serializeEmitterConfig,
  getEmitterOrigin,
  createEmitterParticle,
} from "./emitter.helpers";
import {
  getAuraInstanceMap,
  getAuraLastPositionCache,
  getCurrentAuraBatch,
  writeAuraInstance,
} from "./aura.helpers";
import type { PlayerUnitEmitterRenderConfig } from "./types";

/**
 * Updates aura instances positions
 */
const updateAuraInstances = (instance: SceneObjectInstance): void => {
  const instanceId = instance.id;
  const auraInstanceMap = getAuraInstanceMap();
  const auraLastPositionCache = getAuraLastPositionCache();
  const slots = auraInstanceMap.get(instanceId);
  if (!slots || slots.length === 0) {
    return;
  }

  const position = instance.data.position;

  // OPTIMIZATION: Skip bufferSubData if position hasn't changed
  const lastPos = auraLastPositionCache.get(instanceId);
  if (lastPos && lastPos.x === position.x && lastPos.y === position.y) {
    return; // Position unchanged, GPU buffer already has correct data
  }

  const currentBatch = getCurrentAuraBatch();
  if (!currentBatch) {
    return;
  }

  // Update cache
  if (lastPos) {
    lastPos.x = position.x;
    lastPos.y = position.y;
  } else {
    auraLastPositionCache.set(instanceId, { x: position.x, y: position.y });
  }

  slots.forEach(({ slotIndex, auraConfig, basePhase }) => {
    writeAuraInstance(slotIndex, {
      position: { ...position },
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

  public override update(
    instance: SceneObjectInstance,
    registration: ObjectRegistration
  ): DynamicPrimitiveUpdate[] {
    // Оновлюємо позиції аур при зміні позиції юніта
    updateAuraInstances(instance);

    // Викликаємо стандартний update
    return super.update(instance, registration);
  }

  public override remove(
    instance: SceneObjectInstance,
    registration: ObjectRegistration
  ): void {
    // Видаляємо аури при видаленні юніта
    const instanceId = instance.id;
    const auraInstanceMap = getAuraInstanceMap();
    const slots = auraInstanceMap.get(instanceId);
    if (slots) {
      slots.forEach(({ slotIndex, auraConfig }) => {
        writeAuraInstance(slotIndex, {
          position: { x: 0, y: 0 },
          basePhase: 0,
          active: false,
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
      auraInstanceMap.delete(instanceId);
    }
    super.remove(instance, registration);
  }
}
