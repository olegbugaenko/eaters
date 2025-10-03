import { GameModule } from "../core/types";
import {
  FILL_TYPES,
  SceneObjectManager,
  SceneVector2,
} from "../services/SceneObjectManager";
import { ExplosionModule } from "./ExplosionModule";

const BULLET_DIAMETER = 16;
const BULLET_GRADIENT_STOPS = [
  {
    offset: 0,
    color: { r: 0.1, g: 0.15, b: 1, a: 1 },
  },
  {
    offset: 0.35,
    color: { r: 0.9, g: 0.95, b: 0.9, a: 1 },
  },
  {
    offset: 0.5,
    color: { r: 0.5, g: 0.85, b: 1.0, a: 0.75 },
  },
  {
    offset: 1,
    color: { r: 0.5, g: 0.85, b: 1.0, a: 0 },
  },
] as const;
const TRAVEL_TIME_SECONDS = 20;
const MIN_DIRECTION_ANGLE = -Math.PI / 6;
const MAX_DIRECTION_ANGLE = Math.PI / 6;

const createBulletFill = (radius: number) => ({
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: radius,
  stops: BULLET_GRADIENT_STOPS.map((stop) => ({
    offset: stop.offset,
    color: { ...stop.color },
  })),
});

interface BulletState {
  id: string;
  position: SceneVector2;
  velocity: SceneVector2;
  radius: number;
  lifetimeMs: number;
  elapsedMs: number;
  rotation: number;
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
    for(let i = 0; i < 2; i++) {
      this.spawnBullet();
    }
    this.updateBullets(deltaMs);
  }

  private spawnBullet(): void {
    const map = this.options.scene.getMapSize();
    const radius = BULLET_DIAMETER / 2;
    const distance = map.width + radius * 2;
    const speedPerMs = distance / (TRAVEL_TIME_SECONDS * 1000);
    const angle = this.getRandomDirectionAngle();
    const position: SceneVector2 = {
      x: -radius,
      y: Math.random() * map.height,
    };
    const velocity = {
      x: Math.cos(angle) * speedPerMs,
      y: Math.sin(angle) * speedPerMs,
    };
    const id = this.options.scene.addObject("bullet", {
      position: { ...position },
      size: { width: BULLET_DIAMETER, height: BULLET_DIAMETER },
      fill: createBulletFill(radius),
      rotation: angle,
    });
    this.bullets.push({
      id,
      position,
      velocity,
      radius,
      lifetimeMs: this.getRandomLifetime(),
      elapsedMs: 0,
      rotation: angle,
    });
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
        this.options.explosions.spawnExplosion({
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
        fill: createBulletFill(bullet.radius),
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

  private getRandomLifetime(): number {
    const minSeconds = 1;
    const maxSeconds = 20;
    return (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000;
  }

  private getRandomDirectionAngle(): number {
    const spread = MAX_DIRECTION_ANGLE - MIN_DIRECTION_ANGLE;
    return MIN_DIRECTION_ANGLE + Math.random() * spread;
  }
}
