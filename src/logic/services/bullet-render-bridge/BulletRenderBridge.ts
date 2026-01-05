/**
 * Bridge between game logic and GPU bullet renderer.
 * Allows logic modules to spawn/update/remove GPU-rendered bullets
 * without directly depending on rendering code.
 */

import type { SceneVector2 } from "../scene-object-manager/scene-object-manager.types";
import type {
  BulletVisualConfig,
  BulletSlotHandle,
  BulletRenderBridge,
  AcquireSlotFn,
  UpdateSlotFn,
  ReleaseSlotFn,
  CreateConfigFn,
} from "./bullet-render-bridge.types";
import { DEFAULT_BULLET_CONFIG } from "./bullet-render-bridge.const";
import { createDefaultConfigFactory } from "./bullet-render-bridge.helpers";
import { resolveBulletSpriteIndex } from "./bullet-sprites.helpers";

// ============================================================================
// Default no-op implementation (before renderer is connected)
// ============================================================================

const noopAcquire: AcquireSlotFn = () => null;
const noopUpdate: UpdateSlotFn = () => {};
const noopRelease: ReleaseSlotFn = () => {};
const defaultCreateConfig = createDefaultConfigFactory();

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
  const spriteIndex = overrides?.spriteName
    ? resolveBulletSpriteIndex(overrides.spriteName)
    : overrides?.spriteIndex;

  return bridge.createConfig(visualKey, {
    ...overrides,
    spriteIndex,
  });
};

// ============================================================================
// Predefined visual configs for common bullet types
// ============================================================================

/** Sprite indices - must match SPRITE_PATHS order in BulletGpuRenderer */
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

  fireball: (): BulletVisualConfig =>
    createGpuBulletConfig("fireball", {
      bodyColor: { r: 1.0, g: 0.78, b: 0.42, a: 1.0 },
      tailStartColor: { r: 1.0, g: 0.55, b: 0.18, a: 0.85 },
      tailEndColor: { r: 0.85, g: 0.25, b: 0.02, a: 0.1 },
      tailLengthMultiplier: 3.4,
      tailWidthMultiplier: 1.35,
      shape: "sprite",
      spriteName: "fireball",
    }),

  needle: (): BulletVisualConfig => createGpuBulletConfig("needle", {
    bodyColor: { r: 0.7, g: 0.85, b: 0.95, a: 1.0 },
    tailStartColor: { r: 0.5, g: 0.7, b: 0.9, a: 0.6 },
    tailEndColor: { r: 0.3, g: 0.5, b: 0.8, a: 0.0 },
    tailLengthMultiplier: 3.0,
    tailWidthMultiplier: 1.2,
    shape: "sprite",
    spriteName: "needle",
  }),
};

// Re-export types for backward compatibility
export type {
  BulletShape,
  BulletVisualConfig,
  BulletSlotHandle,
} from "./bullet-render-bridge.types";
export type { BulletSpriteName } from "./bullet-sprites.const";
