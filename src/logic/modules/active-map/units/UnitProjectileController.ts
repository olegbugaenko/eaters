import {
  SceneObjectManager,
  SceneVector2,
  SceneFill,
  SceneColor,
  FILL_TYPES,
} from "../../../services/SceneObjectManager";
import { BricksModule } from "../BricksModule";
import type { BulletTailConfig, BulletTailEmitterConfig } from "@/db/bullets-db";
import type { SpellProjectileRingTrailConfig } from "@/db/spells-db";
import { clampNumber } from "@/utils/helpers/numbers";

export type UnitProjectileShape = "circle" | "triangle";

export interface UnitProjectileVisualConfig {
  radius: number;
  speed: number;
  lifetimeMs: number;
  fill: SceneFill;
  tail?: BulletTailConfig;
  tailEmitter?: BulletTailEmitterConfig;
  ringTrail?: SpellProjectileRingTrailConfig;
  shape?: UnitProjectileShape;
  hitRadius?: number;
}

export interface UnitProjectileSpawn {
  origin: SceneVector2;
  direction: SceneVector2;
  damage: number;
  rewardMultiplier: number;
  armorPenetration: number;
  skipKnockback?: boolean;
  visual: UnitProjectileVisualConfig;
}

interface UnitProjectileRingTrailState {
  config: Required<Omit<SpellProjectileRingTrailConfig, "color">> & {
    color: SceneColor;
  };
  accumulatorMs: number;
}

interface UnitProjectileState extends UnitProjectileSpawn {
  id: string;
  velocity: SceneVector2;
  elapsedMs: number;
  radius: number;
  lifetimeMs: number;
  ringTrail?: UnitProjectileRingTrailState;
  shape: UnitProjectileShape;
  hitRadius: number;
  position: SceneVector2;
}

const MAX_PROJECTILE_STEPS_PER_TICK = 5;
const MIN_MOVEMENT_STEP = 2;
const OUT_OF_BOUNDS_MARGIN = 50;

const clamp01 = (value: number): number => clampNumber(value, 0, 1);

const normalizeVector = (vector: SceneVector2): SceneVector2 => {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
};

export class UnitProjectileController {
  private readonly scene: SceneObjectManager;
  private readonly bricks: BricksModule;

  private projectiles: UnitProjectileState[] = [];
  private projectileIndex = new Map<string, UnitProjectileState>();

  constructor(options: { scene: SceneObjectManager; bricks: BricksModule }) {
    this.scene = options.scene;
    this.bricks = options.bricks;
  }

  public spawn(projectile: UnitProjectileSpawn): string {
    const direction = normalizeVector(projectile.direction);
    const visual = projectile.visual;
    const velocity = {
      x: direction.x * visual.speed,
      y: direction.y * visual.speed,
    };
    const position = { ...projectile.origin };
    const lifetimeMs = Math.max(1, Math.floor(visual.lifetimeMs));
    const radius = Math.max(1, visual.radius);
    const hitRadius = Math.max(1, visual.hitRadius ?? radius);
    const objectId = this.scene.addObject("unitProjectile", {
      position,
      size: { width: radius * 2, height: radius * 2 },
      rotation: Math.atan2(direction.y, direction.x),
      fill: visual.fill,
      customData: {
        tail: visual.tail,
        tailEmitter: visual.tailEmitter,
        shape: visual.shape ?? "circle",
      },
    });

    const ringTrail = visual.ringTrail
      ? this.createRingTrailState(visual.ringTrail)
      : undefined;

    const state: UnitProjectileState = {
      ...projectile,
      id: objectId,
      velocity,
      position,
      elapsedMs: 0,
      lifetimeMs,
      radius,
      ringTrail,
      shape: visual.shape ?? "circle",
      hitRadius,
    };

    this.projectiles.push(state);
    this.projectileIndex.set(objectId, state);
    if (ringTrail) {
      this.spawnProjectileRing(state.position, ringTrail.config);
    }
    return objectId;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0 || this.projectiles.length === 0) {
      return;
    }
    const deltaSeconds = deltaMs / 1000;
    const mapSize = this.scene.getMapSize();

    let writeIndex = 0;
    for (let i = 0; i < this.projectiles.length; i += 1) {
      const projectile = this.projectiles[i]!;
      let hitBrickId: string | null = null;

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

        const collided = this.findHitBrick(projectile.position, projectile.hitRadius);
        if (collided) {
          hitBrickId = collided.id;
          this.applyProjectileDamage(projectile, collided.id);
          this.scene.removeObject(projectile.id);
          if (projectile.ringTrail) {
            this.spawnProjectileRing(projectile.position, projectile.ringTrail.config);
          }
          this.projectileIndex.delete(projectile.id);
          break;
        }
      }

      if (hitBrickId) {
        continue;
      }

      projectile.elapsedMs += deltaMs;
      if (projectile.elapsedMs >= projectile.lifetimeMs) {
        this.scene.removeObject(projectile.id);
        this.projectileIndex.delete(projectile.id);
        continue;
      }

      if (this.isOutOfBounds(projectile.position, projectile.radius, mapSize, OUT_OF_BOUNDS_MARGIN)) {
        this.scene.removeObject(projectile.id);
        this.projectileIndex.delete(projectile.id);
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

  public clear(): void {
    this.projectiles.forEach((projectile) => {
      this.scene.removeObject(projectile.id);
    });
    this.projectiles = [];
    this.projectileIndex.clear();
  }

  private applyProjectileDamage(projectile: UnitProjectileState, brickId: string): void {
    this.bricks.applyDamage(brickId, projectile.damage, projectile.direction, {
      rewardMultiplier: projectile.rewardMultiplier,
      armorPenetration: projectile.armorPenetration,
      skipKnockback: projectile.skipKnockback === true,
    });
  }

  private findHitBrick(position: SceneVector2, radius: number): { id: string } | null {
    let closest: { id: string; distanceSq: number } | null = null;
    const expanded = Math.max(0, radius + 12);
    this.bricks.forEachBrickNear(position, expanded, (brick) => {
      const dx = brick.position.x - position.x;
      const dy = brick.position.y - position.y;
      const distanceSq = dx * dx + dy * dy;
      const combined = Math.max(0, (brick.physicalSize ?? 0) + radius);
      const combinedSq = combined * combined;
      if (distanceSq <= combinedSq) {
        if (!closest || distanceSq < closest.distanceSq) {
          closest = { id: brick.id, distanceSq };
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

  private createRingTrailState(config: SpellProjectileRingTrailConfig): UnitProjectileRingTrailState {
    const sanitized = {
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

    return { config: sanitized, accumulatorMs: 0 };
  }

  private updateProjectileRingTrail(projectile: UnitProjectileState, deltaMs: number): void {
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

  private spawnProjectileRing(position: SceneVector2, config: UnitProjectileRingTrailState["config"]): void {
    const innerStop = clamp01(config.innerStop);
    let outerStop = clamp01(config.outerStop);
    if (outerStop <= innerStop) {
      outerStop = Math.min(1, innerStop + 0.1);
    }
    const outerFadeStop = Math.min(1, outerStop + 0.15);
    this.scene.addObject("unitProjectileRing", {
      position: { ...position },
      size: { width: config.startRadius * 2, height: config.startRadius * 2 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: { x: 0, y: 0 },
        end: config.startRadius,
        stops: [
          { offset: 0, color: { ...config.color, a: 0 } },
          { offset: innerStop, color: { ...config.color, a: 0 } },
          { offset: outerStop, color: { ...config.color, a: clamp01(config.startAlpha) } },
          { offset: outerFadeStop, color: { ...config.color, a: 0 } },
          { offset: 1, color: { ...config.color, a: 0 } },
        ],
      },
    });
  }
}
