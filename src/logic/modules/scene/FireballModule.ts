import { GameModule } from "../../core/types";
import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneObjectManager,
  SceneVector2,
} from "../../services/SceneObjectManager";
import { ParticleEmitterShape } from "../../services/particles/ParticleEmitterShared";
import { UnitProjectileController } from "../active-map/units/UnitProjectileController";
import { BricksModule } from "../active-map/BricksModule";
import { ExplosionModule } from "./ExplosionModule";

interface FireballModuleOptions {
  scene: SceneObjectManager;
  bricks: BricksModule;
  explosions: ExplosionModule;
  logEvent: (message: string) => void;
}

interface FireballState {
  targetBrickId: string;
  damage: number;
  radius: number;
  explosionRadius: number;
  sourceUnitId: string;
  trailEmitter: FireballTrailEmitterConfig;
  smokeEmitter: FireballTrailEmitterConfig;
}

interface FireballSpawnOptions {
  sourceUnitId: string;
  sourcePosition: SceneVector2;
  targetBrickId: string;
  damage: number;
  explosionRadius: number;
  maxDistance: number;
}

export interface FireballTrailEmitterConfig {
  particlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  baseSpeed: number;
  speedVariation: number;
  sizeRange: { min: number; max: number };
  spread: number;
  offset: SceneVector2;
  color: SceneColor;
  fill?: SceneFill;
  shape?: ParticleEmitterShape;
  maxParticles?: number;
}

const FIREBALL_SPEED = 150; // pixels per second (reduced from 300 for more realistic movement)
const DEFAULT_FIREBALL_LIFETIME_MS = 5000; // 5 seconds max flight time (increased to compensate for slower speed)
const DEFAULT_FIREBALL_EXPLOSION_RADIUS = 40;
const DEFAULT_FIREBALL_MAX_DISTANCE = (FIREBALL_SPEED * DEFAULT_FIREBALL_LIFETIME_MS) / 1000;
const FIREBALL_RADIUS = 8;
const FIREBALL_GLOW_COLOR: SceneColor = { r: 1.0, g: 0.7, b: 0.3, a: 0.8 };
const FIREBALL_GLOW_RADIUS_MULTIPLIER = 1.9;
const FIREBALL_TAIL_LENGTH_MULTIPLIER = 4.5;
const FIREBALL_TAIL_WIDTH_MULTIPLIER = 1.6;
const FIREBALL_TAIL_START_COLOR: SceneColor = {
  r: 1,
  g: 0.75,
  b: 0.3,
  a: 0.13,
};
const FIREBALL_TAIL_END_COLOR: SceneColor = { r: 0.2, g: 0.02, b: 0, a: 0 };
const FIREBALL_TAIL_RENDER = {
  lengthMultiplier: FIREBALL_TAIL_LENGTH_MULTIPLIER,
  widthMultiplier: FIREBALL_TAIL_WIDTH_MULTIPLIER,
  startColor: { ...FIREBALL_TAIL_START_COLOR },
  endColor: { ...FIREBALL_TAIL_END_COLOR },
};

const FIREBALL_TRAIL_EMITTER: FireballTrailEmitterConfig = {
  particlesPerSecond: 90,
  particleLifetimeMs: 750,
  fadeStartMs: 200,
  baseSpeed: 0.02,
  speedVariation: 0.002,
  sizeRange: { min: 24.2, max: 28.4 },
  spread: Math.PI,
  offset: { x: -0.35, y: 0 },
  color: { r: 1, g: 0.7, b: 0.3, a: 0.45 },
  fill: {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    stops: [
      { offset: 0, color: { r: 1, g: 0.85, b: 0.55, a: 0.12 } },
      { offset: 0.25, color: { r: 1, g: 0.65, b: 0.2, a: 0.08 } },
      { offset: 1, color: { r: 1, g: 0.4, b: 0.05, a: 0 } },
    ],
  },
  shape: "circle",
  maxParticles: 120,
};

const FIREBALL_SMOKE_EMITTER: FireballTrailEmitterConfig = {
  particlesPerSecond: 48,
  particleLifetimeMs: 820,
  fadeStartMs: 320,
  baseSpeed: 0.04,
  speedVariation: 0.02,
  sizeRange: { min: 12, max: 16 },
  spread: Math.PI / 4,
  offset: { x: -0.55, y: 0 },
  color: { r: 0.35, g: 0.24, b: 0.18, a: 0.4 },
  fill: {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    stops: [
      { offset: 0, color: { r: 0.6, g: 0.5, b: 0.4, a: 0.12 } },
      { offset: 0.3, color: { r: 0.4, g: 0.32, b: 0.28, a: 0.08 } },
      { offset: 1, color: { r: 0.18, g: 0.14, b: 0.12, a: 0 } },
    ],
  },
  shape: "circle",
  maxParticles: 72,
};

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

const cloneFill = (fill: SceneFill): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID:
      return {
        fillType: FILL_TYPES.SOLID,
        color: { ...fill.color },
        ...(fill.noise ? { noise: { ...fill.noise } } : {}),
        ...(fill.filaments ? { filaments: { ...fill.filaments } } : {}),
      };
    case FILL_TYPES.LINEAR_GRADIENT:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
        ...(fill.noise ? { noise: { ...fill.noise } } : {}),
        ...(fill.filaments ? { filaments: { ...fill.filaments } } : {}),
      };
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT:
      return {
        fillType: fill.fillType,
        start: fill.start ? { ...fill.start } : undefined,
        end: typeof fill.end === "number" ? fill.end : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
        ...(fill.noise ? { noise: { ...fill.noise } } : {}),
        ...(fill.filaments ? { filaments: { ...fill.filaments } } : {}),
      } as SceneFill;
    default:
      return fill;
  }
};

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
  fill: config.fill ? cloneFill(config.fill) : undefined,
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
