import type { SceneGradientStop } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

export const PLASMOID_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 0.75, b: 0.3, a: 0.8 } },
  { offset: 0.35, color: { r: 1, g: 0.45, b: 0.15, a: 0.55 } },
  { offset: 1, color: { r: 1, g: 0.1, b: 0, a: 0 } },
] as const;

export const GREY_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.6, g: 0.75, b: 0.75, a: 0.8 } },
  { offset: 0.35, color: { r: 0.6, g: 0.75, b: 0.75, a: 0.55 } },
  { offset: 1, color: { r: 0.6, g: 0.75, b: 0.75, a: 0 } },
] as const;

export const MAGNETIC_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.6, g: 0.4, b: 1, a: 0.85 } },
  { offset: 0.45, color: { r: 0.45, g: 0.2, b: 0.95, a: 0.6 } },
  { offset: 1, color: { r: 0.25, g: 0.05, b: 0.7, a: 0 } },
] as const;

export const GRAY_BRICK_HIT_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.92, g: 0.92, b: 0.94, a: 0.3 } },
  { offset: 0.4, color: { r: 0.75, g: 0.77, b: 0.8, a: 0.6 } },
  { offset: 1, color: { r: 0.55, g: 0.58, b: 0.6, a: 0 } },
] as const;

export const GRAY_BRICK_DESTROY_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.95, g: 0.95, b: 0.97, a: 0.5 } },
  { offset: 0.35, color: { r: 0.78, g: 0.8, b: 0.84, a: 0.8 } },
  { offset: 1, color: { r: 0.45, g: 0.48, b: 0.52, a: 0 } },
] as const;

export const CRITICAL_HIT_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 0.35, b: 0.35, a: 0.5 } },
  { offset: 0.4, color: { r: 0.9, g: 0.12, b: 0.12, a: 0.8 } },
  { offset: 1, color: { r: 0.55, g: 0, b: 0, a: 0 } },
] as const;

export const HEAL_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.55, g: 1.0, b: 0.65, a: 0.5 } },
  { offset: 0.4, color: { r: 0.35, g: 0.9, b: 0.45, a: 0.8 } },
  { offset: 1, color: { r: 0.1, g: 0.6, b: 0.15, a: 0 } },
] as const;

export const WEAKEN_CURSE_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.4, g: 0.1, b: 0.5, a: 0.2 } },
  { offset: 0.35, color: { r: 0.45, g: 0.15, b: 0.55, a: 0.5 } },
  { offset: 0.75, color: { r: 0.5, g: 0.2, b: 0.6, a: 0.7 } },
  { offset: 1, color: { r: 0.45, g: 0.25, b: 0.5, a: 0.0 } },
] as const;

// Color-themed waves for non-gray bricks
export const YELLOW_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.95, g: 0.92, b: 0.55, a: 0.3 } },
  { offset: 0.4, color: { r: 0.85, g: 0.8, b: 0.35, a: 0.5 } },
  { offset: 1, color: { r: 0.65, g: 0.6, b: 0.2, a: 0 } },
] as const;
export const YELLOW_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 0.95, b: 0.6, a: 0.5 } },
  { offset: 0.35, color: { r: 0.9, g: 0.82, b: 0.4, a: 0.8 } },
  { offset: 1, color: { r: 0.7, g: 0.6, b: 0.25, a: 0 } },
] as const;

export const GREEN_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.6, g: 0.95, b: 0.65, a: 0.15 } },
  { offset: 0.4, color: { r: 0.35, g: 0.85, b: 0.45, a: 0.4 } },
  { offset: 1, color: { r: 0.1, g: 0.55, b: 0.15, a: 0 } },
] as const;
export const GREEN_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.6, g: 1, b: 0.7, a: 0.3 } },
  { offset: 0.35, color: { r: 0.4, g: 0.9, b: 0.5, a: 0.5 } },
  { offset: 1, color: { r: 0.1, g: 0.6, b: 0.15, a: 0 } },
] as const;

export const ORANGE_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 0.8, b: 0.55, a: 0.3 } },
  { offset: 0.4, color: { r: 0.95, g: 0.55, b: 0.2, a: 0.5 } },
  { offset: 1, color: { r: 0.75, g: 0.35, b: 0.1, a: 0 } },
] as const;
export const ORANGE_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 0.85, b: 0.6, a: 0.5 } },
  { offset: 0.35, color: { r: 0.95, g: 0.6, b: 0.25, a: 0.8 } },
  { offset: 1, color: { r: 0.8, g: 0.4, b: 0.12, a: 0 } },
] as const;

export const BROWN_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.7, g: 0.5, b: 0.3, a: 0.3 } },
  { offset: 0.4, color: { r: 0.55, g: 0.4, b: 0.2, a: 0.5 } },
  { offset: 1, color: { r: 0.35, g: 0.25, b: 0.12, a: 0 } },
] as const;
export const BROWN_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.75, g: 0.55, b: 0.35, a: 0.5 } },
  { offset: 0.35, color: { r: 0.6, g: 0.45, b: 0.25, a: 0.8 } },
  { offset: 1, color: { r: 0.4, g: 0.3, b: 0.15, a: 0 } },
] as const;

export const SILVER_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.92, g: 0.93, b: 0.96, a: 0.3 } },
  { offset: 0.45, color: { r: 0.82, g: 0.83, b: 0.88, a: 0.5 } },
  { offset: 1, color: { r: 0.72, g: 0.73, b: 0.78, a: 0 } },
] as const;
export const SILVER_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1, g: 1, b: 1, a: 0.5 } },
  { offset: 0.45, color: { r: 0.85, g: 0.87, b: 0.9, a: 0.8 } },
  { offset: 1, color: { r: 0.75, g: 0.76, b: 0.8, a: 0 } },
] as const;

export const COAL_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.3, g: 0.3, b: 0.32, a: 0.3 } },
  { offset: 0.5, color: { r: 0.18, g: 0.18, b: 0.2, a: 0.5 } },
  { offset: 1, color: { r: 0.08, g: 0.08, b: 0.1, a: 0 } },
] as const;
export const COAL_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.36, g: 0.36, b: 0.38, a: 0.5 } },
  { offset: 0.5, color: { r: 0.22, g: 0.22, b: 0.25, a: 0.8 } },
  { offset: 1, color: { r: 0.1, g: 0.1, b: 0.12, a: 0 } },
] as const;

// Ice-themed waves (cool cyan/white)
export const ICE_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.7, g: 0.9, b: 1.0, a: 0.5 } },
  { offset: 0.45, color: { r: 0.55, g: 0.8, b: 1.0, a: 0.3 } },
  { offset: 1, color: { r: 0.35, g: 0.6, b: 0.9, a: 0 } },
] as const;
export const ICE_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.85, g: 0.95, b: 1.0, a: 0.65 } },
  { offset: 0.45, color: { r: 0.65, g: 0.85, b: 1.0, a: 0.4 } },
  { offset: 1, color: { r: 0.4, g: 0.7, b: 1.0, a: 0 } },
] as const;

// Magma-themed waves (hot orange/red)
export const MAGMA_BRICK_HIT_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1.0, g: 0.5, b: 0.15, a: 0.5 } },
  { offset: 0.45, color: { r: 0.9, g: 0.3, b: 0.1, a: 0.28 } },
  { offset: 1, color: { r: 0.7, g: 0.15, b: 0.05, a: 0 } },
] as const;
export const MAGMA_BRICK_DESTROY_WAVE: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 1.0, g: 0.65, b: 0.2, a: 0.68 } },
  { offset: 0.45, color: { r: 1.0, g: 0.45, b: 0.15, a: 0.4 } },
  { offset: 1, color: { r: 0.85, g: 0.25, b: 0.08, a: 0 } },
] as const;

export const SMALL_ENERGETIC_WAVE_GRADIENT_STOPS: readonly SceneGradientStop[] = [
  { offset: 0, color: { r: 0.5, g: 0.8, b: 0.8, a: 0.4 } },
  { offset: 0.75, color: { r: 0.4, g: 0.7, b: 0.6, a: 0.9 } },
  { offset: 1, color: { r: 0.4, g: 0.7, b: 0.6, a: 0 } },
] as const;
