/**
 * Bridge between game logic and GPU bullet renderer.
 * Allows logic modules to spawn/update/remove GPU-rendered bullets
 * without directly depending on rendering code.
 */

import type { SceneVector2, SceneColor } from "./SceneObjectManager";

// ============================================================================
// Types (mirrored from BulletGpuRenderer for loose coupling)
// ============================================================================

export type BulletShape = "circle" | "sprite";

export interface BulletVisualConfig {
  readonly visualKey: string;
  readonly bodyColor: SceneColor;
  readonly tailStartColor: SceneColor;
  readonly tailEndColor: SceneColor;
  readonly tailLengthMultiplier: number;
  readonly tailWidthMultiplier: number;
  /** Tail offset along movement axis (positive = forward, negative = backward) */
  readonly tailOffsetMultiplier?: number;
  readonly shape: BulletShape;
  /** If set, body uses radial gradient from center to edge */
  readonly centerColor?: SceneColor;
  readonly edgeColor?: SceneColor;
  /** Sprite index for shape === "sprite" */
  readonly spriteIndex?: number;
}

export interface BulletSlotHandle {
  readonly visualKey: string;
  readonly slotIndex: number;
}

// ============================================================================
// Bridge Interface
// ============================================================================

type AcquireSlotFn = (config: BulletVisualConfig) => BulletSlotHandle | null;
type UpdateSlotFn = (
  handle: BulletSlotHandle,
  position: SceneVector2,
  rotation: number,
  radius: number,
  active: boolean
) => void;
type ReleaseSlotFn = (handle: BulletSlotHandle) => void;
type CreateConfigFn = (
  visualKey: string,
  overrides?: Partial<Omit<BulletVisualConfig, "visualKey">>
) => BulletVisualConfig;

interface BulletRenderBridge {
  acquireSlot: AcquireSlotFn;
  updateSlot: UpdateSlotFn;
  releaseSlot: ReleaseSlotFn;
  createConfig: CreateConfigFn;
}

// ============================================================================
// Default no-op implementation (before renderer is connected)
// ============================================================================

const noopAcquire: AcquireSlotFn = () => null;
const noopUpdate: UpdateSlotFn = () => {};
const noopRelease: ReleaseSlotFn = () => {};
const defaultConfig: BulletVisualConfig = {
  visualKey: "default",
  bodyColor: { r: 0.4, g: 0.6, b: 1.0, a: 1.0 },
  tailStartColor: { r: 0.25, g: 0.45, b: 1.0, a: 0.65 },
  tailEndColor: { r: 0.05, g: 0.15, b: 0.6, a: 0.0 },
  tailLengthMultiplier: 4.5,
  tailWidthMultiplier: 1.75,
  shape: "circle",
};
const defaultCreateConfig: CreateConfigFn = (visualKey, overrides) => ({
  ...defaultConfig,
  ...overrides,
  visualKey,
});

// ============================================================================
// Global bridge instance
// ============================================================================

let bridge: BulletRenderBridge = {
  acquireSlot: noopAcquire,
  updateSlot: noopUpdate,
  releaseSlot: noopRelease,
  createConfig: defaultCreateConfig,
};

/**
 * Sets the bridge implementation. Called by renderer on initialization.
 */
export const setBulletRenderBridge = (impl: BulletRenderBridge | null): void => {
  bridge = impl ?? {
    acquireSlot: noopAcquire,
    updateSlot: noopUpdate,
    releaseSlot: noopRelease,
    createConfig: defaultCreateConfig,
  };
};

/**
 * Acquires a GPU slot for a new bullet.
 */
export const acquireGpuBulletSlot = (config: BulletVisualConfig): BulletSlotHandle | null => {
  return bridge.acquireSlot(config);
};

/**
 * Updates a bullet's GPU state.
 */
export const updateGpuBulletSlot = (
  handle: BulletSlotHandle,
  position: SceneVector2,
  rotation: number,
  radius: number,
  active: boolean
): void => {
  bridge.updateSlot(handle, position, rotation, radius, active);
};

/**
 * Releases a bullet slot back to the GPU pool.
 */
export const releaseGpuBulletSlot = (handle: BulletSlotHandle): void => {
  bridge.releaseSlot(handle);
};

/**
 * Creates a visual config for a bullet type.
 */
export const createGpuBulletConfig = (
  visualKey: string,
  overrides?: Partial<Omit<BulletVisualConfig, "visualKey">>
): BulletVisualConfig => {
  return bridge.createConfig(visualKey, overrides);
};

// ============================================================================
// Predefined visual configs for common bullet types
// ============================================================================

/** Sprite indices - must match SPRITE_PATHS order in BulletGpuRenderer */
export const BULLET_SPRITE_INDEX = {
  needle: 0,
} as const;

export const GPU_BULLET_CONFIGS = {
  default: (): BulletVisualConfig => createGpuBulletConfig("default"),
  
  ice: (): BulletVisualConfig => createGpuBulletConfig("ice", {
    bodyColor: { r: 0.6, g: 0.85, b: 1.0, a: 1.0 },
    tailStartColor: { r: 0.5, g: 0.8, b: 1.0, a: 0.7 },
    tailEndColor: { r: 0.3, g: 0.6, b: 0.9, a: 0.0 },
  }),
  
  fire: (): BulletVisualConfig => createGpuBulletConfig("fire", {
    bodyColor: { r: 1.0, g: 0.6, b: 0.2, a: 1.0 },
    tailStartColor: { r: 1.0, g: 0.4, b: 0.1, a: 0.8 },
    tailEndColor: { r: 0.8, g: 0.2, b: 0.0, a: 0.0 },
  }),
  
  needle: (): BulletVisualConfig => createGpuBulletConfig("needle", {
    bodyColor: { r: 0.7, g: 0.85, b: 0.95, a: 1.0 },
    tailStartColor: { r: 0.5, g: 0.7, b: 0.9, a: 0.6 },
    tailEndColor: { r: 0.3, g: 0.5, b: 0.8, a: 0.0 },
    tailLengthMultiplier: 3.0,
    tailWidthMultiplier: 1.2,
    shape: "sprite",
    spriteIndex: BULLET_SPRITE_INDEX.needle,
  }),
};

