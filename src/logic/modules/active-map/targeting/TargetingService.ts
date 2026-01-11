import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { TargetSnapshot, TargetingFilter, TargetingProvider } from "./targeting.types";

export class TargetingService {
  private readonly providers: TargetingProvider[] = [];

  public registerProvider(provider: TargetingProvider): void {
    if (this.providers.includes(provider)) {
      return;
    }
    this.providers.push(provider);
  }

  public getTargetById(id: string, filter?: TargetingFilter): TargetSnapshot | null {
    for (let i = 0; i < this.providers.length; i += 1) {
      const provider = this.providers[i]!;
      if (!this.providerMatchesFilter(provider, filter)) {
        continue;
      }
      const target = provider.getById(id);
      if (target && this.targetMatchesFilter(target, filter)) {
        return target;
      }
    }
    return null;
  }

  public findNearestTarget(
    position: SceneVector2,
    filter?: TargetingFilter,
  ): TargetSnapshot | null {
    let bestTarget: TargetSnapshot | null = null;
    let bestDistanceSq = Number.POSITIVE_INFINITY;
    this.providers.forEach((provider) => {
      if (!this.providerMatchesFilter(provider, filter)) {
        return;
      }
      const candidate = provider.findNearest(position, filter);
      if (!candidate || !this.targetMatchesFilter(candidate, filter)) {
        return;
      }
      const distanceSq = this.computeDistanceSq(candidate.position, position);
      if (!Number.isFinite(distanceSq)) {
        return;
      }
      if (!bestTarget || distanceSq < bestDistanceSq) {
        bestTarget = candidate;
        bestDistanceSq = distanceSq;
      }
    });
    return bestTarget;
  }

  public findTargetsNear(
    position: SceneVector2,
    radius: number,
    filter?: TargetingFilter,
  ): TargetSnapshot[] {
    if (radius < 0) {
      return [];
    }
    const results: TargetSnapshot[] = [];
    this.providers.forEach((provider) => {
      if (!this.providerMatchesFilter(provider, filter)) {
        return;
      }
      provider.findInRadius(position, radius, filter).forEach((target) => {
        if (this.targetMatchesFilter(target, filter)) {
          results.push(target);
        }
      });
    });
    return results;
  }

  public forEachTargetNear(
    position: SceneVector2,
    radius: number,
    visitor: (target: TargetSnapshot) => void,
    filter?: TargetingFilter,
  ): void {
    if (radius < 0) {
      return;
    }
    this.providers.forEach((provider) => {
      if (!this.providerMatchesFilter(provider, filter)) {
        return;
      }
      provider.forEachInRadius(position, radius, (target) => {
        if (this.targetMatchesFilter(target, filter)) {
          visitor(target);
        }
      }, filter);
    });
  }

  private computeDistanceSq(a: SceneVector2, b: SceneVector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  private providerMatchesFilter(provider: TargetingProvider, filter?: TargetingFilter): boolean {
    if (!filter?.types || filter.types.length === 0) {
      return true;
    }
    return provider.types.some((type) => filter.types?.includes(type));
  }

  private targetMatchesFilter(target: TargetSnapshot, filter?: TargetingFilter): boolean {
    if (!filter?.types || filter.types.length === 0) {
      return true;
    }
    return filter.types.includes(target.type);
  }
}
