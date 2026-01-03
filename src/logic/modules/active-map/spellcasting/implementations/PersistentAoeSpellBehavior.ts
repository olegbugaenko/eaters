import {
  SpellBehavior,
  SpellCastContext,
  SpellCanCastContext,
  SpellBehaviorDependencies,
} from "../SpellBehavior";
import {
  SceneObjectManager,
} from "../../../../services/scene-object-manager/SceneObjectManager";
import type { SceneVector2, SceneColor } from "../../../../services/scene-object-manager/scene-object-manager.types";
import { BricksModule } from "../../bricks/bricks.module";
import type { BrickEffectTint, BrickRuntimeState } from "../../bricks/bricks.types";
import type { ParticleEmitterConfig } from "../../../../interfaces/visuals/particle-emitters-config";
import {
  SpellPersistentAoeConfig,
  SpellPersistentAoeVisualConfig,
  SpellPersistentAoeEffectConfig,
} from "../../../../../db/spells-db";
import { clampNumber } from "@/utils/helpers/numbers";
import { BonusValueMap } from "../../../shared/bonuses/bonuses.module";
import { cloneSceneFill } from "../../../../helpers/scene-fill.helper";
import { sanitizeSceneColor } from "../../../../helpers/scene-color.helper";
import type { ExplosionModule } from "../../../scene/explosion/explosion.module";
import {
  MIN_DURATION_MS,
  DEFAULT_GLOW_COLOR,
  DEFAULT_GLOW_ALPHA,
  DEFAULT_PARTICLE_COLOR,
  DEFAULT_FIRE_COLOR,
  BRICK_QUERY_MARGIN,
} from "./PersistentAoeSpellBehavior.const";
import type {
  PersistentAoeRingRuntimeConfig,
  PersistentAoeParticleRuntimeConfig,
  PersistentAoeVisualRuntimeConfig,
  PersistentAoeState,
  PersistentAoeEffectRuntimeConfig,
  PersistentAoeParticleCustomData,
  PersistentAoeObjectCustomData,
} from "./PersistentAoeSpellBehavior.types";


export class PersistentAoeSpellBehavior implements SpellBehavior {
  public readonly spellType = "persistent-aoe" as const;

  private readonly scene: SceneObjectManager;
  private readonly bricks: BricksModule;
  private readonly explosions: ExplosionModule | undefined;
  private readonly getSpellPowerMultiplier: () => number;

  private readonly instances: PersistentAoeState[] = [];
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
    if (context.config.type !== "persistent-aoe") {
      return false;
    }

    const sanitized = this.sanitizeConfig(context.config.persistentAoe);
    const center = { ...context.target };
    const initialProgress = 0;
    const renderData = this.initializeCustomData(
      sanitized.ring,
      sanitized.visual,
      sanitized.durationMs,
    );

    // Spawn explosion for visual effect if configured
    if (sanitized.visual.explosion && this.explosions) {
      this.explosions.spawnExplosionByType(sanitized.visual.explosion, {
        position: { ...center },
        initialRadius: sanitized.ring.startRadius,
      });
    }

    const objectId = this.scene.addObject("spellPersistentAoe", {
      position: { ...center },
      size: this.createSizeFromRing(sanitized.ring, initialProgress),
      customData: renderData,
    });

    const now = performance.now();
    const state: PersistentAoeState = {
      id: objectId,
      spellId: context.spellId,
      center,
      elapsedMs: 0,
      createdAt: now,
      durationMs: sanitized.durationMs,
      ring: sanitized.ring,
      baseDamagePerSecond: sanitized.damagePerSecond,
      damageMultiplier: context.spellPowerMultiplier,
      effects: sanitized.effects,
      visual: sanitized.visual,
      renderData,
    };

    this.instances.push(state);
    return true;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0 || this.instances.length === 0) {
      return;
    }

    const deltaSeconds = deltaMs / 1000;
    const survivors: PersistentAoeState[] = [];

    for (let i = 0; i < this.instances.length; i += 1) {
      const state = this.instances[i]!;
      state.elapsedMs += deltaMs;
      const progress = clamp01(state.elapsedMs / Math.max(state.durationMs, MIN_DURATION_MS));

      this.applyRingDamage(state, deltaSeconds);
      this.applyRingEffects(state);

      if (state.elapsedMs >= state.durationMs) {
        this.scene.removeObject(state.id);
        continue;
      }

      this.updateCustomData(state.renderData, state.ring, progress);

      this.scene.updateObject(state.id, {
        position: { ...state.center },
        size: this.createSizeFromRing(state.ring, progress),
        customData: state.renderData,
      });

      survivors.push(state);
    }

    this.instances.length = 0;
    this.instances.push(...survivors);
  }

  public clear(): void {
    this.instances.forEach((instance) => {
      this.scene.removeObject(instance.id);
    });
    this.instances.length = 0;
  }

  public cleanupExpired(): void {
    const now = performance.now();
    let writeIndex = 0;
    for (let i = 0; i < this.instances.length; i += 1) {
      const instance = this.instances[i]!;
      const elapsed = now - instance.createdAt;
      if (elapsed >= instance.durationMs) {
        this.scene.removeObject(instance.id);
        continue;
      }
      this.instances[writeIndex++] = instance;
    }
    this.instances.length = writeIndex;
  }

  public onBonusValuesChanged(values: BonusValueMap): void {
    const raw = values["spell_power"];
    const sanitized = Number.isFinite(raw) ? Math.max(raw, 0) : 1;
    if (Math.abs(sanitized - this.spellPowerMultiplier) < 1e-6) {
      return;
    }
    this.spellPowerMultiplier = sanitized;
    for (let i = 0; i < this.instances.length; i += 1) {
      this.instances[i]!.damageMultiplier = sanitized;
    }
  }

  public serializeState(): unknown {
    return null;
  }

  public deserializeState(_data: unknown): void {
    // Not implemented
  }

  private sanitizeConfig(config: SpellPersistentAoeConfig): {
    durationMs: number;
    damagePerSecond: number;
    ring: PersistentAoeRingRuntimeConfig;
    effects: PersistentAoeEffectRuntimeConfig[];
    visual: PersistentAoeVisualRuntimeConfig;
  } {
    const durationMs = Math.max(MIN_DURATION_MS, Math.floor(config.durationMs));
    const damagePerSecond = Math.max(0, config.damagePerSecond);
    const ring = this.sanitizeRingConfig(config.ring);
    const visual = this.sanitizeVisualConfig(config.visuals);
    const effects = this.sanitizeEffects(config.effects);
    return { durationMs, damagePerSecond, ring, visual, effects };
  }

  private sanitizeEffects(
    effects: SpellPersistentAoeConfig["effects"],
  ): PersistentAoeEffectRuntimeConfig[] {
    if (!effects || effects.length === 0) {
      return [];
    }

    const sanitized: PersistentAoeEffectRuntimeConfig[] = [];

    for (let i = 0; i < effects.length; i += 1) {
      const effect = effects[i]!;
      if (effect.type === "outgoing-damage-multiplier") {
        const durationMs = Math.max(MIN_DURATION_MS, Math.floor(effect.durationMs));
        const multiplier = clampNumber(effect.multiplier, 0, 1);
        sanitized.push({
          type: effect.type,
          durationMs,
          multiplier,
          tint: this.sanitizeEffectTint(effect.tint),
        });
      } else if (effect.type === "outgoing-damage-flat-reduction") {
        const durationMs = Math.max(MIN_DURATION_MS, Math.floor(effect.durationMs));
        const reductionValue = Math.max(0, effect.reductionValue);
        sanitized.push({
          type: effect.type,
          durationMs,
          reductionValue,
          tint: this.sanitizeEffectTint(effect.tint),
        });
      }
    }

    return sanitized;
  }

  private sanitizeEffectTint(tint: SpellPersistentAoeEffectConfig["tint"]): BrickEffectTint | null {
    if (!tint) {
      return null;
    }
    return {
      color: sanitizeSceneColor(tint.color, tint.color),
      intensity: clamp01(tint.intensity),
    };
  }

  private sanitizeRingConfig(ring: SpellPersistentAoeConfig["ring"]): PersistentAoeRingRuntimeConfig {
    const startRadius = Math.max(0, ring.startRadius);
    const endRadius = Math.max(startRadius, ring.endRadius);
    const thickness = Math.max(1, ring.thickness);
    return { startRadius, endRadius, thickness };
  }

  private sanitizeVisualConfig(
    visuals: SpellPersistentAoeVisualConfig | undefined,
  ): PersistentAoeVisualRuntimeConfig {
    const explosion = visuals?.explosion ?? null;
    
    const glowColor = sanitizeSceneColor(visuals?.glowColor, DEFAULT_GLOW_COLOR);
    const glowAlphaRaw = typeof visuals?.glowAlpha === "number" ? visuals.glowAlpha : undefined;
    const glowAlpha = clamp01(
      typeof glowAlphaRaw === "number" && Number.isFinite(glowAlphaRaw)
        ? glowAlphaRaw
        : glowColor.a ?? DEFAULT_GLOW_ALPHA,
    );

    const particle = visuals?.particleEmitter
      ? this.sanitizeParticleEmitterConfig(visuals.particleEmitter)
      : null;

    const fireColor = sanitizeSceneColor(visuals?.fireColor, DEFAULT_FIRE_COLOR);

    return { explosion, glowColor, glowAlpha, particle, fireColor };
  }

  private sanitizeParticleEmitterConfig(
    emitter: ParticleEmitterConfig,
  ): PersistentAoeParticleRuntimeConfig | null {
    const baseRate = Math.max(0, emitter.particlesPerSecond);
    const lifetime = Math.max(0, emitter.particleLifetimeMs);
    if (baseRate <= 0 || lifetime <= 0) {
      return null;
    }

    const fadeStart = clampNumber(emitter.fadeStartMs, 0, lifetime);
    const sizeMin = Math.max(0, emitter.sizeRange.min);
    const sizeMax = Math.max(sizeMin, emitter.sizeRange.max);
    const color = sanitizeSceneColor(emitter.color ?? DEFAULT_PARTICLE_COLOR, DEFAULT_PARTICLE_COLOR);
    const fill = emitter.fill ? cloneSceneFill(emitter.fill) : undefined;
    if (!emitter.radialSpeed || !emitter.tangentialSpeed) {
      return null;
    }
    const radialMin = Math.max(0, emitter.radialSpeed.min);
    const radialMax = Math.max(radialMin, emitter.radialSpeed.max);
    const tangentialMin = Number.isFinite(emitter.tangentialSpeed.min)
      ? Number(emitter.tangentialSpeed.min)
      : -radialMax;
    const tangentialMax = Number.isFinite(emitter.tangentialSpeed.max)
      ? Number(emitter.tangentialSpeed.max)
      : radialMax;
    const spawnRadial = Math.max(0, emitter.spawnJitter?.radial ?? 0);
    const spawnAngularRaw = emitter.spawnJitter?.angular;
    const spawnAngular = clampNumber(
      typeof spawnAngularRaw === "number" ? spawnAngularRaw : 0,
      0,
      Math.PI,
    );
    const maxParticles = typeof emitter.maxParticles === "number" && emitter.maxParticles > 0
      ? Math.floor(emitter.maxParticles)
      : undefined;

    return {
      baseParticlesPerSecond: baseRate,
      particleLifetimeMs: lifetime,
      fadeStartMs: fadeStart,
      sizeRange: { min: sizeMin, max: sizeMax },
      color,
      fill,
      maxParticles,
      radialSpeed: { min: radialMin, max: radialMax },
      tangentialSpeed: {
        min: Math.min(tangentialMin, tangentialMax),
        max: Math.max(tangentialMin, tangentialMax),
      },
      spawnJitter: { radial: spawnRadial, angular: spawnAngular },
    };
  }

  private createSizeFromRing(ring: PersistentAoeRingRuntimeConfig, progress: number) {
    const outer = this.getOuterRadius(ring, progress);
    const diameter = Math.max(1, outer * 2);
    return { width: diameter, height: diameter };
  }

  private initializeCustomData(
    ring: PersistentAoeRingRuntimeConfig,
    visual: PersistentAoeVisualRuntimeConfig,
    durationMs: number,
  ): PersistentAoeObjectCustomData {
    const outer = this.getOuterRadius(ring, 0);
    const inner = Math.max(0, outer - ring.thickness);
    return {
      shape: "ring",
      explosion: visual.explosion,
      innerRadius: inner,
      outerRadius: outer,
      thickness: ring.thickness,
      intensity: 1,
      glowColor: cloneColor(visual.glowColor),
      glowAlpha: visual.glowAlpha,
      fireColor: cloneColor(visual.fireColor),
      durationMs,
      particle: visual.particle
        ? {
            baseParticlesPerSecond: visual.particle.baseParticlesPerSecond,
            particleLifetimeMs: visual.particle.particleLifetimeMs,
            fadeStartMs: visual.particle.fadeStartMs,
            sizeRange: { ...visual.particle.sizeRange },
            color: cloneColor(visual.particle.color),
            fill: visual.particle.fill ? cloneSceneFill(visual.particle.fill) : undefined,
            maxParticles: visual.particle.maxParticles,
            radialSpeed: { ...visual.particle.radialSpeed },
            tangentialSpeed: { ...visual.particle.tangentialSpeed },
            spawnJitter: { ...visual.particle.spawnJitter },
          }
        : null,
    };
  }

  private updateCustomData(
    target: PersistentAoeObjectCustomData,
    ring: PersistentAoeRingRuntimeConfig,
    progress: number,
  ): void {
    const outer = this.getOuterRadius(ring, progress);
    target.outerRadius = outer;
    target.innerRadius = Math.max(0, outer - ring.thickness);
    target.thickness = ring.thickness;
    target.intensity = 1;
  }

  private applyRingDamage(state: PersistentAoeState, deltaSeconds: number): void {
    const damage = Math.max(
      0,
      state.baseDamagePerSecond * state.damageMultiplier * deltaSeconds,
    );
    if (damage <= 0) {
      return;
    }

    this.forEachBrickInRing(state, (brick, direction) => {
      this.bricks.applyDamage(brick.id, damage, direction, {
        overTime: deltaSeconds,
        skipKnockback: true,
      });
    });
  }

  private applyRingEffects(state: PersistentAoeState): void {
    if (state.effects.length === 0) {
      return;
    }

    this.forEachBrickInRing(state, (brick) => {
      for (let i = 0; i < state.effects.length; i += 1) {
        const effect = state.effects[i]!;
        if (effect.type === "outgoing-damage-multiplier") {
          this.bricks.applyEffect({
            type: "weakeningCurse",
            brickId: brick.id,
            durationMs: effect.durationMs,
            multiplier: effect.multiplier,
            tint: effect.tint,
          });
        } else if (effect.type === "outgoing-damage-flat-reduction") {
          // Multiply reduction value by spell power
          const flatReduction = effect.reductionValue * state.damageMultiplier;
          this.bricks.applyEffect({
            type: "weakeningCurseFlat",
            brickId: brick.id,
            durationMs: effect.durationMs,
            flatReduction,
            tint: effect.tint,
          });
        }
      }
    });
  }

  private forEachBrickInRing(
    state: PersistentAoeState,
    visitor: (brick: BrickRuntimeState, direction: SceneVector2) => void,
  ): void {
    const progress = clamp01(state.elapsedMs / Math.max(state.durationMs, MIN_DURATION_MS));
    const outerRadius = this.getOuterRadius(state.ring, progress);
    const innerRadius = Math.max(0, outerRadius - state.ring.thickness);
    const searchRadius = outerRadius + Math.max(state.ring.thickness, BRICK_QUERY_MARGIN);

    this.bricks.forEachBrickNear(state.center, searchRadius, (brick: BrickRuntimeState) => {
      if (!brick) {
        return;
      }
      const dx = brick.position.x - state.center.x;
      const dy = brick.position.y - state.center.y;
      const distance = Math.hypot(dx, dy);
      const brickRadius = Math.max(0, brick.physicalSize ?? 0);
      const nearest = Math.max(0, distance - brickRadius);
      const farthest = distance + brickRadius;
      if (nearest > outerRadius || farthest < innerRadius) {
        return;
      }

      const direction = distance > 0
        ? { x: dx / distance, y: dy / distance }
        : { x: 0, y: 0 };

      visitor(brick, direction);
    });
  }

  private getOuterRadius(ring: PersistentAoeRingRuntimeConfig, progress: number): number {
    const clamped = clamp01(progress);
    return lerp(ring.startRadius, ring.endRadius, clamped);
  }
}

const clamp01 = (value: number): number => clampNumber(value, 0, 1);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp01(t);

const cloneColor = (color: SceneColor): SceneColor => ({
  r: color.r,
  g: color.g,
  b: color.b,
  a: typeof color.a === "number" ? color.a : 1,
});
