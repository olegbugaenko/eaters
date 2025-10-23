import { GameModule } from "../../core/types";
import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneObjectManager,
  SceneVector2,
} from "../../services/SceneObjectManager";
import { ExplosionModule } from "./ExplosionModule";

interface FireballModuleOptions {
  scene: SceneObjectManager;
  explosions: ExplosionModule;
  getBrickPosition: (brickId: string) => SceneVector2 | null;
  damageBrick: (brickId: string, damage: number) => void;
  getBricksInRadius: (position: SceneVector2, radius: number) => string[];
  logEvent: (message: string) => void;
}

interface FireballState {
  id: string;
  position: SceneVector2;
  velocity: SceneVector2;
  targetBrickId: string;
  damage: number;
  radius: number;
  elapsedMs: number;
  lifetimeMs: number;
  sourceUnitId: string;
  lastKnownTargetPosition: SceneVector2;
}

const FIREBALL_SPEED = 150; // pixels per second (reduced from 300 for more realistic movement)
const FIREBALL_LIFETIME_MS = 5000; // 5 seconds max flight time (increased to compensate for slower speed)
const FIREBALL_EXPLOSION_RADIUS = 40;
const FIREBALL_COLOR: SceneColor = { r: 1.0, g: 0.4, b: 0.1, a: 1.0 };
const FIREBALL_GLOW_COLOR: SceneColor = { r: 1.0, g: 0.7, b: 0.3, a: 0.8 };

export class FireballModule implements GameModule {
  public readonly id = "fireballs";

  private fireballs: FireballState[] = [];

  constructor(private readonly options: FireballModuleOptions) {}

  public initialize(): void {}

  public reset(): void {
    this.clearFireballs();
  }

  public load(_data: unknown | undefined): void {
    this.clearFireballs();
  }

  public save(): unknown {
    return null;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }

    const survivors: FireballState[] = [];

    this.fireballs.forEach((fireball) => {
      fireball.elapsedMs += deltaMs;
      
      // Update position based on velocity
      const deltaSeconds = deltaMs / 1000;
      fireball.position.x += fireball.velocity.x * deltaSeconds;
      fireball.position.y += fireball.velocity.y * deltaSeconds;

      // Update scene object position
      this.options.scene.updateObject(fireball.id, {
        position: { ...fireball.position },
        fill: { fillType: FILL_TYPES.SOLID, color: FIREBALL_COLOR },
        customData: {
          fireballId: fireball.id,
          glowColor: FIREBALL_GLOW_COLOR,
          radius: fireball.radius,
        },
      });
      
      console.log('[FireballModule] Updated fireball position:', fireball.id, fireball.position);

      // Check if target brick still exists
      const targetPosition = this.options.getBrickPosition(fireball.targetBrickId);

      if (targetPosition) {
        fireball.lastKnownTargetPosition = targetPosition;
      } else {
        // Target brick no longer exists, check for nearby bricks to hit instead
        const nearbyBricks = this.options.getBricksInRadius(fireball.position, fireball.radius + 20);
        if (nearbyBricks.length > 0) {
          // Find the closest brick
          let closestBrickId: string | null = null;
          let closestDistance = Infinity;
          
          nearbyBricks.forEach(brickId => {
            const brickPosition = this.options.getBrickPosition(brickId);
            if (brickPosition) {
              const distance = Math.sqrt(
                Math.pow(fireball.position.x - brickPosition.x, 2) +
                Math.pow(fireball.position.y - brickPosition.y, 2)
              );
              if (distance < closestDistance) {
                closestDistance = distance;
                closestBrickId = brickId;
              }
            }
          });

          if (closestBrickId && closestDistance <= fireball.radius + 20) {
            // Update target to the closest brick we hit
            fireball.targetBrickId = closestBrickId;
            const newTargetPosition = this.options.getBrickPosition(closestBrickId);
            if (newTargetPosition) {
              fireball.lastKnownTargetPosition = newTargetPosition;
            }
            this.explodeFireball(fireball);
            return;
          }
        }
      }

      if (fireball.lastKnownTargetPosition) {
        const distanceToTarget = Math.sqrt(
          Math.pow(fireball.position.x - fireball.lastKnownTargetPosition.x, 2) +
          Math.pow(fireball.position.y - fireball.lastKnownTargetPosition.y, 2)
        );

        if (distanceToTarget <= fireball.radius + 20) {
          this.explodeFireball(fireball);
          return;
        }
      }

      // Check collision with any nearby bricks (in case we're close to other bricks)
      const nearbyBricks = this.options.getBricksInRadius(fireball.position, fireball.radius + 20);
      if (nearbyBricks.length > 0) {
        // Find the closest brick
        let closestBrickId: string | null = null;
        let closestDistance = Infinity;
        
        nearbyBricks.forEach(brickId => {
          const brickPosition = this.options.getBrickPosition(brickId);
          if (brickPosition) {
            const distance = Math.sqrt(
              Math.pow(fireball.position.x - brickPosition.x, 2) +
              Math.pow(fireball.position.y - brickPosition.y, 2)
            );
            if (distance < closestDistance) {
              closestDistance = distance;
              closestBrickId = brickId;
            }
          }
        });

        if (closestBrickId && closestDistance <= fireball.radius + 20) {
          // Update target to the closest brick we hit
          fireball.targetBrickId = closestBrickId;
          const closestBrickPosition = this.options.getBrickPosition(closestBrickId);
          if (closestBrickPosition) {
            fireball.lastKnownTargetPosition = closestBrickPosition;
          }
          this.explodeFireball(fireball);
          return;
        }
      }

      // Check lifetime
      if (fireball.elapsedMs >= fireball.lifetimeMs) {
        this.explodeFireball(fireball);
        return;
      }

      survivors.push(fireball);
    });

    this.fireballs = survivors;
  }

  public spawnFireball(
    sourceUnitId: string,
    sourcePosition: SceneVector2,
    targetBrickId: string,
    damage: number
  ): void {
    console.log('[FireballModule] Spawning fireball from:', sourcePosition, 'to brick:', targetBrickId);
    
    const targetPosition = this.options.getBrickPosition(targetBrickId);
    if (!targetPosition) {
      console.log('[FireballModule] Target brick not found:', targetBrickId);
      return;
    }

    console.log('[FireballModule] Target position:', targetPosition);

    // Calculate direction and velocity
    const dx = targetPosition.x - sourcePosition.x;
    const dy = targetPosition.y - sourcePosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    console.log('[FireballModule] Distance to target:', distance);
    
    if (distance <= 0) {
      console.log('[FireballModule] Distance is 0, skipping');
      return;
    }

    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;
    
    const velocity: SceneVector2 = {
      x: normalizedDx * FIREBALL_SPEED,
      y: normalizedDy * FIREBALL_SPEED,
    };

    // Create fireball object
    const fireballId = this.options.scene.addObject("fireball", {
      position: { ...sourcePosition },
      fill: { fillType: FILL_TYPES.SOLID, color: FIREBALL_COLOR },
      customData: {
        fireballId: "",
        glowColor: FIREBALL_GLOW_COLOR,
        radius: 8,
      },
    });

    const fireball: FireballState = {
      id: fireballId,
      position: { ...sourcePosition },
      velocity,
      targetBrickId,
      damage,
      radius: 8,
      elapsedMs: 0,
      lifetimeMs: FIREBALL_LIFETIME_MS,
      sourceUnitId,
      lastKnownTargetPosition: { ...targetPosition },
    };

    // Update custom data with actual fireball ID
    this.options.scene.updateObject(fireballId, {
      position: { ...fireball.position },
      customData: {
        fireballId: fireball.id,
        glowColor: FIREBALL_GLOW_COLOR,
        radius: fireball.radius,
      },
    });

    this.fireballs.push(fireball);
    console.log('[FireballModule] Fireball added to array, total count:', this.fireballs.length);

    this.options.logEvent(
      `Fireball launched from unit ${sourceUnitId} targeting brick ${targetBrickId}`
    );
  }

  private explodeFireball(fireball: FireballState): void {
    console.log('[FireballModule] Exploding fireball:', fireball.id, 'at', fireball.position, 'damage:', fireball.damage);
    
    // Create explosion effect
    this.options.explosions.spawnExplosionByType("fireball", {
      position: { ...fireball.position },
      initialRadius: FIREBALL_EXPLOSION_RADIUS,
    });

    // Damage target brick
    console.log('[FireballModule] Damaging target brick:', fireball.targetBrickId, 'damage:', fireball.damage);
    this.options.damageBrick(fireball.targetBrickId, fireball.damage);

    // Damage nearby bricks within explosion radius
    const nearbyBrickIds = this.options.getBricksInRadius(fireball.position, FIREBALL_EXPLOSION_RADIUS);
    console.log('[FireballModule] Nearby bricks:', nearbyBrickIds);
    nearbyBrickIds.forEach((brickId) => {
      if (brickId !== fireball.targetBrickId) {
        console.log('[FireballModule] Damaging nearby brick:', brickId, 'damage:', fireball.damage);
        this.options.damageBrick(brickId, fireball.damage);
      }
    });

    // Remove fireball from scene
    this.options.scene.removeObject(fireball.id);

    this.options.logEvent(
      `Fireball exploded at (${fireball.position.x.toFixed(1)}, ${fireball.position.y.toFixed(1)}) dealing ${fireball.damage.toFixed(1)} damage to ${nearbyBrickIds.length + 1} bricks`
    );
  }

  private clearFireballs(): void {
    this.fireballs.forEach((fireball) => {
      this.options.scene.removeObject(fireball.id);
    });
    this.fireballs = [];
  }

  public getActiveFireballCount(): number {
    return this.fireballs.length;
  }
}
