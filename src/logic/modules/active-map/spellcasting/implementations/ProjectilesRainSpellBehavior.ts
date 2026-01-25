import {
  SpellBehavior,
  SpellBehaviorDependencies,
  SpellCanCastContext,
  SpellCastContext,
} from "../SpellBehavior";
import type {
  ProjectilesRainOrigin,
  SpellDamageConfig,
  SpellProjectilesRainConfig,
} from "../../../../../db/spells-db";
import type { SceneFill, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { BonusValueMap } from "../../../shared/bonuses/bonuses.types";
import { randomIntInclusive } from "@shared/helpers/numbers.helper";
import type { UnitProjectileController } from "../../projectiles/ProjectileController";
import type { DamageService } from "../../targeting/DamageService";
import type { TargetType } from "../../targeting/targeting.types";

interface ProjectilesRainInstance {
  spellId: string;
  center: SceneVector2;
  origin: ProjectilesRainOrigin;
  portalOrigin: SceneVector2;
  highlightId?: string;
  durationMs: number;
  elapsedMs: number;
  intervalMs: number;
  intervalAccumulatorMs: number;
  radius: number;
  damage: SpellDamageConfig;
  projectileConfig: SpellProjectilesRainConfig["projectile"];
  highlightFill?: SceneFill;
  damageMultiplier: number;
}

export class ProjectilesRainSpellBehavior implements SpellBehavior {
  public readonly spellType = "projectiles_rain" as const;

  private readonly projectiles: UnitProjectileController;
  private readonly damage: DamageService;
  private readonly getSpellPowerMultiplier: () => number;
  private readonly scene: SceneObjectManager;

  private instances: ProjectilesRainInstance[] = [];
  private spellPowerMultiplier = 1;

  constructor(dependencies: SpellBehaviorDependencies) {
    this.projectiles = dependencies.projectiles;
    this.damage = dependencies.damage;
    this.getSpellPowerMultiplier = dependencies.getSpellPowerMultiplier;
    this.scene = dependencies.scene;
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
    if (context.config.type !== "projectiles_rain") {
      return false;
    }
    const config = this.sanitizeConfig(context.config.projectilesRain);
    const highlightId = this.spawnHighlight(config, context.target);

    this.instances.push({
      spellId: context.spellId,
      center: { ...context.target },
      origin: config.origin,
      portalOrigin: { ...context.origin },
      highlightId,
      durationMs: config.durationMs,
      elapsedMs: 0,
      intervalMs: config.spawnIntervalMs,
      intervalAccumulatorMs: 0,
      radius: config.radius,
      damage: config.damage,
      projectileConfig: config.projectile,
      highlightFill: config.highlightArea?.fill,
      damageMultiplier: context.spellPowerMultiplier,
    });

    return true;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0 || this.instances.length === 0) {
      return;
    }

    const elapsed = Math.max(0, deltaMs);
    const survivors: ProjectilesRainInstance[] = [];

    for (const instance of this.instances) {
      instance.elapsedMs += elapsed;
      instance.intervalAccumulatorMs += elapsed;

      while (instance.intervalAccumulatorMs >= instance.intervalMs) {
        instance.intervalAccumulatorMs -= instance.intervalMs;
        this.spawnProjectile(instance);
      }

      if (instance.elapsedMs < instance.durationMs) {
        if (instance.highlightId) {
          this.scene.updateObject(instance.highlightId, {
            position: { ...instance.center },
            size: {
              width: instance.radius * 2,
              height: instance.radius * 2,
            },
            fill: instance.highlightFill,
          });
        }
        survivors.push(instance);
      } else if (instance.highlightId) {
        this.scene.removeObject(instance.highlightId);
      }
    }

    this.instances = survivors;
  }

  public clear(): void {
    for (const instance of this.instances) {
      if (instance.highlightId) {
        this.scene.removeObject(instance.highlightId);
      }
    }
    this.instances = [];
  }

  public cleanupExpired(): void {
    // No-op: rain instances are time-based and cleaned in tick
  }

  public onBonusValuesChanged(values: BonusValueMap): void {
    const raw = values["spell_power"];
    const sanitized = Number.isFinite(raw) ? Math.max(raw, 0) : 1;
    if (Math.abs(sanitized - this.spellPowerMultiplier) < 1e-6) {
      return;
    }
    this.spellPowerMultiplier = sanitized;
    for (const instance of this.instances) {
      instance.damageMultiplier = sanitized;
    }
  }

  public serializeState(): unknown {
    return null;
  }

  public deserializeState(_data: unknown): void {
    // Not implemented
  }

  private spawnProjectile(instance: ProjectilesRainInstance): void {
    const target = this.getRandomTargetInRadius(instance.center, instance.radius);
    const origin = this.resolveOrigin(
      instance.origin,
      instance.portalOrigin,
      instance.center,
      target,
    );
    const direction = this.normalizeDirection({
      x: target.x - origin.x,
      y: target.y - origin.y,
    });
    if (!direction) {
      return;
    }

    const damageMultiplier = Math.max(instance.damageMultiplier, 0);
    const targetTypes =
      instance.projectileConfig.targetTypes &&
      instance.projectileConfig.targetTypes.length > 0
        ? instance.projectileConfig.targetTypes
        : (["brick"] as TargetType[]);

    const objectId = this.projectiles.spawn({
      origin,
      direction,
      damage: 0,
      rewardMultiplier: 1,
      armorPenetration: 0,
      targetTypes,
      ignoreTargetsOnPath: instance.projectileConfig.ignoreTargetsOnPath ?? false,
      visual: {
        radius: instance.projectileConfig.radius,
        speed: instance.projectileConfig.speed,
        lifetimeMs: instance.projectileConfig.lifetimeMs,
        fill: instance.projectileConfig.fill,
        spawnOffset: instance.projectileConfig.spawnOffset,
        tail: instance.projectileConfig.tail,
        tailEmitter: instance.projectileConfig.tailEmitter,
        ringTrail: instance.projectileConfig.ringTrail,
        rotationSpinningDegPerSec:
          instance.projectileConfig.rotationSpinningDegPerSec,
        shape: instance.projectileConfig.shape ?? "circle",
        spriteName: instance.projectileConfig.spriteName,
        wander: instance.projectileConfig.wander,
      },
      onExpired: (position) => {
        const baseDamage = randomIntInclusive(instance.damage);
        const finalDamage = Math.max(baseDamage * damageMultiplier, 0);
        const aoe = instance.projectileConfig.aoe;
        if (!aoe || aoe.radius <= 0 || finalDamage <= 0) {
          return;
        }
        const splash = Math.max(aoe.splash, 0);
        const payload = {
          amount: finalDamage * splash,
          context: {
            source: { type: "spell", id: instance.spellId },
            attackType: "spell-projectiles-rain",
            tag: instance.spellId,
            baseDamage,
            modifiers: {
              spellPowerMultiplier: damageMultiplier,
            },
          },
          area: { radius: aoe.radius, types: targetTypes },
        };
        this.damage.applyAreaDamage(position, aoe.radius, finalDamage * splash, {
          direction,
          types: targetTypes,
          payload,
        });
      },
    });

    if (!objectId) {
      return;
    }
  }

  private sanitizeConfig(config: SpellProjectilesRainConfig): SpellProjectilesRainConfig {
    return {
      ...config,
      durationMs: Math.max(0, Math.floor(config.durationMs)),
      spawnIntervalMs: Math.max(1, Math.floor(config.spawnIntervalMs)),
      radius: Math.max(0, config.radius),
      damage: {
        min: Math.max(0, config.damage.min),
        max: Math.max(config.damage.max, config.damage.min),
      },
    };
  }

  private spawnHighlight(
    config: SpellProjectilesRainConfig,
    center: SceneVector2,
  ): string | undefined {
    if (!config.highlightArea?.fill) {
      return undefined;
    }
    return this.scene.addObject("spellAreaHighlight", {
      position: { ...center },
      size: { width: config.radius * 2, height: config.radius * 2 },
      fill: config.highlightArea.fill,
    });
  }

  private getRandomTargetInRadius(center: SceneVector2, radius: number): SceneVector2 {
    if (radius <= 0) {
      return { ...center };
    }
    const angle = Math.random() * Math.PI * 2;
    const magnitude = Math.sqrt(Math.random()) * radius;
    return {
      x: center.x + Math.cos(angle) * magnitude,
      y: center.y + Math.sin(angle) * magnitude,
    };
  }

  private resolveOrigin(
    origin: ProjectilesRainOrigin,
    portalOrigin: SceneVector2,
    castTarget: SceneVector2,
    selectedTarget: SceneVector2,
  ): SceneVector2 {
    switch (origin.type) {
      case "portal":
        return { ...portalOrigin };
      case "absolute":
        return { ...origin.position };
      case "corner": {
        return this.resolveCorner(this.scene.getMapSize(), origin.corner);
      }
      case "offset-from-target":
        return {
          x: castTarget.x + origin.offset.x,
          y: castTarget.y + origin.offset.y,
        };
      case "corner-with-target-delta": {
        const base =
          "cornerPosition" in origin
            ? origin.cornerPosition
            : this.resolveCorner(this.scene.getMapSize(), origin.corner);
        return {
          x: base.x + (selectedTarget.x - castTarget.x),
          y: base.y + (selectedTarget.y - castTarget.y),
        };
      }
      default:
        return { ...castTarget };
    }
  }

  private resolveCorner(
    mapSize: { width: number; height: number } | undefined,
    corner: "top-left" | "top-right" | "bottom-left" | "bottom-right",
  ): SceneVector2 {
    if (!mapSize) {
      return { x: 0, y: 0 };
    }
    switch (corner) {
      case "top-left":
        return { x: 0, y: 0 };
      case "top-right":
        return { x: mapSize.width, y: 0 };
      case "bottom-left":
        return { x: 0, y: mapSize.height };
      case "bottom-right":
        return { x: mapSize.width, y: mapSize.height };
    }
  }

  private normalizeDirection(vector: SceneVector2): SceneVector2 | null {
    const length = Math.hypot(vector.x, vector.y);
    if (!Number.isFinite(length) || length <= 0) {
      return null;
    }
    return { x: vector.x / length, y: vector.y / length };
  }
}
