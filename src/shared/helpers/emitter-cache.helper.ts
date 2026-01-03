import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";

/**
 * Cache entry for emitter configs
 */
export interface EmitterConfigCacheEntry<TSource, TConfig> {
  source: TSource | undefined;
  config: TConfig | null;
}

/**
 * Creates a cached getter function for emitter configs.
 * Uses WeakMap to cache configs per instance, invalidating when source changes.
 *
 * @param getSource - Function to extract source config from instance
 * @param sanitizeConfig - Function to sanitize source config to render config
 * @returns Cached getter function
 *
 * @example
 * ```typescript
 * const getEmitterConfig = createCachedEmitterConfigGetter(
 *   (instance) => (instance.data.customData as MyCustomData)?.emitter,
 *   (source) => sanitizeMyEmitterConfig(source)
 * );
 * ```
 */
export function createCachedEmitterConfigGetter<TSource, TConfig>(
  getSource: (instance: SceneObjectInstance) => TSource | undefined,
  sanitizeConfig: (source: TSource) => TConfig | null
): (instance: SceneObjectInstance) => TConfig | null {
  const cache = new WeakMap<SceneObjectInstance, EmitterConfigCacheEntry<TSource, TConfig>>();

  return (instance: SceneObjectInstance): TConfig | null => {
    const source = getSource(instance);

    // Return cached config if source hasn't changed
    const cached = cache.get(instance);
    if (cached && cached.source === source) {
      return cached.config;
    }

    // Sanitize and cache new config
    const config = source ? sanitizeConfig(source) : null;
    cache.set(instance, { source, config });

    return config;
  };
}
