import {
  SceneVector2,
  SceneFill,
  SceneColor,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import { TargetingService } from "../targeting/TargetingService";
import { isTargetOfType, type TargetSnapshot } from "../targeting/targeting.types";
import type { DamageService } from "../targeting/DamageService";
import type { BulletTailConfig } from "@/db/bullets-db";
import type { ParticleEmitterConfig } from "../../../interfaces/visuals/particle-emitters-config";
import type { SpellProjectileRingTrailConfig } from "@/db/spells-db";
import { clamp01, clampNumber } from "@shared/helpers/numbers.helper";
import { normalizeVector } from "../../../../shared/helpers/vector.helper";
import {
  MAX_PROJECTILE_STEPS_PER_TICK,
  MIN_MOVEMENT_STEP,
  OUT_OF_BOUNDS_MARGIN,
  MAX_RINGS,
  MAX_RINGS_PER_FRAME,
} from "./projectiles.const";
import {
  acquireGpuBulletSlot,
  updateGpuBulletSlot,
  releaseGpuBulletSlot,
  GPU_BULLET_CONFIGS,
  type BulletSlotHandle,
  type BulletVisualConfig,
} from "../../../services/bullet-render-bridge/BulletRenderBridge";
import {
  ringGpuRenderer,
  type RingSlotHandle,
} from "@ui/renderers/primitives/gpu/ring";
import { resolveBulletSpriteIndex } from "@logic/services/bullet-render-bridge/bullet-sprites.helpers";
import type { SoundEffectPlayer } from "../../../../core/logic/provided/modules/audio/audio.types";
import type {
  UnitProjectileShape,
  UnitProjectileVisualConfig,
  UnitProjectileSpawn,
  UnitProjectileHitContext,
  UnitProjectileOnHit,
  UnitProjectileRingTrailState,
  RingState,
  UnitProjectileState,
  UnitProjectileWanderConfig,
} from "./projectiles.types";


export class UnitProjectileController {
  private readonly scene: SceneObjectManager;
  private readonly targeting: TargetingService;
  private readonly damage: DamageService;
  private readonly audio?: SoundEffectPlayer;

  private projectiles: UnitProjectileState[] = [];
  private projectileIndex = new Map<string, UnitProjectileState>();
  private rings: RingState[] = [];
  private ringsSpawnedThisFrame = 0;

  constructor(options: {
    scene: SceneObjectManager;
    targeting: TargetingService;
    damage: DamageService;
    audio?: SoundEffectPlayer;
  }) {
    this.scene = options.scene;
    this.targeting = options.targeting;
    this.damage = options.damage;
    this.audio = options.audio;
  }

  public spawn(projectile: UnitProjectileSpawn): string {
    const targetTypes =
      projectile.targetTypes && projectile.targetTypes.length > 0
        ? [...projectile.targetTypes]
        : ["brick", "enemy"];
    const direction = normalizeVector(projectile.direction) || { x: 1, y: 0 };
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
    if (visual.soundEffectUrl) {
      this.audio?.playSoundEffect(visual.soundEffectUrl);
    }
    const origin = {
      x: projectile.origin.x + (visual.spawnOffset?.x ?? 0),
      y: projectile.origin.y + (visual.spawnOffset?.y ?? 0),
    };
    const velocity = {
      x: direction.x * visual.speed,
      y: direction.y * visual.speed,
    };
    const position = { ...origin };
    const createdAt = performance.now();
    const lifetimeMs = Math.max(1, Math.floor(visual.lifetimeMs));
    const radius = Math.max(1, visual.radius);
    const hitRadius = Math.max(1, visual.hitRadius ?? radius);
    const damageRadius = Math.max(0, visual.damageRadius ?? 0);
    const rotation = Math.atan2(direction.y, direction.x);
    const movementRotation = rotation;
    const shape = visual.shape ?? "circle";
    
    // Try GPU instanced rendering first (much faster for many projectiles)
    const gpuConfig = this.getGpuBulletConfig(visual, shape);
    const gpuSlot = gpuConfig ? acquireGpuBulletSlot(gpuConfig) : null;

    const bulletGpuKey = gpuSlot ? `${gpuSlot.batchKey}:${gpuSlot.slotIndex}` : undefined;
    const rendererCustomData = {
      speed: visual.speed,
      maxSpeed: visual.speed,
      velocity,
      movementRotation,
      visualRotation: movementRotation,
      tail: visual.tail,
      tailEmitter: visual.tailEmitter,
      shape,
      bulletGpuKey,
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
      updateGpuBulletSlot(gpuSlot, position, movementRotation, movementRotation, radius, true);

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
      origin,
      targetTypes,
      direction,
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
      damageRadius,
      wander: this.createWanderState(visual.wander),
      rotationSpin: this.createRotationSpinState(visual.rotationSpinningDegPerSec),
      rendererCustomData,
      gpuSlot: gpuSlot ?? undefined,
      effectsObjectId,
      justSpawned: true, // Не рухати снаряд в перший тік
    };

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
      tailWidthMultiplier: visual.tail?.widthMultiplier ?? 2,
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
      // Use the most opaque color from gradient (fallback for bodyColor)
      let bestColor: SceneColor = { r: 0.4, g: 0.6, b: 1.0, a: 1.0 };
      let bestAlpha = 0;
      for (const stop of fill.stops) {
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
          trailEmitter?: ParticleEmitterConfig;
          smokeEmitter?: ParticleEmitterConfig;
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
      let hitTarget: TargetSnapshot | null = null;

      this.updateProjectileWander(projectile, deltaMs);
      this.updateProjectileRotationSpin(projectile, deltaMs);

      // Якщо снаряд щойно створений - пропускаємо рух, тільки оновлюємо візуал
      if (projectile.justSpawned) {
        projectile.justSpawned = false;
        this.updateProjectilePosition(projectile);
        if (projectile.ringTrail) {
          projectile.ringTrail.accumulatorMs += deltaMs;
        }
        this.projectiles[writeIndex++] = projectile;
        continue;
      }

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

        const collided = this.findHitTarget(projectile.position, projectile.hitRadius, projectile);
        if (collided) {
          hitTarget = collided;
          const handled = projectile.onHit?.({
            targetId: collided.id,
            targetType: collided.type,
            brickId: isTargetOfType(collided, "brick") ? collided.id : undefined,
            position: { ...projectile.position },
          });
          if (handled !== true) {
            if (projectile.damageRadius > 0) {
              this.damage.applyAreaDamage(
                projectile.position,
                projectile.damageRadius,
                projectile.damage,
                {
                  rewardMultiplier: projectile.rewardMultiplier,
                  armorPenetration: projectile.armorPenetration,
                  skipKnockback: projectile.skipKnockback === true,
                  knockBackDistance: projectile.knockBackDistance,
                  knockBackSpeed: projectile.knockBackSpeed,
                  knockBackDirection: projectile.knockBackDirection,
                  direction: projectile.direction,
                  types: projectile.targetTypes,
                }
              );
            } else {
              this.applyProjectileDamage(projectile, collided);
            }
          }
          this.removeProjectile(projectile);
          if (projectile.ringTrail) {
            this.spawnProjectileRing(projectile.position, projectile.ringTrail.config);
          }
          break;
        }
      }

      if (hitTarget) {
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

  private createWanderState(
    config: UnitProjectileWanderConfig | undefined,
  ): UnitProjectileState["wander"] | undefined {
    if (!config) {
      return undefined;
    }
    const intervalMs = clampNumber(config.intervalMs, 0, Number.POSITIVE_INFINITY);
    const angleRangeDeg = clampNumber(config.angleRangeDeg, 0, Number.POSITIVE_INFINITY);
    if (intervalMs <= 0 || angleRangeDeg <= 0) {
      return undefined;
    }
    return {
      intervalMs,
      angleRangeRad: (angleRangeDeg * Math.PI) / 180,
      accumulatorMs: 0,
    };
  }

  private updateProjectileWander(projectile: UnitProjectileState, deltaMs: number): void {
    const wander = projectile.wander;
    if (!wander) {
      return;
    }
    const elapsed = Math.max(0, deltaMs);
    if (elapsed <= 0) {
      return;
    }
    wander.accumulatorMs += elapsed;
    if (wander.accumulatorMs < wander.intervalMs) {
      return;
    }

    while (wander.accumulatorMs >= wander.intervalMs) {
      wander.accumulatorMs -= wander.intervalMs;
      const angle = (Math.random() * 2 - 1) * wander.angleRangeRad;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rotated = {
        x: projectile.direction.x * cos - projectile.direction.y * sin,
        y: projectile.direction.x * sin + projectile.direction.y * cos,
      };
      projectile.direction = normalizeVector(rotated) ?? projectile.direction;
    }

    const speed = projectile.visual.speed;
    projectile.velocity = {
      x: projectile.direction.x * speed,
      y: projectile.direction.y * speed,
    };
  }

  private createRotationSpinState(
    rotationSpinningDegPerSec: number | undefined,
  ): UnitProjectileState["rotationSpin"] | undefined {
    if (!Number.isFinite(rotationSpinningDegPerSec)) {
      return undefined;
    }
    const degreesPerSec = Math.abs(rotationSpinningDegPerSec ?? 0);
    if (degreesPerSec <= 0) {
      return undefined;
    }
    return {
      radiansPerMs: (degreesPerSec * Math.PI) / 180 / 1000,
      rotationRad: 0,
    };
  }

  private updateProjectileRotationSpin(
    projectile: UnitProjectileState,
    deltaMs: number,
  ): void {
    const rotationSpin = projectile.rotationSpin;
    if (!rotationSpin) {
      return;
    }
    const elapsed = Math.max(0, deltaMs);
    if (elapsed <= 0) {
      return;
    }
    rotationSpin.rotationRad += rotationSpin.radiansPerMs * elapsed;
  }
  
  /**
   * Updates projectile position in GPU slot or scene.
   */
  private updateProjectilePosition(projectile: UnitProjectileState): void {
    const movementRotation = Math.atan2(projectile.velocity.y, projectile.velocity.x);
    const visualRotation = movementRotation + (projectile.rotationSpin?.rotationRad ?? 0);
    const rendererCustomData = {
      ...projectile.rendererCustomData,
      movementRotation,
      visualRotation,
    };
    const effectsRendererCustomData = projectile.effectsObjectId
      ? {
          ...rendererCustomData,
          renderComponents: {
            body: false,
            tail: false,
            glow: false,
            emitters: true,
          },
        }
      : rendererCustomData;
    if (projectile.gpuSlot) {
      updateGpuBulletSlot(
        projectile.gpuSlot,
        projectile.position,
        movementRotation,
        visualRotation,
        projectile.radius,
        true
      );
    } else {
      this.scene.updateObject(projectile.id, {
        position: { ...projectile.position },
        rotation: visualRotation,
        customData: rendererCustomData,
      });
    }

    if (projectile.effectsObjectId) {
      this.scene.updateObject(projectile.effectsObjectId, {
        position: { ...projectile.position },
        rotation: movementRotation,
        customData: effectsRendererCustomData,
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
      ringGpuRenderer.releaseSlot(ring.gpuSlot);
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

  private applyProjectileDamage(projectile: UnitProjectileState, target: TargetSnapshot): void {
    this.damage.applyTargetDamage(target.id, projectile.damage, {
      rewardMultiplier: projectile.rewardMultiplier,
      armorPenetration: projectile.armorPenetration,
      skipKnockback: projectile.skipKnockback === true,
      knockBackDistance: projectile.knockBackDistance,
      knockBackSpeed: projectile.knockBackSpeed,
      knockBackDirection: projectile.knockBackDirection,
      direction: projectile.direction,
    });
  }

  private findHitTarget(
    position: SceneVector2,
    radius: number,
    projectile: UnitProjectileState,
  ): TargetSnapshot | null {
    let closest: TargetSnapshot | null = null;
    let closestDistanceSq = Number.POSITIVE_INFINITY;
    const expanded = Math.max(0, radius + 12);
    const types = projectile.targetTypes && projectile.targetTypes.length > 0 ? projectile.targetTypes : undefined;
    this.targeting.forEachTargetNear(
      position,
      expanded,
      (target) => {
        if (types && !types.includes(target.type)) {
          return;
        }
        const combined = Math.max(0, (target.physicalSize ?? 0) + radius);
        const dx = target.position.x - position.x;
        const dy = target.position.y - position.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq <= combined * combined && distanceSq < closestDistanceSq) {
          closest = target;
          closestDistanceSq = distanceSq;
        }
      },
      types ? { types } : undefined,
    );
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
    const gpuSlot = ringGpuRenderer.acquireSlot(undefined);
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
    ringGpuRenderer.updateSlot(gpuSlot, {
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
        ringGpuRenderer.releaseSlot(ring.gpuSlot);
        continue;
      }

      this.rings[writeIndex++] = ring;
    }
    this.rings.length = writeIndex;
  }
}
