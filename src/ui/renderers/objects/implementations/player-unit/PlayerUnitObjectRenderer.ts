import {
  ObjectRenderer,
  ObjectRegistration,
  DynamicPrimitive,
  DynamicPrimitiveUpdate,
} from "../../ObjectRenderer";
import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import {
  createDynamicPolygonPrimitive,
  createDynamicPolygonStrokePrimitive,
} from "../../../primitives";
import { extractRendererData } from "./helpers";
import { hasStroke, expandVerticesForStroke, createStrokeFill } from "@shared/helpers/stroke.helper";
import {
  getEmitterConfig,
  getEmitterOrigin,
  serializeEmitterConfig,
  createEmitterParticle,
  getGpuSpawnConfig,
} from "./emitter.helpers";
import {
  getAuraInstanceMap,
  getAuraLastPositionCache,
  writeAuraInstance,
} from "./aura.helpers";
import { createCompositePrimitives } from "./composite-primitives.helpers";
import { createParticleEmitterPrimitive } from "../../../primitives/ParticleEmitterPrimitive";
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

  // Update cache
  if (lastPos) {
    lastPos.x = position.x;
    lastPos.y = position.y;
  } else {
    auraLastPositionCache.set(instanceId, { x: position.x, y: position.y });
  }

  slots.forEach(({ handle, auraConfig, basePhase }) => {
    writeAuraInstance(handle, {
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
): DynamicPrimitive | null => {
  const primitive = createParticleEmitterPrimitive<PlayerUnitEmitterRenderConfig>(instance, {
    getConfig: getEmitterConfig,
    getOrigin: getEmitterOrigin,
    spawnParticle: createEmitterParticle,
    serializeConfig: serializeEmitterConfig,
    getGpuSpawnConfig, // Enable GPU particle spawning (no CPU slot tracking!)
  });
  if (primitive) {
    // Enable auto-animation for particle emitter so it updates every render frame
    // This ensures smooth particle animation even when the unit itself is only updated on game loop ticks
    primitive.autoAnimate = true;
  }
  return primitive;
};

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
          // Відстежуємо зміни fill для візуальних ефектів (freeze, burn тощо)
          refreshFill: (target) => target.data.fill,
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
      const { petalAuraGpuRenderer } = require("../../../primitives/gpu/petal-aura");
      slots.forEach(({ handle }) => {
        petalAuraGpuRenderer.releaseSlot(handle);
      });
      auraInstanceMap.delete(instanceId);
      const auraLastPositionCache = getAuraLastPositionCache();
      auraLastPositionCache.delete(instanceId);
    }

    // Викликаємо стандартний remove
    super.remove(instance, registration);
  }
}
