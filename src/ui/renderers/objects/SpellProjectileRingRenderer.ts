import { ObjectRenderer, ObjectRegistration } from "./ObjectRenderer";
import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneObjectInstance,
} from "../../../logic/services/SceneObjectManager";
import { createDynamicCirclePrimitive } from "../primitives";

const RING_SEGMENT_COUNT = 48;

interface AnimatedRingCustomData {
  createdAt?: number;
  lifetimeMs?: number;
  startRadius?: number;
  endRadius?: number;
  startAlpha?: number;
  endAlpha?: number;
  innerStop?: number;
  outerStop?: number;
  outerFadeStop?: number;
  color?: SceneColor;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const clamp01 = (value: number): number => {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

const getNow = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const getAnimationProgress = (data: AnimatedRingCustomData): number => {
  const now = getNow();
  const elapsed = now - (data.createdAt ?? now);
  const lifetime = Math.max(1, data.lifetimeMs ?? 1000);
  return clamp01(elapsed / lifetime);
};

const getAnimatedRingFill = (instance: SceneObjectInstance): SceneFill => {
  const data = instance.data.customData as AnimatedRingCustomData | undefined;
  
  // If no animation data, return original fill
  if (!data || typeof data.createdAt !== "number") {
    return instance.data.fill;
  }
  
  const progress = getAnimationProgress(data);
  
  const startRadius = data.startRadius ?? 10;
  const endRadius = data.endRadius ?? startRadius * 2;
  const startAlpha = data.startAlpha ?? 0.5;
  const endAlpha = data.endAlpha ?? 0;
  const innerStop = data.innerStop ?? 0.4;
  const outerStop = data.outerStop ?? 0.7;
  const outerFadeStop = data.outerFadeStop ?? Math.min(1, outerStop + 0.15);
  const color = data.color ?? { r: 1, g: 1, b: 1, a: 1 };
  
  const radius = lerp(startRadius, endRadius, progress);
  const alpha = lerp(startAlpha, endAlpha, progress);
  
  return {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    end: radius,
    stops: [
      { offset: 0, color: { ...color, a: 0 } },
      { offset: innerStop, color: { ...color, a: 0 } },
      { offset: outerStop, color: { ...color, a: clamp01(alpha) } },
      { offset: outerFadeStop, color: { ...color, a: 0 } },
      { offset: 1, color: { ...color, a: 0 } },
    ],
  };
};

const getAnimatedRingRadius = (
  instance: SceneObjectInstance,
  fallback: number
): number => {
  const data = instance.data.customData as AnimatedRingCustomData | undefined;
  
  // If no animation data, return fallback
  if (!data || typeof data.createdAt !== "number") {
    return fallback;
  }
  
  const progress = getAnimationProgress(data);
  const startRadius = data.startRadius ?? fallback;
  const endRadius = data.endRadius ?? startRadius * 2;
  
  return lerp(startRadius, endRadius, progress);
};

export class SpellProjectileRingRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    return {
      staticPrimitives: [],
      dynamicPrimitives: [
        createDynamicCirclePrimitive(instance, {
          segments: RING_SEGMENT_COUNT,
          getFill: getAnimatedRingFill,
          getRadius: getAnimatedRingRadius,
        }),
      ],
    };
  }
}
