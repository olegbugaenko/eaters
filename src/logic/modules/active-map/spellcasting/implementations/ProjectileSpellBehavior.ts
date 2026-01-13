import { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import { BricksModule } from "../../bricks/bricks.module";
import {
  SpellBehavior,
  SpellCastContext,
  SpellCanCastContext,
  SpellBehaviorDependencies,
} from "../SpellBehavior";
import { SpellConfig } from "../../../../../db/spells-db";
import type { BonusValueMap } from "../../../shared/bonuses/bonuses.types";
import type { BrickRuntimeState } from "../../bricks/bricks.types";
import type { ExplosionModule } from "../../../scene/explosion/explosion.module";
import type { ExplosionType } from "../../../../../db/explosions-db";
import { UnitProjectileController } from "../../projectiles/ProjectileController";
import type { UnitProjectileVisualConfig } from "../../projectiles/projectiles.types";
import type { ProjectileSpellData } from "./ProjectileSpellBehavior.types";
import { buildProjectileSpreadDirections } from "../../projectiles/projectile-spread.helpers";
import { clampNumber, randomIntInclusive } from "@shared/helpers/numbers.helper";
import type { SpellDamageConfig, SpellProjectileConfig } from "@/db/spells-db";
import type { AttackSeriesConfig } from "@/shared/types/attack-series.types";

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
  private readonly activeSeries: SpellProjectileSeriesState[] = [];

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
    const seriesConfig = this.sanitizeAttackSeries(config.projectile.attackSeries);

    this.spawnProjectileVolley(context, config.projectile, config.damage);

    if (seriesConfig && seriesConfig.shots > 1) {
      this.activeSeries.push({
        context,
        projectileConfig: config.projectile,
        damageConfig: config.damage,
        remainingShots: seriesConfig.shots - 1,
        cooldownMs: seriesConfig.intervalMs,
        intervalMs: seriesConfig.intervalMs,
      });
    }

    return true;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }
    this.tickAttackSeries(deltaMs);
    this.projectiles.tick(deltaMs);
  }

  public clear(): void {
    this.projectiles.clear();
    this.projectileData.clear();
    this.activeSeries.length = 0;
  }

  public cleanupExpired(): void {
    this.projectiles.cleanupExpired();
    // Clean up orphaned data entries
    const activeIds = new Set<string>();
    // Note: UnitProjectileController doesn't expose active IDs, so we'll clean up on next hit/expire
  }

  private spawnProjectileVolley(
    context: SpellCastContext,
    projectileConfig: SpellProjectileConfig,
    damageConfig: SpellDamageConfig,
  ): void {
    const count = projectileConfig.count ?? 1;
    const directions = buildProjectileSpreadDirections({
      count,
      spreadAngleDeg: projectileConfig.spreadAngle ?? 0,
      baseDirection: context.direction,
    });

    for (const direction of directions) {
      const origin = { ...context.origin };

      // Convert SpellProjectileConfig to UnitProjectileVisualConfig
      const visual: UnitProjectileVisualConfig = {
        radius: projectileConfig.radius,
        speed: projectileConfig.speed,
        lifetimeMs: Math.max(0, projectileConfig.lifetimeMs),
        fill: projectileConfig.fill,
        spawnOffset: projectileConfig.spawnOffset,
        tail: projectileConfig.tail,
        tailEmitter: projectileConfig.tailEmitter,
        ringTrail: projectileConfig.ringTrail,
        shape: projectileConfig.shape ?? "circle",
        spriteName: projectileConfig.spriteName,
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
          if (!hitContext.brickId) return true;

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
        damage: damageConfig,
        damageMultiplier: context.spellPowerMultiplier,
        aoe: sanitizeAoe(projectileConfig.aoe),
        explosion: projectileConfig.explosion,
      });
    }
  }

  private sanitizeAttackSeries(
    series: AttackSeriesConfig | undefined,
  ): AttackSeriesConfig | null {
    if (!series) {
      return null;
    }
    const shots = clampNumber(series.shots, 1, Number.POSITIVE_INFINITY);
    const intervalMs = clampNumber(series.intervalMs, 0, Number.POSITIVE_INFINITY);
    return { shots, intervalMs };
  }

  private tickAttackSeries(deltaMs: number): void {
    if (this.activeSeries.length === 0) {
      return;
    }
    const elapsed = Math.max(0, deltaMs);
    const survivors: SpellProjectileSeriesState[] = [];

    for (const entry of this.activeSeries) {
      entry.cooldownMs = Math.max(entry.cooldownMs - elapsed, 0);
      while (entry.remainingShots > 0 && entry.cooldownMs <= 0) {
        this.spawnProjectileVolley(
          entry.context,
          entry.projectileConfig,
          entry.damageConfig,
        );
        entry.remainingShots -= 1;
        entry.cooldownMs += entry.intervalMs;
      }
      if (entry.remainingShots > 0) {
        survivors.push(entry);
      }
    }

    this.activeSeries.splice(0, this.activeSeries.length, ...survivors);
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

interface SpellProjectileSeriesState {
  context: SpellCastContext;
  projectileConfig: SpellProjectileConfig;
  damageConfig: SpellDamageConfig;
  remainingShots: number;
  cooldownMs: number;
  intervalMs: number;
}
