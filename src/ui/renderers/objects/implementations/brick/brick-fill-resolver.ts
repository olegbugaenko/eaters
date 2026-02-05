import type {
  SceneFill,
  SceneObjectInstance,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { BRICK_CRACK_VARIANTS_PER_STAGE } from "@logic/modules/active-map/bricks/bricks.const";
import { withCrackMask } from "@shared/helpers/scene-style.helper";
import { textureAtlasRegistry } from "@ui/renderers/textures/TextureAtlasRegistry";

type BrickCustomData = {
  damageStage?: number;
  crackVariant?: number;
  cracksEnabled?: boolean;
  crackDesat?: number;
  crackDarken?: number;
};

/**
 * Cache key components for brick fill.
 */
interface BrickFillCacheKey {
  damageStage: number;
  crackVariant: number;
  cracksEnabled: boolean;
  crackDesat: number;
  crackDarken: number;
}

const VARIANTS_PER_STAGE = Math.max(BRICK_CRACK_VARIANTS_PER_STAGE, 1);
const DEFAULT_CRACK_STRENGTH = 0.75;
const DEFAULT_CRACK_DESAT = 2.0;
const DEFAULT_CRACK_DARKEN = 0.5;

/**
 * Creates a cache key string from brick custom data.
 */
const getCacheKey = (key: BrickFillCacheKey): string =>
  `${key.damageStage}:${key.crackVariant}:${key.cracksEnabled}:${key.crackDesat}:${key.crackDarken}`;

/**
 * Extract brick fill parameters from instance.
 */
const extractBrickParams = (
  instance: SceneObjectInstance
): BrickFillCacheKey => {
  const customData = instance.data.customData as BrickCustomData | undefined;
  return {
    damageStage: customData?.damageStage ?? 0,
    crackVariant: customData?.crackVariant ?? 0,
    cracksEnabled: customData?.cracksEnabled !== false,
    crackDesat: customData?.crackDesat ?? DEFAULT_CRACK_DESAT,
    crackDarken: customData?.crackDarken ?? DEFAULT_CRACK_DARKEN,
  };
};

/**
 * Brick fill resolver with caching.
 * Handles crack overlays based on damage stage.
 */
export class BrickFillResolver {
  private readonly cache = new Map<string, Map<string, SceneFill>>();
  private readonly baseFillCache = new WeakMap<SceneFill, string>();
  private baseFillIdCounter = 0;

  /**
   * Get or create a unique ID for a base fill object.
   */
  private getBaseFillId(fill: SceneFill): string {
    let id = this.baseFillCache.get(fill);
    if (!id) {
      id = `bf${this.baseFillIdCounter++}`;
      this.baseFillCache.set(fill, id);
    }
    return id;
  }

  /**
   * Resolve the fill for a brick instance, applying crack overlay if needed.
   */
  public resolve(instance: SceneObjectInstance, fallbackFill?: SceneFill): SceneFill {
    const data = instance.data as { fillDirty?: boolean; colorDirty?: boolean };
    const canUseCache = !(data.fillDirty || data.colorDirty);

    const baseFill = instance.data.fill ?? fallbackFill;
    if (!baseFill) {
      return { fillType: 0, color: { r: 1, g: 1, b: 1, a: 1 } } as SceneFill;
    }

    const params = extractBrickParams(instance);

    // No cracks - return base fill directly
    if (!params.cracksEnabled || params.damageStage === 0) {
      return baseFill;
    }

    // Build cache key
    const baseFillId = this.getBaseFillId(baseFill);
    const paramsKey = getCacheKey(params);
    const fullKey = `${baseFillId}:${paramsKey}`;

    // Check cache
    if (canUseCache) {
      const instanceCache = this.cache.get(fullKey);
      if (instanceCache) {
        const cached = instanceCache.get(instance.id);
        if (cached) {
          return cached;
        }
      }
    }

    // Compute cracked fill
    const atlasId = textureAtlasRegistry.getAtlasIndex("cracks");
    const tileIndex = Math.max(params.damageStage - 1, 0) * VARIANTS_PER_STAGE + params.crackVariant;
    const result = withCrackMask(baseFill, {
      atlasId,
      tileIndex,
      strength: DEFAULT_CRACK_STRENGTH,
      desat: params.crackDesat,
      darken: params.crackDarken,
    });

    // Store in cache
    let instanceCache = this.cache.get(fullKey);
    if (!instanceCache) {
      instanceCache = new Map();
      this.cache.set(fullKey, instanceCache);
    }
    instanceCache.set(instance.id, result);

    return result;
  }
}

/**
 * Singleton instance for brick fill resolution.
 */
export const brickFillResolver = new BrickFillResolver();
