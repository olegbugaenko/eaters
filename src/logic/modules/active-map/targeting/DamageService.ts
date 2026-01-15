import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import type { BricksModule } from "../bricks/bricks.module";
import type { EnemiesModule } from "../enemies/enemies.module";
import type { PlayerUnitsModule } from "../player-units/player-units.module";
import type { TargetSnapshot, TargetType } from "./targeting.types";
import { TargetingService } from "./TargetingService";

export interface DamageApplicationOptions {
  readonly direction?: SceneVector2;
  readonly rewardMultiplier?: number;
  readonly armorPenetration?: number;
  readonly overTime?: number;
  readonly skipKnockback?: boolean;
  readonly knockBackDistance?: number;
  readonly knockBackSpeed?: number;
  readonly knockBackDirection?: SceneVector2;
  readonly payload?: DamagePayload;
}

export interface AreaDamageOptions extends DamageApplicationOptions {
  readonly types?: readonly TargetType[];
  readonly explosionType?: string;
  readonly explosionRadius?: number;
  readonly excludeTargetIds?: readonly string[];
}

export interface DamageSource {
  readonly type: string;
  readonly id?: string;
}

export interface DamageContext {
  readonly source?: DamageSource;
  readonly sourceType?: string;
  readonly sourceId?: string;
  readonly effectId?: string;
  readonly attackType?: string;
  readonly tag?: string;
  readonly seriesId?: string;
  readonly direction?: SceneVector2;
  readonly baseDamage?: number;
  readonly modifiers?: Record<string, number>;
}

export interface DamageAreaSpec {
  readonly radius?: number;
  readonly types?: readonly TargetType[];
}

export interface DamageExplosionSpec {
  readonly type?: string;
  readonly radius?: number;
}

export interface DamagePayload {
  readonly amount: number;
  readonly context?: DamageContext;
  readonly area?: DamageAreaSpec;
  readonly explosion?: DamageExplosionSpec;
}

interface DamageServiceOptions {
  readonly bricks: () => BricksModule;
  readonly enemies?: () => EnemiesModule;
  readonly units?: () => Pick<PlayerUnitsModule, "applyDamage" | "findNearestUnit">;
  readonly explosions?: ExplosionModule;
  readonly targeting: TargetingService;
}

export class DamageService {
  private readonly bricks: DamageServiceOptions["bricks"];
  private readonly enemies?: DamageServiceOptions["enemies"];
  private readonly units?: DamageServiceOptions["units"];
  private readonly explosions?: DamageServiceOptions["explosions"];
  private readonly targeting: DamageServiceOptions["targeting"];

  constructor(options: DamageServiceOptions) {
    this.bricks = options.bricks;
    this.enemies = options.enemies;
    this.units = options.units;
    this.explosions = options.explosions;
    this.targeting = options.targeting;
  }

  public applyTargetDamage(
    targetId: string,
    damage: number,
    options: DamageApplicationOptions = {},
  ): number {
    const target = this.targeting.getTargetById(targetId);
    if (!target) {
      return 0;
    }
    return this.applyDamageSnapshot(target, damage, options);
  }

  public applyAreaDamage(
    position: SceneVector2,
    radius: number,
    damage: number,
    options: AreaDamageOptions = {},
  ): number {
    if (radius < 0) {
      return 0;
    }

    const payload = options.payload;
    const resolvedExplosionType = options.explosionType ?? payload?.explosion?.type;
    const resolvedExplosionRadius =
      options.explosionRadius ?? payload?.explosion?.radius ?? radius;
    if (resolvedExplosionType && this.explosions) {
      this.explosions.spawnExplosionByType(resolvedExplosionType as never, {
        position: { ...position },
        initialRadius: Math.max(1, resolvedExplosionRadius),
      });
    }

    if (damage <= 0) {
      return 0;
    }

    const targetTypes = options.types ?? payload?.area?.types;
    const filter = targetTypes?.length ? { types: targetTypes } : undefined;
    const excludedTargets = options.excludeTargetIds?.length
      ? new Set(options.excludeTargetIds)
      : null;
    let totalInflicted = 0;
    // console.log('POS: ', position, filter, radius, damage, options);
    this.targeting.forEachTargetNear(position, radius, (target) => {
      if (excludedTargets?.has(target.id)) {
        return;
      }
      totalInflicted += this.applyDamageSnapshot(target, damage, options);
    }, filter);
    return totalInflicted;
  }

  private applyDamageSnapshot(
    target: TargetSnapshot,
    damage: number,
    options: DamageApplicationOptions,
  ): number {
    if (damage <= 0) {
      return 0;
    }

    const direction = options.direction ?? options.payload?.context?.direction;
    if (target.type === "brick") {
      const result = this.bricks().applyDamage(target.id, damage, direction, {
        rewardMultiplier: options.rewardMultiplier,
        armorPenetration: options.armorPenetration,
        skipKnockback: options.skipKnockback,
        overTime: options.overTime,
      });
      return result.inflictedDamage;
    }

    const enemies = this.enemies?.();
    if (target.type === "enemy" && enemies) {
      return enemies.applyDamage(target.id, damage, {
        armorPenetration: options.armorPenetration,
        knockBackDirection: options.knockBackDirection,
        knockBackDistance: options.knockBackDistance,
        knockBackSpeed: options.knockBackSpeed,
        skipKnockback: options.skipKnockback,
        direction,
        rewardMultiplier: options.rewardMultiplier,
      });
    }

    const units = this.units?.();
    if (target.type === "unit" && units) {
      return units.applyDamage(target.id, damage, {
        armorPenetration: options.armorPenetration,
        knockBackDistance: options.knockBackDistance,
        knockBackSpeed: options.knockBackSpeed,
        knockBackDirection: options.knockBackDirection,
      });
    }

    return 0;
  }
}
