import { GameModule } from "../../core/types";
import { FILL_TYPES, SceneFill, SceneVector2 } from "../../services/SceneObjectManager";
import { cloneSceneFill } from "../../helpers/scene-fill.helper";
import { FireballModuleOptions, FireballSpawnOptions, FireballState, FireballTrailEmitterConfig } from "./FireballModule.types";
export type { FireballSpawnOptions, FireballTrailEmitterConfig } from "./FireballModule.types";
import {
  DEFAULT_FIREBALL_EXPLOSION_RADIUS,
  DEFAULT_FIREBALL_LIFETIME_MS,
  DEFAULT_FIREBALL_MAX_DISTANCE,
  FIREBALL_GLOW_COLOR,
  FIREBALL_GLOW_RADIUS_MULTIPLIER,
  FIREBALL_RADIUS,
  FIREBALL_SMOKE_EMITTER,
  FIREBALL_SPEED,
  FIREBALL_TAIL_RENDER,
  FIREBALL_TRAIL_EMITTER,
} from "./FireballModule.const";
import { UnitProjectileController } from "../active-map/units/UnitProjectileController";
import { BricksModule } from "../active-map/BricksModule";
import { ExplosionModule } from "./ExplosionModule";

const createCoreFill = (radius: number): SceneFill => ({
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: radius,
  stops: [
    { offset: 0, color: { r: 1, g: 0.94, b: 0.7, a: 1 } },
    { offset: 0.4, color: { r: 1, g: 0.8, b: 0.9, a: 0.95 } },
    { offset: 1, color: { r: 0.9, g: 0.95, b: 0.9, a: 0.95 } },
  ],
});

const cloneTrailEmitterConfig = (
  config: FireballTrailEmitterConfig,
): FireballTrailEmitterConfig => ({
  particlesPerSecond: config.particlesPerSecond,
  particleLifetimeMs: config.particleLifetimeMs,
  fadeStartMs: config.fadeStartMs,
  baseSpeed: config.baseSpeed,
  speedVariation: config.speedVariation,
  sizeRange: { min: config.sizeRange.min, max: config.sizeRange.max },
  spread: config.spread,
  offset: { x: config.offset.x, y: config.offset.y },
  color: { ...config.color },
  fill: config.fill ? cloneSceneFill(config.fill) : undefined,
  shape: config.shape,
  maxParticles: config.maxParticles,
});

const createRenderCustomData = (options: {
  radius: number;
  velocity: SceneVector2;
  trailEmitter: FireballTrailEmitterConfig;
  smokeEmitter: FireballTrailEmitterConfig;
}) => ({
  radius: options.radius,
  velocity: { ...options.velocity },
  speed: FIREBALL_SPEED,
  maxSpeed: FIREBALL_SPEED,
  tail: FIREBALL_TAIL_RENDER,
  glow: {
    color: { ...FIREBALL_GLOW_COLOR },
    radiusMultiplier: FIREBALL_GLOW_RADIUS_MULTIPLIER,
  },
  trailEmitter: options.trailEmitter,
  smokeEmitter: options.smokeEmitter,
  shape: "circle" as const,
});

export class FireballModule implements GameModule {
  public readonly id = "fireballs";

  private fireballs: FireballState[] = [];
  private readonly projectiles: UnitProjectileController;

  constructor(private readonly options: FireballModuleOptions) {
    this.projectiles = new UnitProjectileController({
      scene: options.scene,
      bricks: options.bricks,
    });
  }

  public initialize(): void {}

  public reset(): void {
    this.clearFireballs();
    this.projectiles.clear();
  }

  public load(_data: unknown | undefined): void {
    this.clearFireballs();
    this.projectiles.clear();
  }

  public save(): unknown {
    return null;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }

    this.projectiles.tick(deltaMs);
  }

  public spawnFireball(options: FireballSpawnOptions): void {
    const { sourceUnitId, sourcePosition, targetBrickId, damage } = options;
    const targetBrick = this.options.bricks.getBrickState(targetBrickId);
    if (!targetBrick) {
      return;
    }

    const explosionRadius =
      options.explosionRadius > 0 ? options.explosionRadius : DEFAULT_FIREBALL_EXPLOSION_RADIUS;
    const maxDistance =
      options.maxDistance > 0 ? options.maxDistance : DEFAULT_FIREBALL_MAX_DISTANCE;

    const dx = targetBrick.position.x - sourcePosition.x;
    const dy = targetBrick.position.y - sourcePosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= 0) {
      return;
    }

    const direction: SceneVector2 = { x: dx / distance, y: dy / distance };
    const velocity: SceneVector2 = {
      x: direction.x * FIREBALL_SPEED,
      y: direction.y * FIREBALL_SPEED,
    };

    const fill = createCoreFill(FIREBALL_RADIUS);
    const trailEmitter = cloneTrailEmitterConfig(FIREBALL_TRAIL_EMITTER);
    const smokeEmitter = cloneTrailEmitterConfig(FIREBALL_SMOKE_EMITTER);

    const fireball: FireballState = {
      targetBrickId,
      damage,
      radius: FIREBALL_RADIUS,
      explosionRadius,
      sourceUnitId,
      trailEmitter,
      smokeEmitter,
    };
    this.fireballs.push(fireball);

    const rendererCustomData = createRenderCustomData({
      radius: FIREBALL_RADIUS,
      velocity,
      trailEmitter,
      smokeEmitter,
    });

    this.projectiles.spawn({
      origin: { ...sourcePosition },
      direction,
      damage,
      rewardMultiplier: 1,
      armorPenetration: 0,
      visual: {
        radius: FIREBALL_RADIUS,
        speed: FIREBALL_SPEED,
        lifetimeMs: (maxDistance / FIREBALL_SPEED) * 1000,
        fill,
        tail: FIREBALL_TAIL_RENDER,
        shape: "sprite",
        spriteName: "fireball",
        hitRadius: FIREBALL_RADIUS,
        rendererCustomData,
      },
      onHit: (context) => {
        this.explodeFireball(fireball, context.brickId, context.position);
        return true;
      },
      onExpired: () => this.removeFireballInstance(fireball),
    });
  }

  private explodeFireball(
    fireball: FireballState,
    primaryBrickId: string,
    position: SceneVector2,
  ): void {
    this.options.explosions.spawnExplosionByType("fireball", {
      position: { ...position },
      initialRadius: fireball.explosionRadius,
    });

    const applyDamage = (brickId: string): void => {
      this.options.bricks.applyDamage(brickId, fireball.damage, { x: 0, y: 0 }, {
        rewardMultiplier: 1,
        armorPenetration: 0,
      });
    };

    applyDamage(primaryBrickId);

    const nearby = this.options.bricks.findBricksNear(position, fireball.explosionRadius);
    nearby.forEach((brick) => {
      if (brick.id !== primaryBrickId) {
        applyDamage(brick.id);
      }
    });

    this.removeFireballInstance(fireball);
  }

  private removeFireballInstance(fireball: FireballState): void {
    this.fireballs = this.fireballs.filter((active) => active !== fireball);
  }

  private clearFireballs(): void {
    this.fireballs = [];
  }

  public getActiveFireballCount(): number {
    return this.fireballs.length;
  }
}
