import {
  SceneObjectManager,
  SceneVector2,
  SceneFill,
  SceneColor,
  FILL_TYPES,
} from "../../../services/SceneObjectManager";
import { BricksModule } from "../../bricks/bricks.module";
import type { BulletTailConfig, BulletTailEmitterConfig } from "@/db/bullets-db";
import type { SpellProjectileRingTrailConfig } from "@/db/spells-db";
import { clampNumber } from "@/utils/helpers/numbers";
import {
  acquireGpuBulletSlot,
  updateGpuBulletSlot,
  releaseGpuBulletSlot,
  GPU_BULLET_CONFIGS,
  type BulletSlotHandle,
  type BulletVisualConfig,
} from "../../../services/BulletRenderBridge";
import {
  acquireRingSlot,
  updateRingSlot,
  releaseRingSlot,
  type RingSlotHandle,
} from "@ui/renderers/primitives/gpu/RingGpuRenderer";
import type { BulletSpriteName } from "@logic/services/bulletSprites";
import { resolveBulletSpriteIndex } from "@logic/services/bulletSprites";

export type UnitProjectileShape = "circle" | "sprite";

export interface UnitProjectileVisualConfig {
  radius: number;
  speed: number;
  lifetimeMs: number;
  fill: SceneFill;
  tail?: BulletTailConfig;
  tailEmitter?: BulletTailEmitterConfig;
  ringTrail?: SpellProjectileRingTrailConfig;
  shape?: UnitProjectileShape;
  /** Sprite name when shape === "sprite" */
  spriteName?: BulletSpriteName;
  /** Sprite index when shape === "sprite" */
  spriteIndex?: number;
  hitRadius?: number;
  rendererCustomData?: Record<string, unknown>;
}

export interface UnitProjectileSpawn {
  origin: SceneVector2;
  direction: SceneVector2;
  damage: number;
  rewardMultiplier: number;
  armorPenetration: number;
  skipKnockback?: boolean;
  visual: UnitProjectileVisualConfig;
  onHit?: UnitProjectileOnHit;
  onExpired?: (position: SceneVector2) => void;
}

export interface UnitProjectileHitContext {
  brickId: string;
  position: SceneVector2;
}

export type UnitProjectileOnHit = (
  context: UnitProjectileHitContext,
) => boolean | void;

interface UnitProjectileRingTrailState {
  config: Required<Omit<SpellProjectileRingTrailConfig, "color">> & {
    color: SceneColor;
  };
  accumulatorMs: number;
}

interface RingState {
  gpuSlot: RingSlotHandle;
  createdAt: number;
  lifetimeMs: number;
}

interface UnitProjectileState extends UnitProjectileSpawn {
  id: string;
  effectsObjectId?: string;
  velocity: SceneVector2;
  elapsedMs: number;
  radius: number;
  lifetimeMs: number;
  createdAt: number;
  ringTrail?: UnitProjectileRingTrailState;
  shape: UnitProjectileShape;
  hitRadius: number;
  position: SceneVector2;
  // GPU rendering slot (if using GPU instanced rendering)
  gpuSlot?: BulletSlotHandle;
}

const MAX_PROJECTILE_STEPS_PER_TICK = 5;
const MIN_MOVEMENT_STEP = 2;
const OUT_OF_BOUNDS_MARGIN = 50;

// Ring trail limits to prevent performance degradation
const MAX_RINGS = 512; // Maximum rings across all projectiles
const MAX_RINGS_PER_FRAME = 16; // Maximum rings spawned per frame (across all projectiles)

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
  private rings: RingState[] = [];
  private ringsSpawnedThisFrame = 0;

  constructor(options: { scene: SceneObjectManager; bricks: BricksModule }) {
    this.scene = options.scene;
    this.bricks = options.bricks;
  }

  public spawn(projectile: UnitProjectileSpawn): string {
    const direction = normalizeVector(projectile.direction);
    const baseVisual = projectile.visual;
    // Resolve spriteIndex from spriteName if needed
    let spriteIndex = baseVisual.spriteIndex;
    if (baseVisual.shape === "sprite" && spriteIndex === undefined && baseVisual.spriteName) {
      try {
        spriteIndex = resolveBulletSpriteIndex(baseVisual.spriteName);
      } catch (error) {
        console.error("[UnitProjectileController] Failed to resolve sprite index", {
          spriteName: baseVisual.spriteName,
          error,
        });
      }
    }
    // Create visual config with resolved spriteIndex
    const visual: UnitProjectileVisualConfig = {
      ...baseVisual,
      spriteIndex, // This will be undefined if not resolved, which is fine
    };
    const velocity = {
      x: direction.x * visual.speed,
      y: direction.y * visual.speed,
    };
    const position = { ...projectile.origin };
    const createdAt = performance.now();
    const lifetimeMs = Math.max(1, Math.floor(visual.lifetimeMs));
    const radius = Math.max(1, visual.radius);
    const hitRadius = Math.max(1, visual.hitRadius ?? radius);
    const rotation = Math.atan2(direction.y, direction.x);
    const shape = visual.shape ?? "circle";
    
    // Try GPU instanced rendering first (much faster for many projectiles)
    const gpuConfig = this.getGpuBulletConfig(visual, shape);
    const gpuSlot = gpuConfig ? acquireGpuBulletSlot(gpuConfig) : null;

    const rendererCustomData = {
      speed: visual.speed,
      maxSpeed: visual.speed,
      velocity,
      tail: visual.tail,
      tailEmitter: visual.tailEmitter,
      shape,
      ...(visual.rendererCustomData ?? {}),
    };

    // If the projectile needs features that the GPU-instanced bullet pass cannot draw
    // (non-solid gradients for the core, glow quads, or CPU particle emitters),
    // we attach a lightweight scene object that renders *only* those extras while
    // the main body stays on the GPU. This keeps fireballs and other fancy bullets
    // visually rich without giving up the high-throughput GPU path.
    const shouldCreateOverlay = this.shouldCreateOverlayObject(visual);
    let effectsObjectId: string | undefined;
    let objectId: string;
    if (gpuSlot) {
      // Use GPU instanced rendering for the main body
      objectId = `gpu-bullet-${gpuSlot.visualKey}-${gpuSlot.slotIndex}-${createdAt}`;
      updateGpuBulletSlot(gpuSlot, position, rotation, radius, true);

      if (shouldCreateOverlay) {
        // Overlay only renders emitters - body/tail/glow are handled by GPU
        effectsObjectId = this.scene.addObject("unitProjectile", {
          position,
          size: { width: radius * 2, height: radius * 2 },
          rotation,
          fill: visual.fill,
          customData: {
            ...rendererCustomData,
            renderComponents: {
              body: false,
              tail: false,
              glow: false,
              emitters: true,
            },
          },
        });
      }
    } else {
      // Fallback to scene object rendering
      objectId = this.scene.addObject("unitProjectile", {
        position,
        size: { width: radius * 2, height: radius * 2 },
        rotation,
        fill: visual.fill,
        customData: rendererCustomData,
      });
    }

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
      createdAt,
      radius,
      ringTrail,
      shape,
      hitRadius,
      gpuSlot: gpuSlot ?? undefined,
      effectsObjectId,
    };

    console.log('state: ', state);

    this.projectiles.push(state);
    this.projectileIndex.set(objectId, state);
    if (ringTrail) {
      this.spawnProjectileRing(state.position, ringTrail.config);
    }
    return objectId;
  }
  
  /**
   * Converts visual config to GPU bullet config.
   * Returns null if GPU rendering is not suitable for this bullet type.
   * Note: tailEmitter doesn't block GPU rendering - it's handled via overlay object.
   */
  private getGpuBulletConfig(visual: UnitProjectileVisualConfig, shape: UnitProjectileShape): BulletVisualConfig | null {
    // GPU rendering is always available - tailEmitter is handled via overlay object
    
    // Extract colors from fill for GPU rendering
    const bodyColor = this.extractBodyColor(visual.fill);
    const tailColors = this.extractTailColors(visual.tail);
    const radialColors = this.extractRadialGradient(visual.fill);
    
    // Use unique key for each visual type (shape + gradient + sprite)
    let visualKey = `unit-projectile-${shape}`;
    if (radialColors) {
      visualKey += "-radial";
    }
    if (shape === "sprite" && visual.spriteIndex !== undefined) {
      visualKey += `-sprite${visual.spriteIndex}`;
    }
    
    return {
      visualKey,
      bodyColor,
      tailStartColor: tailColors.start,
      tailEndColor: tailColors.end,
      tailLengthMultiplier: visual.tail?.lengthMultiplier ?? 4.5,
      tailWidthMultiplier: visual.tail?.widthMultiplier ?? 1.75,
      tailOffsetMultiplier: visual.tail?.offsetMultiplier,
      shape,
      centerColor: radialColors?.center,
      edgeColor: radialColors?.edge,
      spriteIndex: visual.spriteIndex,
    };
  }
  
  private extractBodyColor(fill: SceneFill): SceneColor {
    if (fill.fillType === FILL_TYPES.SOLID && "color" in fill) {
      return fill.color as SceneColor;
    }
    if (fill.fillType === FILL_TYPES.RADIAL_GRADIENT && "stops" in fill) {
      const stops = fill.stops as Array<{ color: SceneColor }>;
      // Use the most opaque color from gradient (fallback for bodyColor)
      let bestColor: SceneColor = { r: 0.4, g: 0.6, b: 1.0, a: 1.0 };
      let bestAlpha = 0;
      for (const stop of stops) {
        const alpha = stop.color.a ?? 1;
        if (alpha > bestAlpha) {
          bestColor = stop.color;
          bestAlpha = alpha;
        }
      }
      return bestColor;
    }
    return { r: 0.4, g: 0.6, b: 1.0, a: 1.0 };
  }
  
  private extractRadialGradient(fill: SceneFill): { center: SceneColor; edge: SceneColor } | null {
    if (fill.fillType !== FILL_TYPES.RADIAL_GRADIENT || !("stops" in fill)) {
      return null;
    }
    
    const stops = fill.stops as Array<{ offset: number; color: SceneColor }>;
    if (stops.length < 2) {
      return null;
    }
    
    // Sort stops by offset
    const sorted = [...stops].sort((a, b) => a.offset - b.offset);
    
    // Use first stop as center color, last stop as edge color
    const center = sorted[0]!.color;
    const edge = sorted[sorted.length - 1]!.color;
    
    return { center, edge };
  }
  
  private extractTailColors(tail?: BulletTailConfig): { start: SceneColor; end: SceneColor } {
    if (!tail) {
      return {
        start: { r: 0.25, g: 0.45, b: 1.0, a: 0.65 },
        end: { r: 0.05, g: 0.15, b: 0.6, a: 0.0 },
      };
    }
    return {
      start: tail.startColor ?? { r: 0.25, g: 0.45, b: 1.0, a: 0.65 },
      end: tail.endColor ?? { r: 0.05, g: 0.15, b: 0.6, a: 0.0 },
    };
  }

  private shouldCreateOverlayObject(visual: UnitProjectileVisualConfig): boolean {
    const rendererData = visual.rendererCustomData as
      | {
          trailEmitter?: BulletTailEmitterConfig;
          smokeEmitter?: BulletTailEmitterConfig;
        }
      | undefined;
    // Only create overlay for particle emitters - they need scene objects
    // Gradients and glow are now handled by GPU renderer
    const hasEmitters = Boolean(
      visual.tailEmitter || rendererData?.trailEmitter || rendererData?.smokeEmitter,
    );
    return hasEmitters;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }
    
    // Reset per-frame spawn counter
    this.ringsSpawnedThisFrame = 0;
    
    // Update rings lifetime and remove expired ones
    this.tickRings(deltaMs);
    
    if (this.projectiles.length === 0) {
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
          const handled = projectile.onHit?.({
            brickId: collided.id,
            position: { ...projectile.position },
          });
          if (handled !== true) {
            this.applyProjectileDamage(projectile, collided.id);
          }
          this.removeProjectile(projectile);
          if (projectile.ringTrail) {
            this.spawnProjectileRing(projectile.position, projectile.ringTrail.config);
          }
          break;
        }
      }

      if (hitBrickId) {
        continue;
      }

      projectile.elapsedMs += deltaMs;
      if (projectile.elapsedMs >= projectile.lifetimeMs) {
        projectile.onExpired?.({ ...projectile.position });
        this.removeProjectile(projectile);
        continue;
      }

      if (this.isOutOfBounds(projectile.position, projectile.radius, mapSize, OUT_OF_BOUNDS_MARGIN)) {
        projectile.onExpired?.({ ...projectile.position });
        this.removeProjectile(projectile);
        continue;
      }

      // Update position (GPU or scene object)
      this.updateProjectilePosition(projectile);

      if (projectile.ringTrail) {
        this.updateProjectileRingTrail(projectile, deltaMs);
      }

      this.projectiles[writeIndex++] = projectile;
    }
    this.projectiles.length = writeIndex;
  }
  
  /**
   * Removes a projectile from GPU slot or scene.
   */
  private removeProjectile(projectile: UnitProjectileState): void {
    if (projectile.gpuSlot) {
      releaseGpuBulletSlot(projectile.gpuSlot);
    } else {
      this.scene.removeObject(projectile.id);
    }
    if (projectile.effectsObjectId) {
      this.scene.removeObject(projectile.effectsObjectId);
    }
    this.projectileIndex.delete(projectile.id);
  }
  
  /**
   * Updates projectile position in GPU slot or scene.
   */
  private updateProjectilePosition(projectile: UnitProjectileState): void {
    const rotation = Math.atan2(projectile.velocity.y, projectile.velocity.x);
    if (projectile.gpuSlot) {
      updateGpuBulletSlot(
        projectile.gpuSlot,
        projectile.position,
        rotation,
        projectile.radius,
        true
      );
    } else {
      this.scene.updateObject(projectile.id, {
        position: { ...projectile.position },
      });
    }

    if (projectile.effectsObjectId) {
      this.scene.updateObject(projectile.effectsObjectId, {
        position: { ...projectile.position },
        rotation,
      });
    }
  }

  public clear(): void {
    this.projectiles.forEach((projectile) => {
      this.removeProjectile(projectile);
    });
    this.projectiles = [];
    this.projectileIndex.clear();
    
    // Also clear rings (GPU slots)
    this.rings.forEach((ring) => {
      releaseRingSlot(ring.gpuSlot);
    });
    this.rings = [];
  }

  /**
   * Cleans up expired objects that accumulated while the tab was inactive.
   * Uses absolute time (performance.now()) instead of elapsedMs to handle tab inactivity.
   */
  public cleanupExpired(): void {
    const now = performance.now();

    // Clean up expired projectiles
    let writeIndex = 0;
    for (let i = 0; i < this.projectiles.length; i += 1) {
      const projectile = this.projectiles[i]!;
      const lifetimeElapsed = now - projectile.createdAt;
      if (lifetimeElapsed >= projectile.lifetimeMs) {
        projectile.onExpired?.({ ...projectile.position });
        this.removeProjectile(projectile);
        continue;
      }
      const mapSize = this.scene.getMapSize();
      if (this.isOutOfBounds(projectile.position, projectile.radius, mapSize, OUT_OF_BOUNDS_MARGIN)) {
        projectile.onExpired?.({ ...projectile.position });
        this.removeProjectile(projectile);
        continue;
      }
      this.projectiles[writeIndex++] = projectile;
    }
    this.projectiles.length = writeIndex;
    
    // Clean up expired rings (these have createdAt, so we can check properly)
    this.tickRings(0); // Pass 0 delta, it uses performance.now() internally
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
    
    // Skip if we've hit the global ring limit
    if (this.rings.length >= MAX_RINGS) {
      trail.accumulatorMs = 0; // Reset accumulator to prevent burst when limit is lifted
      return;
    }
    
    // Skip if we've spawned too many rings this frame (prevents spiral of death)
    if (this.ringsSpawnedThisFrame >= MAX_RINGS_PER_FRAME) {
      // Don't accumulate time beyond one interval to prevent burst spawning
      trail.accumulatorMs = Math.min(trail.accumulatorMs + deltaMs, trail.config.spawnIntervalMs);
      return;
    }
    
    const interval = Math.max(1, trail.config.spawnIntervalMs);
    trail.accumulatorMs += deltaMs;
    
    // Spawn at most 1 ring per projectile per frame
    if (trail.accumulatorMs >= interval && this.rings.length < MAX_RINGS) {
      trail.accumulatorMs -= interval;
      // Cap accumulator to prevent burst spawning on next frame
      trail.accumulatorMs = Math.min(trail.accumulatorMs, interval);
      this.spawnProjectileRing(projectile.position, trail.config);
      this.ringsSpawnedThisFrame += 1;
    }
  }

  private spawnProjectileRing(position: SceneVector2, config: UnitProjectileRingTrailState["config"]): void {
    // GPU Instanced rendering - acquire slot and write initial data
    const gpuSlot = acquireRingSlot();
    if (!gpuSlot) {
      return; // No slots available
    }

    const innerStop = clamp01(config.innerStop);
    let outerStop = clamp01(config.outerStop);
    if (outerStop <= innerStop) {
      outerStop = Math.min(1, innerStop + 0.1);
    }
    const now = performance.now();

    // Write ring data to GPU - animation happens in shader
    updateRingSlot(gpuSlot, {
      position: { x: position.x, y: position.y },
      createdAt: now,
      lifetimeMs: config.lifetimeMs,
      startRadius: config.startRadius,
      endRadius: config.endRadius,
      startAlpha: config.startAlpha,
      endAlpha: config.endAlpha,
      innerStop,
      outerStop,
      color: config.color,
      active: true,
    });

    // Track ring for lifetime expiration only
    this.rings.push({
      gpuSlot,
      createdAt: now,
      lifetimeMs: config.lifetimeMs,
    });
  }

  private tickRings(_deltaMs: number): void {
    if (this.rings.length === 0) {
      return;
    }

    const now = performance.now();
    let writeIndex = 0;
    for (let i = 0; i < this.rings.length; i += 1) {
      const ring = this.rings[i]!;
      const elapsed = now - ring.createdAt;

      if (elapsed >= ring.lifetimeMs) {
        // Release GPU slot
        releaseRingSlot(ring.gpuSlot);
        continue;
      }

      this.rings[writeIndex++] = ring;
    }
    this.rings.length = writeIndex;
  }
}
