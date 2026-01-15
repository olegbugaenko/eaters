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
}

export interface AreaDamageOptions extends DamageApplicationOptions {
  readonly types?: readonly TargetType[];
  readonly explosionType?: string;
  readonly explosionRadius?: number;
  readonly excludeTargetIds?: readonly string[];
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
  ): void {
    if (radius < 0 || damage <= 0) {
      return;
    }

    const { explosionType, explosionRadius, ...damageOptions } = options;
    if (explosionType && this.explosions) {
      this.explosions.spawnExplosionByType(explosionType as never, {
        position: { ...position },
        initialRadius: Math.max(1, explosionRadius ?? radius),
      });
    }

    const filter = options.types?.length ? { types: options.types } : undefined;
    const excludedIds = options.excludeTargetIds?.length
      ? new Set(options.excludeTargetIds)
      : null;
    this.targeting.forEachTargetNear(
      position,
      radius,
      (target) => {
        if (excludedIds?.has(target.id)) {
          return;
        }
        this.applyDamageSnapshot(target, damage, damageOptions);
      },
      filter,
    );
  }

  private applyDamageSnapshot(
    target: TargetSnapshot,
    damage: number,
    options: DamageApplicationOptions,
  ): number {
    if (damage <= 0) {
      return 0;
    }

    if (target.type === "brick") {
      const result = this.bricks().applyDamage(target.id, damage, options.direction, {
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
        direction: options.direction,
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

  public applyStatusEffectDamage(
    target: { readonly type: TargetType; readonly id: string },
    damage: number,
    options: DamageApplicationOptions = {},
  ): number {
    const snapshot = this.targeting.getTargetById(target.id, { types: [target.type] });
    if (!snapshot) {
      return 0;
    }
    const combinedOptions: DamageApplicationOptions = {
      overTime: 1,
      skipKnockback: true,
      rewardMultiplier: 1,
      ...options,
    };
    return this.applyDamageSnapshot(snapshot, damage, combinedOptions);
  }
}
