import type { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { TargetSnapshot } from "../targeting/targeting.types";
import type { TargetingService } from "../targeting/TargetingService";
import type { DamageService } from "../targeting/DamageService";
import type { StatusEffectsModule } from "../status-effects/status-effects.module";
import type { InternalEnemyState } from "./enemies.types";
import type {
  EnemyStreamAttackConfig,
  EnemyStreamAttackVisualConfig,
} from "@/db/enemies-db";
import type { ParticleEmitterConfig } from "@/logic/interfaces/visuals/particle-emitters-config";
import { cloneParticleEmitterConfig } from "@/logic/helpers/particle-emitter.helper";
import { clampNumber } from "@shared/helpers/numbers.helper";
import { getNowMs } from "@shared/helpers/time.helper";
import {
  normalizeVector,
  vectorHasLength,
} from "@shared/helpers/vector.helper";
import { ENEMY_STREAM_SCENE_OBJECT_TYPE } from "./enemies.const";
import type {
  EnemyStreamInstance,
  EnemyStreamRenderData,
  EnemyStreamVisualRuntimeConfig,
} from "./stream-attack.types";

interface EnemyStreamAttackControllerOptions {
  readonly scene: SceneObjectManager;
  readonly targeting?: TargetingService;
  readonly damage?: DamageService;
  readonly statusEffects: StatusEffectsModule;
  readonly getEnemyById: (enemyId: string) => InternalEnemyState | undefined;
}

interface SpawnEnemyStreamOptions {
  readonly sourceEnemy: InternalEnemyState;
  readonly targetId: string;
  readonly targetPosition: SceneVector2;
  readonly config: EnemyStreamAttackConfig;
  readonly damage: number;
  readonly statusEffectOptions?: EnemyStreamInstance["statusEffectOptions"];
}

const DEFAULT_DIRECTION: SceneVector2 = { x: 1, y: 0 };
const DEFAULT_STREAM_FILL = {
  fillType: FILL_TYPES.SOLID,
  color: { r: 0, g: 0, b: 0, a: 0 },
} as const;

const rotateOffset = (offset: SceneVector2, rotation: number): SceneVector2 => {
  if ((offset.x === 0 && offset.y === 0) || rotation === 0) {
    return {
      x: offset.x,
      y: offset.y,
    };
  }
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: offset.x * cos - offset.y * sin,
    y: offset.x * sin + offset.y * cos,
  };
};

const getDirectionFromRotation = (rotation: number): SceneVector2 => ({
  x: Math.cos(rotation),
  y: Math.sin(rotation),
});

const subtract = (a: SceneVector2, b: SceneVector2): SceneVector2 => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

const dot = (a: SceneVector2, b: SceneVector2): number => a.x * b.x + a.y * b.y;

const resolveOrigin = (
  enemy: InternalEnemyState,
  spawnOffset?: SceneVector2,
): SceneVector2 => {
  if (!spawnOffset) {
    return { x: enemy.position.x, y: enemy.position.y };
  }
  const rotated = rotateOffset(spawnOffset, enemy.rotation);
  return {
    x: enemy.position.x + rotated.x,
    y: enemy.position.y + rotated.y,
  };
};

const resolveStreamVisual = (
  config: EnemyStreamAttackVisualConfig,
  range: number,
  angleDeg: number,
): EnemyStreamVisualRuntimeConfig => {
  const angleRad = (Math.max(angleDeg, 1) * Math.PI) / 180;
  const derivedWidthEnd = Math.max(6, Math.tan(angleRad / 2) * range);
  return {
    color: { ...config.color },
    coreColor: { ...(config.coreColor ?? { r: 1, g: 0.96, b: 0.75, a: 0.95 }) },
    edgeColor: { ...(config.edgeColor ?? { r: 1, g: 0.2, b: 0.02, a: 0.1 }) },
    widthStart: Math.max(config.widthStart ?? 6, 1),
    widthEnd: Math.max(config.widthEnd ?? derivedWidthEnd, 2),
    innerWidthMultiplier: clampNumber(config.innerWidthMultiplier ?? 0.48, 0.15, 1),
    raggedness: Math.max(config.raggedness ?? 0.18, 0),
    waveAmplitude: Math.max(config.waveAmplitude ?? 0.22, 0),
    waveFrequency: Math.max(config.waveFrequency ?? 1.8, 0.1),
    pulseSpeed: Math.max(config.pulseSpeed ?? 0.01, 0.0001),
    pulseIntensity: clampNumber(config.pulseIntensity ?? 0.08, 0, 1),
    segments: Math.max(Math.round(config.segments ?? 11), 4),
    sparks: config.sparks ? cloneParticleEmitterConfig(config.sparks) : undefined,
  };
};

const buildFlameEmitters = (
  vis: EnemyStreamVisualRuntimeConfig,
  durationMs: number,
  angleDeg: number,
): ParticleEmitterConfig[] => {
  const spreadRad = (Math.max(angleDeg, 1) * Math.PI) / 180;
  const emitters: ParticleEmitterConfig[] = [];

  emitters.push({
    particlesPerSecond: 22,
    particleLifetimeMs: 520,
    fadeStartMs: 140,
    fadeInMs: 30,
    emissionDurationMs: durationMs,
    sizeRange: { min: 22, max: 38 },
    sizeEvolutionMult: 2.6,
    baseSpeed: 0.28,
    speedVariation: 0.06,
    spread: spreadRad * 1.1,
    offset: { x: 0, y: 0 },
    color: { ...vis.edgeColor, a: 0.28 },
    fill: {
      fillType: FILL_TYPES.RADIAL_GRADIENT,
      stops: [
        { offset: 0, color: { ...vis.color, a: 0.35 } },
        { offset: 0.35, color: { ...vis.edgeColor, a: 0.2 } },
        { offset: 1, color: { ...vis.edgeColor, a: 0 } },
      ],
    },
    shape: "circle",
    maxParticles: 18,
  });

  emitters.push({
    particlesPerSecond: 35,
    particleLifetimeMs: 400,
    fadeStartMs: 120,
    fadeInMs: 20,
    emissionDurationMs: durationMs,
    sizeRange: { min: 14, max: 26 },
    sizeEvolutionMult: 2.1,
    baseSpeed: 0.32,
    speedVariation: 0.08,
    spread: spreadRad * 0.85,
    offset: { x: 0, y: 0 },
    color: { ...vis.color, a: 0.42 },
    fill: {
      fillType: FILL_TYPES.RADIAL_GRADIENT,
      stops: [
        { offset: 0, color: { ...vis.coreColor, a: 0.55 } },
        { offset: 0.35, color: { ...vis.color, a: 0.3 } },
        { offset: 1, color: { ...vis.color, a: 0 } },
      ],
    },
    shape: "circle",
    maxParticles: 22,
  });

  emitters.push({
    particlesPerSecond: 18,
    particleLifetimeMs: 320,
    fadeStartMs: 80,
    fadeInMs: 15,
    emissionDurationMs: durationMs,
    sizeRange: { min: 8, max: 16 },
    sizeEvolutionMult: 1.6,
    baseSpeed: 0.36,
    speedVariation: 0.1,
    spread: spreadRad * 0.65,
    offset: { x: 0, y: 0 },
    color: { ...vis.coreColor, a: 0.52 },
    fill: {
      fillType: FILL_TYPES.RADIAL_GRADIENT,
      stops: [
        { offset: 0, color: { ...vis.coreColor, a: 0.75 } },
        { offset: 0.35, color: { ...vis.coreColor, a: 0.4 } },
        { offset: 1, color: { ...vis.coreColor, a: 0 } },
      ],
    },
    shape: "circle",
    maxParticles: 12,
  });

  if (vis.sparks) {
    emitters.push(cloneParticleEmitterConfig(vis.sparks));
  } else {
    emitters.push({
      particlesPerSecond: 12,
      particleLifetimeMs: 600,
      fadeStartMs: 280,
      fadeInMs: 25,
      emissionDurationMs: durationMs,
      sizeRange: { min: 3, max: 6 },
      sizeEvolutionMult: 0.7,
      baseSpeed: 0.22,
      speedVariation: 0.12,
      spread: spreadRad * 1.6,
      offset: { x: 0, y: 0 },
      color: { ...vis.coreColor, a: 0.72 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        stops: [
          { offset: 0, color: { ...vis.coreColor, a: 0.9 } },
          { offset: 0.5, color: { ...vis.color, a: 0.4 } },
          { offset: 1, color: { ...vis.edgeColor, a: 0 } },
        ],
      },
      shape: "circle",
      maxParticles: 10,
    });
  }

  return emitters;
};

export class EnemyStreamAttackController {
  private readonly scene: SceneObjectManager;
  private readonly targeting?: TargetingService;
  private readonly damage?: DamageService;
  private readonly statusEffects: StatusEffectsModule;
  private readonly getEnemyById: EnemyStreamAttackControllerOptions["getEnemyById"];
  private readonly streamOrder: EnemyStreamInstance[] = [];
  private idCounter = 0;

  constructor(options: EnemyStreamAttackControllerOptions) {
    this.scene = options.scene;
    this.targeting = options.targeting;
    this.damage = options.damage;
    this.statusEffects = options.statusEffects;
    this.getEnemyById = options.getEnemyById;
  }

  public spawn(options: SpawnEnemyStreamOptions): string | null {
    const durationMs = Math.max(options.config.durationMs, 1);
    const tickIntervalMs = Math.max(options.config.tickIntervalMs, 1);
    const range =
      Math.max(options.config.range ?? options.sourceEnemy.attackRange, 1);
    const visual = resolveStreamVisual(
      options.config.visual,
      range,
      options.config.angleDeg,
    );
    const origin = resolveOrigin(options.sourceEnemy, options.config.spawnOffset);
    const initialDirection =
      normalizeVector(subtract(options.targetPosition, origin)) ??
      getDirectionFromRotation(options.sourceEnemy.rotation) ??
      DEFAULT_DIRECTION;
    const rotation = Math.atan2(initialDirection.y, initialDirection.x);
    const streamId = `enemy-stream-${++this.idCounter}`;
    const flameEmitters = options.config.visual.flameEmitters
      ? options.config.visual.flameEmitters.map(cloneParticleEmitterConfig)
      : buildFlameEmitters(visual, durationMs, options.config.angleDeg);
    const renderData: EnemyStreamRenderData = {
      autoAnimate: true,
      seed: this.idCounter * 17.371,
      startedAtMs: getNowMs(),
      durationMs,
      range,
      angleDeg: options.config.angleDeg,
      visual,
      flameEmitters,
    };
    const sceneObjectId = this.scene.addObject(ENEMY_STREAM_SCENE_OBJECT_TYPE, {
      position: origin,
      rotation,
      size: {
        width: Math.max(visual.widthEnd * 2, 1),
        height: Math.max(range, 1),
      },
      fill: DEFAULT_STREAM_FILL,
      customData: renderData,
    });
    const stream: EnemyStreamInstance = {
      id: streamId,
      sourceEnemyId: options.sourceEnemy.id,
      sceneObjectId,
      durationMs,
      tickIntervalMs,
      damage: Math.max(options.damage, 0),
      range,
      angleDeg: Math.max(options.config.angleDeg, 1),
      visual,
      statusEffectId: options.config.statusEffectId,
      statusEffectOptions: options.statusEffectOptions,
      damageOptions: options.config.damageOptions,
      spawnOffset: options.config.spawnOffset
        ? { ...options.config.spawnOffset }
        : undefined,
      position: origin,
      direction: initialDirection,
      rotation,
      elapsedMs: 0,
      damageAccumulatorMs: 0,
      justSpawned: true,
      targetId: options.targetId,
    };
    this.streamOrder.push(stream);
    return stream.id;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0 || this.streamOrder.length === 0) {
      return;
    }

    for (let index = this.streamOrder.length - 1; index >= 0; index -= 1) {
      const stream = this.streamOrder[index]!;
      const sourceEnemy = this.getEnemyById(stream.sourceEnemyId);
      if (!sourceEnemy || sourceEnemy.hp <= 0) {
        this.removeStreamAt(index);
        continue;
      }

      const origin = resolveOrigin(sourceEnemy, stream.spawnOffset);
      const target = stream.targetId
        ? this.targeting?.getTargetById(stream.targetId, { types: ["unit"] }) ?? null
        : null;
      if (target) {
        const toTarget = normalizeVector(subtract(target.position, origin));
        if (toTarget) {
          stream.direction = toTarget;
        }
      }

      if (!vectorHasLength(stream.direction)) {
        stream.direction = getDirectionFromRotation(sourceEnemy.rotation);
      }

      stream.position = origin;
      stream.rotation = Math.atan2(stream.direction.y, stream.direction.x);
      this.scene.updateObject(stream.sceneObjectId, {
        position: origin,
        rotation: stream.rotation,
      });

      if (stream.justSpawned) {
        stream.justSpawned = false;
        continue;
      }

      stream.elapsedMs += deltaMs;
      stream.damageAccumulatorMs += deltaMs;

      while (stream.damageAccumulatorMs >= stream.tickIntervalMs) {
        this.applyTickDamage(stream);
        stream.damageAccumulatorMs -= stream.tickIntervalMs;
      }

      if (stream.elapsedMs >= stream.durationMs) {
        this.removeStreamAt(index);
      }
    }
  }

  public clear(): void {
    for (let index = this.streamOrder.length - 1; index >= 0; index -= 1) {
      this.removeStreamAt(index);
    }
  }

  public clearBySourceEnemyId(enemyId: string): void {
    for (let index = this.streamOrder.length - 1; index >= 0; index -= 1) {
      if (this.streamOrder[index]!.sourceEnemyId === enemyId) {
        this.removeStreamAt(index);
      }
    }
  }

  private applyTickDamage(stream: EnemyStreamInstance): void {
    if (!this.targeting) {
      return;
    }

    const filterRadius = stream.range + stream.visual.widthEnd + 48;
    this.targeting.forEachTargetNear(
      stream.position,
      filterRadius,
      (target) => {
        if (target.type !== "unit" || !this.isTargetInsideStream(stream, target)) {
          return;
        }

        if (this.damage && stream.damage > 0) {
          const defaultKnockBackDirection = {
            x: -stream.direction.x,
            y: -stream.direction.y,
          };
          this.damage.applyTargetDamage(target.id, stream.damage, {
            ...stream.damageOptions,
            direction: stream.direction,
            knockBackDirection:
              stream.damageOptions?.knockBackDirection ?? defaultKnockBackDirection,
            payload: {
              amount: stream.damage,
              context: {
                source: { type: "enemy", id: stream.sourceEnemyId },
                attackType: "stream",
                tag: "enemy-stream",
                baseDamage: stream.damage,
                direction: stream.direction,
              },
            },
          });
        }

        if (stream.statusEffectId) {
          this.statusEffects.applyEffect(
            stream.statusEffectId,
            { type: "unit", id: target.id },
            stream.statusEffectOptions,
          );
        }
      },
      { types: ["unit"] },
    );
  }

  private isTargetInsideStream(
    stream: EnemyStreamInstance,
    target: TargetSnapshot,
  ): boolean {
    const toTarget = subtract(target.position, stream.position);
    const along = dot(toTarget, stream.direction);
    const targetRadius = Math.max(target.physicalSize, 0);
    if (along < -targetRadius || along > stream.range + targetRadius) {
      return false;
    }

    const normalX = -stream.direction.y;
    const normalY = stream.direction.x;
    const lateralDistance = Math.abs(toTarget.x * normalX + toTarget.y * normalY);
    const progress = clampNumber(along / Math.max(stream.range, 1), 0, 1);
    const taperedWidth =
      stream.visual.widthStart +
      (stream.visual.widthEnd - stream.visual.widthStart) * progress;
    const angleWidth =
      Math.tan(((stream.angleDeg * Math.PI) / 180) * 0.5) *
      Math.max(along, 0);
    const allowedHalfWidth = Math.max(taperedWidth, angleWidth);
    return lateralDistance <= allowedHalfWidth + targetRadius;
  }

  private removeStreamAt(index: number): void {
    const stream = this.streamOrder[index];
    if (!stream) {
      return;
    }
    this.scene.removeObject(stream.sceneObjectId);
    this.streamOrder.splice(index, 1);
  }
}
