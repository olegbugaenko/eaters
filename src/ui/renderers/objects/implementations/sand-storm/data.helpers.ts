import type { SceneObjectInstance, SceneColor } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { getInstanceRenderPosition } from "../../ObjectRenderer";
import type { SandStormCustomData, InterpolationData } from "./types";
import {
  DEFAULT_COLOR_INNER,
  DEFAULT_COLOR_MID,
  DEFAULT_COLOR_OUTER,
  DEFAULT_ROTATION_SPEED_MULTIPLIER,
  DEFAULT_SPIRAL_ARMS,
  DEFAULT_SPIRAL_ARMS2,
  DEFAULT_SPIRAL_TWIST,
  DEFAULT_SPIRAL_TWIST2,
} from "./constants";

/**
 * Extracts and sanitizes custom data from instance
 */
export const extractCustomData = (
  instance: SceneObjectInstance
): {
  intensity: number;
  phase: number;
  velocity: { x: number; y: number };
  lastUpdateTime: number;
  spinSpeed: number;
  radius: number;
} => {
  const size = instance.data.size ?? { width: 0, height: 0 };
  const radius = Math.max(0, Math.max(size.width, size.height) / 2);
  const basePosition = { ...getInstanceRenderPosition(instance) };
  const custom = (instance.data.customData ?? {}) as SandStormCustomData;
  const intensityRaw = typeof custom.intensity === "number" ? custom.intensity : 0;
  const intensity = Math.min(Math.max(intensityRaw, 0), 1);
  const phase = typeof custom.phase === "number" ? custom.phase : 0;
  const velocity = custom.velocity ?? { x: 0, y: 0 };
  const lastUpdateTime =
    typeof custom.lastUpdateTime === "number" ? custom.lastUpdateTime : performance.now();
  const spinSpeed = typeof custom.spinSpeed === "number" ? custom.spinSpeed : 0;

  return {
    intensity,
    phase,
    velocity,
    lastUpdateTime,
    spinSpeed,
    radius,
  };
};

/**
 * Creates interpolation data from instance custom data
 */
export const createInterpolationData = (
  instance: SceneObjectInstance,
  basePosition: { x: number; y: number },
  velocity: { x: number; y: number },
  lastUpdateTime: number,
  phase: number,
  spinSpeed: number,
  radius: number,
  intensity: number
): InterpolationData => {
  const custom = (instance.data.customData ?? {}) as SandStormCustomData;

  return {
    basePosition: { ...basePosition },
    velocity: { ...velocity },
    lastUpdateTime,
    phase,
    spinSpeed,
    radius,
    intensity,
    rotationSpeedMultiplier:
      typeof custom.rotationSpeedMultiplier === "number"
        ? custom.rotationSpeedMultiplier
        : DEFAULT_ROTATION_SPEED_MULTIPLIER,
    spiralArms:
      typeof custom.spiralArms === "number" ? custom.spiralArms : DEFAULT_SPIRAL_ARMS,
    spiralArms2:
      typeof custom.spiralArms2 === "number" ? custom.spiralArms2 : DEFAULT_SPIRAL_ARMS2,
    spiralTwist:
      typeof custom.spiralTwist === "number" ? custom.spiralTwist : DEFAULT_SPIRAL_TWIST,
    spiralTwist2:
      typeof custom.spiralTwist2 === "number" ? custom.spiralTwist2 : DEFAULT_SPIRAL_TWIST2,
    colorInner: (() => {
      const c = custom.colorInner ?? {
        r: DEFAULT_COLOR_INNER[0],
        g: DEFAULT_COLOR_INNER[1],
        b: DEFAULT_COLOR_INNER[2],
        a: 1,
      };
      return [c.r, c.g, c.b];
    })(),
    colorMid: (() => {
      const c = custom.colorMid ?? {
        r: DEFAULT_COLOR_MID[0],
        g: DEFAULT_COLOR_MID[1],
        b: DEFAULT_COLOR_MID[2],
        a: 1,
      };
      return [c.r, c.g, c.b];
    })(),
    colorOuter: (() => {
      const c = custom.colorOuter ?? {
        r: DEFAULT_COLOR_OUTER[0],
        g: DEFAULT_COLOR_OUTER[1],
        b: DEFAULT_COLOR_OUTER[2],
        a: 1,
      };
      return [c.r, c.g, c.b];
    })(),
  };
};
