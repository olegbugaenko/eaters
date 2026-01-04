import { whirlGpuRenderer, type WhirlInstance } from "../../../primitives/gpu/WhirlGpuRenderer";
import { type WhirlSlotHandle } from "../../../primitives/gpu/WhirlGpuRenderer";
import { MAX_INTERPOLATION_TIME_MS } from "./constants";
import type { InterpolationData } from "./types";

/**
 * Computes interpolated state and writes it to the batch
 */
export const computeInterpolatedState = (
  handle: WhirlSlotHandle,
  data: InterpolationData
): Float32Array | null => {
  const currentTime = performance.now();
  const timeSinceUpdate =
    Math.max(0, Math.min(currentTime - data.lastUpdateTime, MAX_INTERPOLATION_TIME_MS)) / 1000; // Clamp to max 200ms

  // Інтерполяція позиції
  const position = {
    x: data.basePosition.x + data.velocity.x * timeSinceUpdate,
    y: data.basePosition.y + data.velocity.y * timeSinceUpdate,
  };

  // Інтерполяція phase (обертання)
  const interpolatedPhase = data.phase + data.spinSpeed * timeSinceUpdate;

  const instance: WhirlInstance = {
    position,
    radius: data.radius,
    phase: interpolatedPhase,
    intensity: data.intensity,
    active: true,
    rotationSpeedMultiplier: data.rotationSpeedMultiplier,
    spiralArms: data.spiralArms,
    spiralArms2: data.spiralArms2,
    spiralTwist: data.spiralTwist,
    spiralTwist2: data.spiralTwist2,
    colorInner: data.colorInner,
    colorMid: data.colorMid,
    colorOuter: data.colorOuter,
  };

  whirlGpuRenderer.updateSlot(handle, instance);

  // Завжди повертаємо дані, щоб примусити рендерер оновлюватися на кожному кадрі
  return new Float32Array(0);
};
