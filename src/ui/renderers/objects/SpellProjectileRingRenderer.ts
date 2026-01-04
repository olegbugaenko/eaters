import { ObjectRenderer, ObjectRegistration } from "./ObjectRenderer";
import {
  SceneColor,
  SceneFill,
  SceneObjectInstance,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
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

// ============================================================================
// OPTIMIZATION: Cache fill objects per instance to avoid GC pressure
// ============================================================================

interface CachedFill {
  fill: SceneFill;
  stops: Array<{ offset: number; color: SceneColor }>;
  colors: SceneColor[];
}

const fillCache = new WeakMap<SceneObjectInstance, CachedFill>();

const getOrCreateCachedFill = (instance: SceneObjectInstance): CachedFill => {
  const existing = fillCache.get(instance);
  if (existing) return existing;
  
  // Create reusable fill structure - objects will be mutated in place
  const c0: SceneColor = { r: 1, g: 1, b: 1, a: 0 };
  const c1: SceneColor = { r: 1, g: 1, b: 1, a: 0 };
  const c2: SceneColor = { r: 1, g: 1, b: 1, a: 0 };
  const c3: SceneColor = { r: 1, g: 1, b: 1, a: 0 };
  const c4: SceneColor = { r: 1, g: 1, b: 1, a: 0 };
  const colors: SceneColor[] = [c0, c1, c2, c3, c4];
  const stops: Array<{ offset: number; color: SceneColor }> = [
    { offset: 0, color: c0 },
    { offset: 0.4, color: c1 },
    { offset: 0.7, color: c2 },
    { offset: 0.85, color: c3 },
    { offset: 1, color: c4 },
  ];
  const fill: SceneFill = {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    end: 10,
    stops,
  };
  
  const cached: CachedFill = { fill, stops, colors };
  fillCache.set(instance, cached);
  return cached;
};

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
  const alpha = clamp01(lerp(startAlpha, endAlpha, progress));
  
  // Get cached fill and mutate in place - no new objects created
  const cached = getOrCreateCachedFill(instance);
  
  // Update radius
  (cached.fill as any).end = radius;
  
  // Update stops offsets
  cached.stops[1]!.offset = innerStop;
  cached.stops[2]!.offset = outerStop;
  cached.stops[3]!.offset = outerFadeStop;
  
  // Update colors in place
  const c = cached.colors;
  c[0]!.r = color.r; c[0]!.g = color.g; c[0]!.b = color.b; c[0]!.a = 0;
  c[1]!.r = color.r; c[1]!.g = color.g; c[1]!.b = color.b; c[1]!.a = 0;
  c[2]!.r = color.r; c[2]!.g = color.g; c[2]!.b = color.b; c[2]!.a = alpha;
  c[3]!.r = color.r; c[3]!.g = color.g; c[3]!.b = color.b; c[3]!.a = 0;
  c[4]!.r = color.r; c[4]!.g = color.g; c[4]!.b = color.b; c[4]!.a = 0;
  
  return cached.fill;
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
