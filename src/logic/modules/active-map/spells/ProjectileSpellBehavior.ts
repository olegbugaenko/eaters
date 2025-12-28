import { SceneObjectManager, SceneVector2, SceneColor, FILL_TYPES } from "../../../services/SceneObjectManager";
import { BricksModule } from "../BricksModule";
import {
  SpellBehavior,
  SpellCastContext,
  SpellCanCastContext,
  SpellBehaviorDependencies,
} from "./SpellBehavior";
import { SpellConfig, SpellProjectileRingTrailConfig } from "../../../../db/spells-db";
import { BonusValueMap } from "../../shared/BonusesModule";
import type { BrickRuntimeState } from "../BricksModule";
import type { ExplosionModule } from "../../scene/ExplosionModule";
import type { ExplosionType } from "../../../../db/explosions-db";
import { clampNumber } from "@/utils/helpers/numbers";

const MAX_PROJECTILE_STEPS_PER_TICK = 5;
const MIN_MOVEMENT_STEP = 2;
const OUT_OF_BOUNDS_MARGIN = 50;

interface ProjectileState {
  id: string;
  spellId: string;
  position: SceneVector2;
  velocity: SceneVector2;
  radius: number;
  elapsedMs: number;
  lifetimeMs: number;
  createdAt: number;
  direction: SceneVector2;
  damage: { min: number; max: number };
  ringTrail?: ProjectileRingTrailState;
  damageMultiplier: number;
  aoe?: { radius: number; splash: number };
  explosion?: ExplosionType;
}

interface ProjectileRingTrailState {
  config: ProjectileRingTrailRuntimeConfig;
  accumulatorMs: number;
}

interface ProjectileRingTrailRuntimeConfig
  extends Omit<SpellProjectileRingTrailConfig, "color"> {
  color: SceneColor;
}

interface RingState {
  id: string;
  position: SceneVector2;
  elapsedMs: number;
  createdAt: number; // For cleanup when tab becomes active
  lifetimeMs: number;
  startRadius: number;
  endRadius: number;
  startAlpha: number;
  endAlpha: number;
  innerStop: number;
  outerStop: number;
  outerFadeStop: number;
  color: SceneColor;
}

const clamp01 = (value: number): number => clampNumber(value, 0, 1);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp01(t);

const randomDamage = (config: { min: number; max: number }): number => {
  const min = Math.max(0, Math.floor(config.min));
  const max = Math.max(min, Math.floor(config.max));
  if (max <= min) {
    return min;
  }
  const range = max - min + 1;
  return min + Math.floor(Math.random() * range);
};

const sanitizeAoe = (
  aoe: { radius: number; splash: number } | undefined,
): { radius: number; splash: number } | undefined => {
  if (!aoe || typeof aoe !== "object") return undefined;
  const radius = Math.max(0, Number(aoe.radius ?? 0));
  const splash = Math.max(0, Number(aoe.splash ?? 0));
  if (radius <= 0 || splash <= 0) return undefined;
  return { radius, splash };
};

const createRingFill = (
  radius: number,
  alpha: number,
  params: {
    color: SceneColor;
    innerStop: number;
    outerStop: number;
    outerFadeStop: number;
  }
) => ({
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: radius,
  stops: [
    { offset: 0, color: { ...params.color, a: 0 } },
    { offset: params.innerStop, color: { ...params.color, a: 0 } },
    { offset: params.outerStop, color: { ...params.color, a: clamp01(alpha) } },
    { offset: params.outerFadeStop, color: { ...params.color, a: 0 } },
    { offset: 1, color: { ...params.color, a: 0 } },
  ],
});

export class ProjectileSpellBehavior implements SpellBehavior {
  public readonly spellType = "projectile" as const;

  private readonly scene: SceneObjectManager;
  private readonly bricks: BricksModule;
  private readonly explosions?: ExplosionModule;
  private readonly getSpellPowerMultiplier: () => number;

  private projectiles: ProjectileState[] = [];
  private rings: RingState[] = [];
  private spellPowerMultiplier = 1;

  constructor(dependencies: SpellBehaviorDependencies) {
    this.scene = dependencies.scene;
    this.bricks = dependencies.bricks;
    this.explosions = dependencies.explosions;
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
    const spreadAngle = (config.projectile.spreadAngle ?? 0) * (Math.PI / 180); // Конвертація градусів в радіани
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

      const velocity: SceneVector2 = {
        x: direction.x * config.projectile.speed,
        y: direction.y * config.projectile.speed,
      };

      const position = {
        x: context.origin.x + (config.projectile.spawnOffset?.x ?? 0),
        y: context.origin.y + (config.projectile.spawnOffset?.y ?? 0),
      };

      const objectId = this.scene.addObject("spellProjectile", {
        position: { ...position },
        size: { width: config.projectile.radius * 2, height: config.projectile.radius * 2 },
        rotation: angle,
        fill: config.projectile.fill,
        customData: {
          tail: config.projectile.tail,
        tailEmitter: config.projectile.tailEmitter,
        shape: config.projectile.shape ?? "circle",
      },
    });

    const createdAt = performance.now();
    const ringTrail = config.projectile.ringTrail
      ? this.createRingTrailState(config.projectile.ringTrail)
      : undefined;

    const projectileState: ProjectileState = {
        id: objectId,
        spellId: context.spellId,
      position: { ...position },
      velocity,
      radius: config.projectile.radius,
      elapsedMs: 0,
      lifetimeMs: Math.max(0, config.projectile.lifetimeMs),
      createdAt,
      direction: { ...direction },
      damage: config.damage,
      ringTrail,
      damageMultiplier: context.spellPowerMultiplier,
      aoe: sanitizeAoe(config.projectile.aoe),
        explosion: config.projectile.explosion,
      };

      this.projectiles.push(projectileState);

      if (ringTrail) {
        this.spawnProjectileRing(projectileState.position, ringTrail.config);
      }
    }

    return true;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }

    if (this.projectiles.length > 0) {
      const deltaSeconds = deltaMs / 1000;
      const mapSize = this.scene.getMapSize();

      let writeIndex = 0;
      for (let i = 0; i < this.projectiles.length; i += 1) {
        const projectile = this.projectiles[i]!;
        let hit = false;

        const totalMoveX = projectile.velocity.x * deltaSeconds;
        const totalMoveY = projectile.velocity.y * deltaSeconds;
        const distance = Math.hypot(totalMoveX, totalMoveY);
        const steps = Math.max(
          1,
          Math.min(
            MAX_PROJECTILE_STEPS_PER_TICK,
            Math.ceil(distance / Math.max(projectile.radius, MIN_MOVEMENT_STEP)),
          ),
        );
        const stepX = totalMoveX / steps;
        const stepY = totalMoveY / steps;

        for (let j = 0; j < steps; j += 1) {
          projectile.position.x += stepX;
          projectile.position.y += stepY;

          const collided = this.findHitBrick(projectile.position, projectile.radius);
          if (collided) {
            const baseDamage = randomDamage(projectile.damage);
            const damage = Math.max(baseDamage * Math.max(projectile.damageMultiplier, 0), 0);
            this.bricks.applyDamage(collided.id, damage, projectile.direction);
            const aoe = projectile.aoe;
            if (aoe && aoe.radius > 0 && aoe.splash > 0 && damage > 0) {
              this.bricks.forEachBrickNear(projectile.position, aoe.radius, (brick: BrickRuntimeState) => {
                if (brick.id === collided.id) return;
                this.bricks.applyDamage(brick.id, damage * aoe.splash, projectile.direction);
              });
            }
            // Вибух при влучанні
            if (projectile.explosion && this.explosions) {
              this.explosions.spawnExplosionByType(projectile.explosion, {
                position: { ...projectile.position },
              });
            }
            this.scene.removeObject(projectile.id);
            if (projectile.ringTrail) {
              this.spawnProjectileRing(projectile.position, projectile.ringTrail.config);
            }
            hit = true;
            break;
          }
        }

        if (hit) {
          continue;
        }

        projectile.elapsedMs += deltaMs;
        if (projectile.elapsedMs >= projectile.lifetimeMs) {
          this.scene.removeObject(projectile.id);
          continue;
        }

        if (this.isOutOfBounds(projectile.position, projectile.radius, mapSize, OUT_OF_BOUNDS_MARGIN)) {
          this.scene.removeObject(projectile.id);
          continue;
        }

        this.scene.updateObject(projectile.id, {
          position: { ...projectile.position },
        });

        if (projectile.ringTrail) {
          this.updateProjectileRingTrail(projectile, deltaMs);
        }

        this.projectiles[writeIndex++] = projectile;
      }
      this.projectiles.length = writeIndex;
    }

    if (this.rings.length > 0) {
      this.updateRings(deltaMs);
    }
  }

  public clear(): void {
    this.projectiles.forEach((projectile) => {
      this.scene.removeObject(projectile.id);
    });
    this.projectiles = [];
    this.clearRings();
  }

  public cleanupExpired(): void {
    const now = performance.now();

    // Clean up expired projectiles (check out-of-bounds)
    const mapSize = this.scene.getMapSize();
    let writeIndex = 0;
    for (let i = 0; i < this.projectiles.length; i += 1) {
      const projectile = this.projectiles[i]!;
      const lifetimeElapsed = now - projectile.createdAt;
      if (lifetimeElapsed >= projectile.lifetimeMs) {
        this.scene.removeObject(projectile.id);
        continue;
      }
      if (this.isOutOfBounds(projectile.position, projectile.radius, mapSize, OUT_OF_BOUNDS_MARGIN)) {
        this.scene.removeObject(projectile.id);
        continue;
      }
      this.projectiles[writeIndex++] = projectile;
    }
    this.projectiles.length = writeIndex;
    
    // Clean up expired rings using absolute time
    let ringWriteIndex = 0;
    for (let i = 0; i < this.rings.length; i += 1) {
      const ring = this.rings[i]!;
      const elapsed = now - ring.createdAt;
      if (elapsed >= ring.lifetimeMs) {
        this.scene.removeObject(ring.id);
        continue;
      }
      this.rings[ringWriteIndex++] = ring;
    }
    this.rings.length = ringWriteIndex;
  }

  public onBonusValuesChanged(values: BonusValueMap): void {
    const raw = values["spell_power"];
    const sanitized = Number.isFinite(raw) ? Math.max(raw, 0) : 1;
    if (Math.abs(sanitized - this.spellPowerMultiplier) < 1e-6) {
      return;
    }
    this.spellPowerMultiplier = sanitized;
    this.projectiles.forEach((projectile) => {
      projectile.damageMultiplier = sanitized;
    });
  }

  public serializeState(): unknown {
    return null;
  }

  public deserializeState(_data: unknown): void {
    // Not implemented
  }

  private findHitBrick(
    position: SceneVector2,
    radius: number,
  ): { id: string; distance: number; size: number } | null {
    let closest: { id: string; distance: number; size: number } | null = null;
    const expanded = Math.max(0, radius + 12);
    this.bricks.forEachBrickNear(position, expanded, (brick: BrickRuntimeState) => {
      const dx = brick.position.x - position.x;
      const dy = brick.position.y - position.y;
      const distanceSq = dx * dx + dy * dy;
      const combined = Math.max(0, (brick.physicalSize ?? 0) + radius);
      const combinedSq = combined * combined;
      if (distanceSq <= combinedSq) {
        if (!closest || distanceSq < closest.distance) {
          // store squared distance; callers don't depend on exact metric
          closest = { id: brick.id, distance: distanceSq, size: combined };
        }
      }
    });

    return closest;
  }

  private isOutOfBounds(
    position: SceneVector2,
    radius: number,
    mapSize: { width: number; height: number },
    margin: number = 0,
  ): boolean {
    return (
      position.x + radius < -margin ||
      position.y + radius < -margin ||
      position.x - radius > mapSize.width + margin ||
      position.y - radius > mapSize.height + margin
    );
  }

  private createRingTrailState(
    config: SpellProjectileRingTrailConfig
  ): ProjectileRingTrailState {
    const sanitized: ProjectileRingTrailRuntimeConfig = {
      spawnIntervalMs: Math.max(1, Math.floor(config.spawnIntervalMs)),
      lifetimeMs: Math.max(1, Math.floor(config.lifetimeMs)),
      startRadius: Math.max(1, config.startRadius),
      endRadius: Math.max(Math.max(1, config.startRadius), config.endRadius),
      startAlpha: clamp01(config.startAlpha),
      endAlpha: clamp01(config.endAlpha),
      innerStop: clamp01(config.innerStop),
      outerStop: clamp01(config.outerStop),
      color: {
        r: clamp01(config.color.r ?? 0),
        g: clamp01(config.color.g ?? 0),
        b: clamp01(config.color.b ?? 0),
        a: clamp01(config.color.a ?? 1),
      },
    };

    if (sanitized.outerStop <= sanitized.innerStop) {
      sanitized.outerStop = Math.min(1, sanitized.innerStop + 0.1);
    }

    return {
      config: sanitized,
      accumulatorMs: 0,
    };
  }

  private updateProjectileRingTrail(
    projectile: ProjectileState,
    deltaMs: number
  ): void {
    const trail = projectile.ringTrail;
    if (!trail) {
      return;
    }
    const interval = Math.max(1, trail.config.spawnIntervalMs);
    trail.accumulatorMs += deltaMs;
    while (trail.accumulatorMs >= interval) {
      trail.accumulatorMs -= interval;
      this.spawnProjectileRing(projectile.position, trail.config);
    }
  }

  private spawnProjectileRing(
    position: SceneVector2,
    config: ProjectileRingTrailRuntimeConfig
  ): void {
    const innerStop = clamp01(config.innerStop);
    let outerStop = clamp01(config.outerStop);
    if (outerStop <= innerStop) {
      outerStop = Math.min(1, innerStop + 0.1);
    }
    const outerFadeStop = Math.min(1, outerStop + 0.15);
    const now = performance.now();
    const ring: RingState = {
      id: this.scene.addObject("spellProjectileRing", {
        position: { ...position },
        size: {
          width: config.startRadius * 2,
          height: config.startRadius * 2,
        },
        fill: createRingFill(config.startRadius, config.startAlpha, {
          color: config.color,
          innerStop,
          outerStop,
          outerFadeStop,
        }),
      }),
      position: { ...position },
      elapsedMs: 0,
      createdAt: now,
      lifetimeMs: config.lifetimeMs,
      startRadius: config.startRadius,
      endRadius: config.endRadius,
      startAlpha: config.startAlpha,
      endAlpha: config.endAlpha,
      innerStop,
      outerStop,
      outerFadeStop,
      color: { ...config.color },
    };

    this.rings.push(ring);
  }

  private updateRings(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }
    let writeIndex = 0;
    for (let i = 0; i < this.rings.length; i += 1) {
      const ring = this.rings[i]!;
      ring.elapsedMs += deltaMs;
      const lifetime = Math.max(1, ring.lifetimeMs);
      if (ring.elapsedMs >= lifetime) {
        this.scene.removeObject(ring.id);
        continue;
      }
      const progress = clamp01(ring.elapsedMs / lifetime);
      const radius = lerp(ring.startRadius, ring.endRadius, progress);
      const alpha = lerp(ring.startAlpha, ring.endAlpha, progress);
      if (alpha <= 0.001) {
        this.scene.removeObject(ring.id);
        continue;
      }
      this.scene.updateObject(ring.id, {
        position: { ...ring.position },
        size: { width: radius * 2, height: radius * 2 },
        fill: createRingFill(radius, alpha, ring),
      });
      this.rings[writeIndex++] = ring;
    }
    this.rings.length = writeIndex;
  }

  private clearRings(): void {
    this.rings.forEach((ring) => {
      this.scene.removeObject(ring.id);
    });
    this.rings = [];
  }
}
