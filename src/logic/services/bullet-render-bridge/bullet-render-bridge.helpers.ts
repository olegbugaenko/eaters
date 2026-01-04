import type { BulletVisualConfig, CreateConfigFn } from "./bullet-render-bridge.types";
import { DEFAULT_BULLET_CONFIG } from "./bullet-render-bridge.const";

/**
 * Creates a default config factory function.
 */
export const createDefaultConfigFactory = (): CreateConfigFn => {
  return (visualKey, overrides) => ({
    ...DEFAULT_BULLET_CONFIG,
    ...overrides,
    visualKey,
  });
};
