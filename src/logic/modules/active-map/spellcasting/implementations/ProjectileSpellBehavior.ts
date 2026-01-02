import { SceneObjectManager } from "../../../../services/scene-object-manager/SceneObjectManager";
import type { SceneVector2 } from "../../../../services/scene-object-manager/scene-object-manager.types";
import { BricksModule } from "../../bricks/bricks.module";
import {
  SpellBehavior,
  SpellCastContext,
  SpellCanCastContext,
  SpellBehaviorDependencies,
} from "../SpellBehavior";
import { SpellConfig } from "../../../../../db/spells-db";
import { BonusValueMap } from "../../../shared/bonuses/bonuses.module";
import type { BrickRuntimeState } from "../../bricks/bricks.types";
import type { ExplosionModule } from "../../../scene/explosion/explosion.module";
import type { ExplosionType } from "../../../../../db/explosions-db";
import { UnitProjectileController } from "../../projectiles/ProjectileController";
import type { UnitProjectileVisualConfig } from "../../projectiles/projectiles.types";
import type { ProjectileSpellData } from "./ProjectileSpellBehavior.types";
import { randomIntInclusive } from "@/utils/helpers/numbers";

const sanitizeAoe = (
  aoe: { radius: number; splash: number } | undefined,
): { radius: number; splash: number } | undefined => {
  if (!aoe || typeof aoe !== "object") return undefined;
  const radius = Math.max(0, Number(aoe.radius ?? 0));
  const splash = Math.max(0, Number(aoe.splash ?? 0));
  if (radius <= 0 || splash <= 0) return undefined;
  return { radius, splash };
};

export class ProjectileSpellBehavior implements SpellBehavior {
  public readonly spellType = "projectile" as const;

  private readonly scene: SceneObjectManager;
  private readonly bricks: BricksModule;
  private readonly explosions?: ExplosionModule;
  private readonly getSpellPowerMultiplier: () => number;
  private readonly projectiles: UnitProjectileController;

  // Track spell-specific data per projectile (damage, aoe, explosion)
  private readonly projectileData = new Map<string, ProjectileSpellData>();

  private spellPowerMultiplier = 1;

  constructor(dependencies: SpellBehaviorDependencies) {
    this.scene = dependencies.scene;
    this.bricks = dependencies.bricks;
    this.explosions = dependencies.explosions;
    this.projectiles = dependencies.projectiles;
    this.getSpellPowerMultiplier = dependencies.getSpellPowerMultiplier;
    this.spellPowerMultiplier = dependencies.getSpellPowerMultiplier();
  }

  public canCast(context: SpellCanCastContext): boolean {
    return (
      context.isUnlocked &&
      context.isMapActive &&
      context.cooldownRemainingMs <= 0
    );
  }

  public cast(context: SpellCastContext): boolean {
    if (context.config.type !== "projectile") {
      return false;
    }

    const config = context.config;
    const count = config.projectile.count ?? 1;
    const spreadAngle = (config.projectile.spreadAngle ?? 0) * (Math.PI / 180);
    const baseAngle = Math.atan2(context.direction.y, context.direction.x);

    for (let i = 0; i < count; i += 1) {
      // Розрахунок кута для кожного проджектайла
      let angle = baseAngle;
      if (count > 1) {
        const spreadRange = spreadAngle * 2;
        const stepAngle = spreadRange / Math.max(1, count - 1);
        angle = baseAngle - spreadAngle + stepAngle * i;
      }

      const direction: SceneVector2 = {
        x: Math.cos(angle),
        y: Math.sin(angle),
      };

      const origin = {
        x: context.origin.x + (config.projectile.spawnOffset?.x ?? 0),
        y: context.origin.y + (config.projectile.spawnOffset?.y ?? 0),
      };

      // Convert SpellProjectileConfig to UnitProjectileVisualConfig
      const visual: UnitProjectileVisualConfig = {
        radius: config.projectile.radius,
        speed: config.projectile.speed,
        lifetimeMs: Math.max(0, config.projectile.lifetimeMs),
        fill: config.projectile.fill,
        tail: config.projectile.tail,
        tailEmitter: config.projectile.tailEmitter,
        ringTrail: config.projectile.ringTrail,
        shape: config.projectile.shape ?? "circle",
        spriteName: config.projectile.spriteName,
      };

      const objectId = this.projectiles.spawn({
        origin,
        direction,
        damage: 0, // Will be calculated on hit
        rewardMultiplier: 1,
        armorPenetration: 0,
        visual,
        onHit: (hitContext) => {
          const data = this.projectileData.get(objectId);
          if (!data) return true;

          const baseDamage = randomIntInclusive(data.damage);
          const damage = Math.max(baseDamage * Math.max(data.damageMultiplier, 0), 0);
          this.bricks.applyDamage(hitContext.brickId, damage, direction);
          
          const aoe = data.aoe;
          if (aoe && aoe.radius > 0 && aoe.splash > 0 && damage > 0) {
            this.bricks.forEachBrickNear(hitContext.position, aoe.radius, (brick: BrickRuntimeState) => {
              if (brick.id === hitContext.brickId) return;
              this.bricks.applyDamage(brick.id, damage * aoe.splash, direction);
            });
          }
          
          // Вибух при влучанні
          if (data.explosion && this.explosions) {
            this.explosions.spawnExplosionByType(data.explosion, {
              position: { ...hitContext.position },
            });
          }
          
          this.projectileData.delete(objectId);
          return true;
        },
        onExpired: () => {
          this.projectileData.delete(objectId);
        },
      });

      // Store spell-specific data
      this.projectileData.set(objectId, {
        spellId: context.spellId,
        damage: config.damage,
        damageMultiplier: context.spellPowerMultiplier,
        aoe: sanitizeAoe(config.projectile.aoe),
        explosion: config.projectile.explosion,
      });
    }

    return true;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }
    this.projectiles.tick(deltaMs);
  }

  public clear(): void {
    this.projectiles.clear();
    this.projectileData.clear();
  }

  public cleanupExpired(): void {
    this.projectiles.cleanupExpired();
    // Clean up orphaned data entries
    const activeIds = new Set<string>();
    // Note: UnitProjectileController doesn't expose active IDs, so we'll clean up on next hit/expire
  }

  public onBonusValuesChanged(values: BonusValueMap): void {
    const raw = values["spell_power"];
    const sanitized = Number.isFinite(raw) ? Math.max(raw, 0) : 1;
    if (Math.abs(sanitized - this.spellPowerMultiplier) < 1e-6) {
      return;
    }
    this.spellPowerMultiplier = sanitized;
    // Update damage multiplier for all active projectiles
    this.projectileData.forEach((data) => {
      data.damageMultiplier = sanitized;
    });
  }

  public serializeState(): unknown {
    return null;
  }

  public deserializeState(_data: unknown): void {
    // Not implemented
  }
}
