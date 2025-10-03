import { GameModule } from "../core/types";
import {
  SceneObjectManager,
  SceneVector2,
} from "../services/SceneObjectManager";

const BULLET_DIAMETER = 16;
const BULLET_COLOR = { r: 1, g: 0.2, b: 0.2, a: 1 } as const;
const TRAVEL_TIME_SECONDS = 10;

interface BulletState {
  id: string;
  position: SceneVector2;
  velocity: SceneVector2;
  radius: number;
}

interface BulletModuleOptions {
  scene: SceneObjectManager;
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
    for(let i = 0; i < 10; i++) {
      this.spawnBullet();
    }
    this.updateBullets(deltaMs);
  }

  private spawnBullet(): void {
    const map = this.options.scene.getMapSize();
    const radius = BULLET_DIAMETER / 2;
    const distance = map.width + radius * 2;
    const speedPerMs = distance / (TRAVEL_TIME_SECONDS * 1000);
    const position: SceneVector2 = {
      x: -radius,
      y: Math.random() * map.height,
    };
    const id = this.options.scene.addObject("bullet", {
      position: { ...position },
      size: { width: BULLET_DIAMETER, height: BULLET_DIAMETER },
      color: { ...BULLET_COLOR },
    });
    this.bullets.push({
      id,
      position,
      velocity: { x: speedPerMs, y: 0 },
      radius,
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

      if (bullet.position.x - bullet.radius > map.width) {
        this.options.scene.removeObject(bullet.id);
        return;
      }

      this.options.scene.updateObject(bullet.id, {
        position: bullet.position,
        size: { width: bullet.radius * 2, height: bullet.radius * 2 },
        color: { ...BULLET_COLOR },
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
}
