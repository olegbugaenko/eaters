import { GameModule } from "../core/types";
import {
  FILL_TYPES,
  SceneObjectManager,
  SceneVector2,
} from "../services/SceneObjectManager";
import {
  BULLET_TYPES,
  BulletConfig,
  BulletTailConfig,
  BulletType,
  getBulletConfig,
} from "../../db/bullets-db";
import { ExplosionType } from "../../db/explosions-db";
import { ExplosionModule, SpawnExplosionByTypeOptions } from "./ExplosionModule";

interface BulletCustomData {
  type: BulletType;
  tail: BulletTailConfig;
}

const createBulletFill = (radius: number, config: BulletConfig) => ({
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: radius,
  stops: config.gradientStops.map((stop) => ({
    offset: stop.offset,
    color: { ...stop.color },
  })),
});

const createBulletCustomData = (
  type: BulletType,
  tail: BulletTailConfig
): BulletCustomData => ({
  type,
  tail: {
    lengthMultiplier: tail.lengthMultiplier,
    widthMultiplier: tail.widthMultiplier,
    startColor: { ...tail.startColor },
    endColor: { ...tail.endColor },
  },
});

interface BulletState {
  id: string;
  type: BulletType;
  config: BulletConfig;
  position: SceneVector2;
  velocity: SceneVector2;
  radius: number;
  lifetimeMs: number;
  elapsedMs: number;
  rotation: number;
  explosionType?: ExplosionType;
}

export interface SpawnBulletByTypeOptions {
  position?: SceneVector2;
  directionAngle?: number;
  lifetimeMs?: number;
}

interface BulletModuleOptions {
  scene: SceneObjectManager;
  explosions: ExplosionModule;
}

export class BulletModule implements GameModule {
  public readonly id = "bullet";

  private bullets: BulletState[] = [];

  constructor(private readonly options: BulletModuleOptions) {}

  public initialize(): void {}

  public reset(): void {
    this.clearBullets();
  }

  public load(_data: unknown | undefined): void {
    this.clearBullets();
  }

  public save(): unknown {
    return null;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }
    for (let i = 0; i < 2; i += 1) {
      this.spawnBulletByType(this.getRandomBulletType());
    }
    this.updateBullets(deltaMs);
  }

  public spawnBulletByType(
    type: BulletType,
    options: SpawnBulletByTypeOptions = {}
  ): string {
    const config = getBulletConfig(type);
    const map = this.options.scene.getMapSize();
    const radius = config.diameter / 2;
    const distance = map.width + radius * 2;
    const travelTime = Math.max(0.001, config.travelTimeSeconds) * 1000;
    const speedPerMs = distance / travelTime;
    const angle =
      typeof options.directionAngle === "number"
        ? options.directionAngle
        : this.getRandomDirectionAngle(config);
    const position: SceneVector2 = options.position
      ? { ...options.position }
      : {
          x: -radius,
          y: Math.random() * map.height,
        };
    const velocity = {
      x: Math.cos(angle) * speedPerMs,
      y: Math.sin(angle) * speedPerMs,
    };

    const id = this.options.scene.addObject("bullet", {
      position: { ...position },
      size: { width: config.diameter, height: config.diameter },
      fill: createBulletFill(radius, config),
      rotation: angle,
      customData: createBulletCustomData(type, config.tail),
    });

    this.bullets.push({
      id,
      type,
      config,
      position,
      velocity,
      radius,
      lifetimeMs: Math.max(
        0,
        options.lifetimeMs ?? this.getRandomLifetime(config)
      ),
      elapsedMs: 0,
      rotation: angle,
      explosionType: config.explosionType,
    });

    return id;
  }

  private updateBullets(deltaMs: number): void {
    const map = this.options.scene.getMapSize();
    const delta = deltaMs;
    const survivors: BulletState[] = [];

    this.bullets.forEach((bullet) => {
      bullet.position = {
        x: bullet.position.x + bullet.velocity.x * delta,
        y: bullet.position.y + bullet.velocity.y * delta,
      };
      bullet.elapsedMs += delta;
      bullet.rotation = Math.atan2(bullet.velocity.y, bullet.velocity.x);

      if (bullet.elapsedMs >= bullet.lifetimeMs) {
        this.options.scene.removeObject(bullet.id);
        this.spawnExplosionForBullet(bullet, {
          position: { ...bullet.position },
          initialRadius: bullet.radius,
        });
        return;
      }

      if (
        bullet.position.x + bullet.radius < 0 ||
        bullet.position.x - bullet.radius > map.width ||
        bullet.position.y + bullet.radius < 0 ||
        bullet.position.y - bullet.radius > map.height
      ) {
        this.options.scene.removeObject(bullet.id);
        return;
      }

      this.options.scene.updateObject(bullet.id, {
        position: bullet.position,
        size: { width: bullet.radius * 2, height: bullet.radius * 2 },
        fill: createBulletFill(bullet.radius, bullet.config),
        rotation: bullet.rotation,
      });

      survivors.push(bullet);
    });

    this.bullets = survivors;
  }

  private clearBullets(): void {
    this.bullets.forEach((bullet) => {
      this.options.scene.removeObject(bullet.id);
    });
    this.bullets = [];
  }

  private spawnExplosionForBullet(
    bullet: BulletState,
    options: SpawnExplosionByTypeOptions
  ): void {
    if (!bullet.explosionType) {
      return;
    }
    this.options.explosions.spawnExplosionByType(bullet.explosionType, options);
  }

  private getRandomLifetime(config: BulletConfig): number {
    const min = Math.max(0, config.lifetimeMsRange.min);
    const max = Math.max(min, config.lifetimeMsRange.max);
    if (max <= min) {
      return min;
    }
    return min + Math.random() * (max - min);
  }

  private getRandomDirectionAngle(config: BulletConfig): number {
    const { min, max } = config.directionAngleRange;
    const spread = max - min;
    return min + Math.random() * spread;
  }

  private getRandomBulletType(): BulletType {
    const index = Math.floor(Math.random() * BULLET_TYPES.length);
    return BULLET_TYPES[index] ?? BULLET_TYPES[0]!;
  }
}
