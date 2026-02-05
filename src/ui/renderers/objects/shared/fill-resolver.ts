import type { SceneFill, SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

type FillResolveFn<LayerFill> = (instance: SceneObjectInstance, fill: LayerFill) => SceneFill;

export class FillResolver<LayerFill extends object> {
  private readonly cache = new WeakMap<LayerFill, Map<string, SceneFill>>();

  public constructor(private readonly resolveFill: FillResolveFn<LayerFill>) {}

  public resolve(instance: SceneObjectInstance, fill: LayerFill): SceneFill {
    const data = instance.data as { fillDirty?: boolean; colorDirty?: boolean };
    const canUseCache = !(data.fillDirty || data.colorDirty);
    const cachedForFill = this.cache.get(fill);
    if (canUseCache && cachedForFill) {
      const cached = cachedForFill.get(instance.id);
      if (cached) {
        return cached;
      }
    }

    const resolved = this.resolveFill(instance, fill);
    const nextCache = cachedForFill ?? new Map<string, SceneFill>();
    nextCache.set(instance.id, resolved);
    if (!cachedForFill) {
      this.cache.set(fill, nextCache);
    }
    return resolved;
  }
}
