import type {
  SceneObjectInstance,
  SceneColor,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { randomBetween, clamp } from "@shared/helpers/numbers.helper";
import type {
  BulletRendererCustomData,
} from "./types";
import {
  MIN_SPEED,
  DEFAULT_SPEED_FOR_TAIL_SCALE,
} from "./constants";

// Use sanitizeSceneColor for sanitization with fallback
// Use cloneSceneColor for simple cloning without fallback

/**
 * Gets render components configuration
 */
export const getRenderComponents = (instance: SceneObjectInstance) => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  const components = data?.renderComponents;
  // renderComponents lets callers (like GPU-driven projectiles that still need
  // CPU-only effects) selectively disable parts of the bullet without changing
  // its renderer type. By default everything renders unless explicitly turned off.
  return {
    body: components?.body !== false,
    tail: components?.tail !== false,
    glow: components?.glow !== false,
    emitters: components?.emitters !== false,
  };
};

/**
 * Gets tail scale based on bullet speed
 */
export const getTailScale = (instance: SceneObjectInstance): number => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  const speed =
    typeof data?.speed === "number" && Number.isFinite(data.speed)
      ? data.speed
      : (() => {
          const velocity =
            data?.velocity && typeof data.velocity === "object" ? data.velocity : null;
          if (!velocity) {
            return 0;
          }
          const { x, y } = velocity;
          return Math.hypot(x ?? 0, y ?? 0);
        })();

  if (speed <= MIN_SPEED) {
    return 0.8;
  }

  const maxSpeed =
    typeof data?.maxSpeed === "number" && Number.isFinite(data.maxSpeed)
      ? data.maxSpeed
      : undefined;

  if (maxSpeed && maxSpeed > MIN_SPEED) {
    return clamp(0.8, 1.8, speed / maxSpeed);
  }

  return clamp(0.8, 1.6, speed / DEFAULT_SPEED_FOR_TAIL_SCALE);
};

/**
 * Gets bullet radius from instance size
 */
export const getBulletRadius = (instance: SceneObjectInstance): number => {
  const size = instance.data.size;
  if (!size) {
    return 0;
  }
  return Math.max(size.width, size.height) / 2;
};

/**
 * Gets projectile movement rotation (used for tail/emitters)
 */
export const getMovementRotation = (instance: SceneObjectInstance): number => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  const rotation =
    typeof data?.movementRotation === "number" && Number.isFinite(data.movementRotation)
      ? data.movementRotation
      : instance.data.rotation;
  return typeof rotation === "number" && Number.isFinite(rotation) ? rotation : 0;
};

/**
 * Gets tail rotation (opposite of movement rotation).
 */
export const getTailRotation = (instance: SceneObjectInstance): number =>
  getMovementRotation(instance) + Math.PI;

/**
 * Gets projectile shape (circle or sprite)
 */
export const getProjectileShape = (instance: SceneObjectInstance): "circle" | "sprite" => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  return data?.shape ?? "circle";
};
