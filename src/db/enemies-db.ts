import {
  SceneColor,
  SceneFill,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { ParticleEmitterConfig } from "../logic/interfaces/visuals/particle-emitters-config";
import { ResourceAmount, normalizeResourceAmount } from "./resources-db";
import type {
  ExtendedRendererLayerFields,
  BaseRendererLayerConfig,
  RendererLayerAnimationConfig,
} from "@shared/types/renderer.types";
import type { RendererFillConfig, RendererStrokeConfig } from "@shared/types/renderer-config";
import type { UnitProjectileVisualConfig } from "../logic/modules/active-map/projectiles/projectiles.types";
import { mapLineToPolygonShape } from "@/shared/helpers/paths.helper";
import type { ArcType } from "./arcs-db";
import type { StatusEffectId } from "./status-effects-db";
import type { StatusEffectApplicationOptions } from "@/logic/modules/active-map/status-effects/status-effects.types";
import type { ExplosionType } from "./explosions-db";
import type { AttackSeriesConfig } from "@shared/types/attack-series.types";
import type { MapEnemySpawnTypeConfig } from "./maps/maps-db";
import type { DamageApplicationOptions } from "@/logic/modules/active-map/targeting/DamageService";

export type EnemyType =
  | "basicEnemy"
  | "fastEnemy"
  | "tankEnemy"
  | "turretEnemy"
  | "burstTurretEnemy"
  | "volleyTurretEnemy"
  | "wheelVolleyTurretEnemy"
  | "explosionTurretEnemy"
  | "bleedingTurretEnemy"
  | "spectreEnemy"
  | "encagedBeastEnemy"
  | "coalConvoyGuardian"
  | "silverKeeperEnemy"
  | "freezeTurretEnemy"
  | "snakeEnemy"
  | "bigGun"
  | "laserTurretEnemy"
  | "plasmaBeamTurretEnemy"
  | "portalSpawnerEnemy"
  | "greatOctopusBody"
  | "greatOctopusSegment";

export interface EnemyAuraConfig {
  petalCount: number;
  innerRadius: number;
  outerRadius: number;
  petalWidth?: number;
  rotationSpeed: number;
  color: SceneColor;
  alpha: number;
  pointInward?: boolean;
}

export type EnemyRendererLayerConfig =
  BaseRendererLayerConfig<ExtendedRendererLayerFields>;

export interface EnemyRendererCompositeConfig {
  kind: "composite";
  fill: SceneColor;
  stroke?: {
    color: SceneColor;
    width: number;
  };
  layers: readonly EnemyRendererLayerConfig[];
  auras?: readonly EnemyAuraConfig[];
}

export interface EnemyRendererPolygonConfig {
  kind: "polygon";
  fill: SceneColor;
  stroke?: {
    color: SceneColor;
    width: number;
  };
  vertices: readonly SceneVector2[];
}

export type EnemyRendererConfig =
  | EnemyRendererCompositeConfig
  | EnemyRendererPolygonConfig;

export interface EnemyArcAttackConfig {
  readonly arcType: ArcType;
  readonly spawnOffset?: SceneVector2;
  readonly attackSeries?: AttackSeriesConfig;
  readonly statusEffectId?: StatusEffectId;
  readonly statusEffectOptions?: StatusEffectApplicationOptions;
  readonly explosionType?: ExplosionType;
  readonly explosionRadius?: number;
  /** When set with arcType "chainLightning", damage chains to nearby targets (e.g. other units). */
  readonly chainRadius?: number;
  readonly chainJumps?: number;
  /** Damage per chain hit; used for chain and, when set, for the first target instead of enemy baseDamage. */
  readonly damage?: number;
  readonly damageOptions?: DamageApplicationOptions;
}

export interface EnemyProjectileConfig extends UnitProjectileVisualConfig {
  /** Overrides enemy baseDamage for projectile hits only. */
  readonly damage?: number;
  readonly statusEffectId?: StatusEffectId;
  readonly statusEffectOptions?: StatusEffectApplicationOptions;
  readonly attackSeries?: AttackSeriesConfig;
  readonly destroyOnHit?: boolean;
  readonly targetHitCooldownMs?: number;
}

export interface EnemyTargetingOptions {
  readonly avoidSharedTargets?: boolean;
  readonly skipTargetsWithEffects?: readonly StatusEffectId[];
  readonly searchPadding?: number;
}

export interface OctopusTentacleTipGlowConfig {
  readonly radius: number;
  readonly segments?: number;
  readonly fill: RendererFillConfig;
}

export interface OctopusTentacleConfig {
  readonly spines: readonly (readonly { x: number; y: number; width: number }[])[];
  readonly segmentsPerTentacle: number;
  readonly anim: RendererLayerAnimationConfig;
  readonly fill: RendererFillConfig;
  readonly stroke?: RendererStrokeConfig;
  readonly buildOpts?: { epsilon?: number; winding?: "CW" | "CCW" };
  readonly tipGlow?: OctopusTentacleTipGlowConfig;
}

export interface EnemyConfig {
  readonly name: string;
  readonly renderer: EnemyRendererConfig;
  readonly tentacles?: OctopusTentacleConfig;
  readonly maxHp: number;
  readonly armor: number;
  readonly baseDamage: number;
  readonly attackInterval: number; // seconds
  readonly attackRange?: number;
  readonly moveSpeed: number;
  readonly physicalSize: number;
  /** Multiplier for the global drag coefficient (default 1). Higher = more air resistance. */
  readonly dragMultiplier?: number;
  /** When true, enemy never rotates (e.g. static structures). */
  readonly lockRotation?: boolean;
  readonly reward?: ResourceAmount;
  readonly soulRewardBase?: number;
  readonly emitter?: ParticleEmitterConfig;
  readonly projectile?: EnemyProjectileConfig; // Якщо вказано - ворог стріляє снарядами, якщо ні - instant damage
  /** Мінімальний segmentIndex для стрілянини снарядами (тільки кінчики тентаклів) */
  readonly projectileMinSegmentIndex?: number;
  readonly projectileVolley?: {
    readonly count: number;
    readonly spreadAngleDeg: number;
  };
  readonly explosionAttack?: {
    readonly radius: number;
    readonly damageMultiplier?: number;
    readonly explosionType?: ExplosionType;
    readonly explosionRadius?: number;
    readonly statusEffectId?: StatusEffectId;
    readonly statusEffectOptions?: StatusEffectApplicationOptions;
  };
  readonly arcAttack?: EnemyArcAttackConfig;
  readonly targeting?: EnemyTargetingOptions;
  /** Нокбек при контактній/млійній атаці та arc/explosion атаках */
  readonly knockBackDistance?: number;
  readonly knockBackSpeed?: number;
  /** Нокбек саме від попадання снаряда; якщо не задано — використовуються knockBackDistance / knockBackSpeed */
  readonly projectileKnockBackDistance?: number;
  readonly projectileKnockBackSpeed?: number;
  readonly selfKnockBackDistance?: number; // Відстань knockback для ворога при отриманні урону
  readonly selfKnockBackSpeed?: number; // Швидкість knockback для ворога при отриманні урону
  readonly requireDestruction?: boolean;
  /** When true, player units cannot pass through this enemy. */
  readonly blocksUnits?: boolean;
  /** When true, this enemy deals counter damage to attacking units (like bricks). */
  readonly contactDamage?: boolean;
  readonly meleeHitExplosion?: {
    readonly type: ExplosionType;
    readonly radius?: number;
  };
  readonly spawner?: {
    readonly spawnRate: number;
    readonly enemyTypes: readonly MapEnemySpawnTypeConfig[];
    readonly levelOffset?: number;
    readonly maxConcurrent?: number;
  };
}

const BASIC_ENEMY_VERTICES: readonly SceneVector2[] = [
  { x: 0, y: -12 },
  { x: 8, y: -6 },
  { x: 8, y: 6 },
  { x: 0, y: 12 },
  { x: -8, y: 6 },
  { x: -8, y: -6 },
];

const FAST_ENEMY_VERTICES: readonly SceneVector2[] = [
  { x: 0, y: -10 },
  { x: 6, y: -5 },
  { x: 6, y: 5 },
  { x: 0, y: 10 },
  { x: -6, y: 5 },
  { x: -6, y: -5 },
];

const TANK_ENEMY_VERTICES: readonly SceneVector2[] = [
  { x: 0, y: -16 },
  { x: 12, y: -8 },
  { x: 12, y: 8 },
  { x: 0, y: 16 },
  { x: -12, y: 8 },
  { x: -12, y: -8 },
];

const TURRET_ENEMY_VERTICES_FB: readonly SceneVector2[] = [
  { x: 0, y: -18 },
  { x: 14, y: -10 },
  { x: 14, y: 10 },
  { x: 0, y: 18 },
  { x: -14, y: 10 },
  { x: -14, y: -10 },
];

const TURRET_ENEMY_VERTICES: readonly SceneVector2[] = [
  /*
    { x: -14, y: -2 },
    { x: -2, y: -4 },
    { x: 0, y: -9 },
    { x: 8, y: -11 },
    { x: 8, y: -5 },
    { x: 4, y: 0 },
    { x: 8, y: 5 },
    { x: 8, y: 11 },
    { x: 0, y: 9 },
    { x: -2, y: 4 },
    { x: -14, y: 2 },*/
  { x: 14, y: -2 },
  { x: -14, y: -10 },
  { x: -14, y: 10 },
  { x: 14, y: 2 },
];

const PORTAL_SPAWNER_VERTICES: readonly SceneVector2[] = [
  { x: -16, y: -16 },
  { x: 16, y: -16 },
  { x: 16, y: 16 },
  { x: -16, y: 16 },
];

const ENEMIES_DB: Record<EnemyType, EnemyConfig> = {
  basicEnemy: {
    name: "Basic Enemy",
    renderer: {
      kind: "polygon",
      fill: { r: 0.8, g: 0.2, b: 0.2, a: 1 },
      stroke: {
        color: { r: 0.9, g: 0.3, b: 0.3, a: 1 },
        width: 1.5,
      },
      vertices: BASIC_ENEMY_VERTICES,
    },
    maxHp: 20,
    armor: 2,
    baseDamage: 4,
    attackInterval: 1.2,
    attackRange: 240,
    moveSpeed: 30,
    physicalSize: 14,
    soulRewardBase: 1,
    reward: normalizeResourceAmount({
      stone: 1,
    }),
  },
  fastEnemy: {
    name: "Fast Enemy",
    renderer: {
      kind: "polygon",
      fill: { r: 0.9, g: 0.6, b: 0.2, a: 1 },
      stroke: {
        color: { r: 1, g: 0.7, b: 0.3, a: 1 },
        width: 1.5,
      },
      vertices: FAST_ENEMY_VERTICES,
    },
    maxHp: 120,
    armor: 1,
    baseDamage: 300,
    attackInterval: 0.8,
    attackRange: 200,
    moveSpeed: 50,
    physicalSize: 12,
    soulRewardBase: 1,
    reward: normalizeResourceAmount({
      stone: 1,
    }),
  },
  tankEnemy: {
    name: "Tank Enemy",
    renderer: {
      kind: "composite",
      fill: { r: 0.6, g: 0.5, b: 0.3, a: 1 },
      layers: [
        {
          shape: "sprite",
          width: 18,
          height: 18,
          spritePath: "tank_enemy_part0.png",
          offset: { x: 9, y: 0 },
        },
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: -6, width: 2.6 },
            { x: -4, y: -6.5, width: 2.3 },
            { x: -7, y: -7.5, width: 2.0 },
            { x: -9, y: -9, width: 1.7 },
            { x: -10, y: -11, width: 1.4 },
            { x: -11, y: -11, width: 1.0 },
          ],
          {
            fill: { type: "base", brightness: -0.1 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 2,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 6, width: 2.6 },
            { x: -4, y: 6.5, width: 2.3 },
            { x: -7, y: 7.5, width: 2.0 },
            { x: -9, y: 9, width: 1.7 },
            { x: -10, y: 11, width: 1.4 },
            { x: -11, y: 11, width: 1.0 },
          ],
          {
            fill: { type: "base", brightness: -0.1 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 2,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
      ],
    },
    maxHp: 500,
    armor: 50,
    baseDamage: 600,
    attackInterval: 1.8,
    attackRange: 280,
    moveSpeed: 20,
    physicalSize: 18,
    soulRewardBase: 2,
    reward: {
      stone: 2,
    },
    // Приклад конфігурації снаряда для танка
    projectile: {
      radius: 8,
      speed: 200,
      lifetimeMs: 2000,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.5, g: 0.5, b: 1, a: 1 },
      },
      shape: "circle",
      hitRadius: 10,
    },
  },
  spectreEnemy: {
    name: "Spectre",
    renderer: {
      kind: "composite",
      fill: { r: 0.9, g: 0.8, b: 0.6, a: 1 },
      layers: [
        // Chord
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 20, y: 0 },
            { x: 14, y: -3 },
            { x: 14, y: 3 },
          ],
        },
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 14, y: -3 },
            { x: 10, y: -8 },
            { x: 10, y: 8 },
            { x: 14, y: 3 },
          ],
        },
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 10, y: -1 },
            { x: -14, y: -2 },
            { x: -14, y: 2 },
            { x: 10, y: 1 },
          ],
        },
        {
          shape: "circle",
          radius: 32,
          segments: 48,
          offset: { x: 0, y: 0 },
          fill: {
            type: "gradient",

            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              end: 32,
              stops: [
                { offset: 0, color: { r: 1, g: 1, b: 1, a: 0.45 } },
                { offset: 0.6, color: { r: 1, g: 1, b: 1, a: 0.3 } },
                { offset: 1, color: { r: 1.0, g: 0.9, b: 0.8, a: 0.0 } },
              ],
            },
          },
        },
        /*
            ...mapLineToPolygonShape<Omit<EnemyRendererLayerConfig, "shape" | "vertices">>(
                [{ x: 0, y: -3, width: 1.2 }, {x: 1, y: -8, width: 1.0}, { x: 2, y: -10, width: 0.8}, { x: 3, y: -12, width: 0.6}, { x: 4, y: -14, width: 0.5}, { x: 6, y: -18, width: 0.4}],
                { fill: { type: "base", brightness: 0.3 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 2, falloff: "tip", axis: "normal", phase: 1.1 } },
                { epsilon: 0.25, winding: "CCW" }
              ),

              ...mapLineToPolygonShape<Omit<EnemyRendererLayerConfig, "shape" | "vertices">>(
                [{ x: 0, y: 3, width: 1.2 }, {x: 1, y: 8, width: 1.0}, { x: 2, y: 10, width: 0.8}, { x: 3, y: 12, width: 0.6 }, { x: 4, y: 14, width: 0.5 }, { x: 6, y: 18, width: 0.4}],
                { fill: { type: "base", brightness: 0.3 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 2, falloff: "tip", axis: "normal", phase: 1.1 } },
                { epsilon: 0.25, winding: "CCW" }
              ),*/
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: -2, width: 1.2 },
            { x: 0, y: -8, width: 1.0 },
            { x: 2.5, y: -14, width: 0.8 },
            { x: 2.5, y: -19, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -5, y: -2, width: 1.2 },
            { x: -6, y: -8, width: 1.0 },
            { x: -4, y: -14, width: 0.8 },
            { x: -5, y: -20, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -11, y: -2, width: 1.2 },
            { x: -13, y: -8, width: 1.0 },
            { x: -13, y: -14, width: 0.8 },
            { x: -16, y: -19, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),

        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 2, width: 1.2 },
            { x: 0, y: 8, width: 1.0 },
            { x: 2.5, y: 14, width: 0.8 },
            { x: 2.5, y: 19, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -5, y: 2, width: 1.2 },
            { x: -6, y: 8, width: 1.0 },
            { x: -4, y: 14, width: 0.8 },
            { x: -5, y: 20, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -11, y: 2, width: 1.2 },
            { x: -13, y: 8, width: 1.0 },
            { x: -13, y: 14, width: 0.8 },
            { x: -16, y: 19, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
      ],
    },
    maxHp: 2500,
    armor: 100,
    baseDamage: 400,
    soulRewardBase: 1,
    attackInterval: 1.8,
    attackRange: 280,
    moveSpeed: 75,
    physicalSize: 30,
    reward: {
      stone: 2,
    },
    projectile: {
      radius: 6,
      speed: 200,
      lifetimeMs: 2000,
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        stops: [
          { offset: 0, color: { r: 0.8, g: 0.9, b: 1, a: 1 } },
          { offset: 1, color: { r: 0.8, g: 0.9, b: 1, a: 0 } },
        ],
      },
      shape: "circle",
      hitRadius: 10,
      explosion: "iceBrickHit",
    },
    knockBackDistance: 80,
    knockBackSpeed: 120,
  },
  coalConvoyGuardian: {
    name: "Coal Convoy Guardian",
    renderer: {
      kind: "composite",
      fill: { r: 1, g: 0.7, b: 0.6, a: 1 },
      layers: [
        // Spike
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 24, y: 0 },
            { x: 10, y: -3 },
            { x: 10, y: 3 },
          ],
        },
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 10, y: -3 },
            { x: 10, y: 3 },
            { x: -5, y: 1 },
            { x: -5, y: -1 },
          ],
        },
        {
          shape: "circle",
          radius: 32,
          segments: 48,
          offset: { x: 0, y: 0 },
          fill: {
            type: "gradient",

            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              end: 32,
              stops: [
                { offset: 0, color: { r: 1, g: 0.8, b: 0.6, a: 0.45 } },
                { offset: 0.6, color: { r: 1, g: 0.8, b: 0.6, a: 0.3 } },
                { offset: 1, color: { r: 1.0, g: 0.8, b: 0.6, a: 0.0 } },
              ],
            },
          },
        },
        // Left side
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 10, y: -2, width: 1.2 },
            { x: 5, y: -8, width: 1.0 },
            { x: 0, y: -22, width: 0.8 },
            { x: -5, y: -26, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 10, y: -2, width: 1.2 },
            { x: 3, y: -8, width: 1.0 },
            { x: -4, y: -18, width: 0.8 },
            { x: -11, y: -21, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 10, y: -2, width: 1.2 },
            { x: 0, y: -8, width: 1.0 },
            { x: -10, y: -16, width: 0.8 },
            { x: -20, y: -18, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 5,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -5, y: 0, width: 1.2 },
            { x: -15, y: -8, width: 1.0 },
            { x: -20, y: -8, width: 0.8 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 5,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),

        // Right side
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 10, y: 2, width: 1.2 },
            { x: 5, y: 8, width: 1.0 },
            { x: 0, y: 22, width: 0.8 },
            { x: -5, y: 26, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 10, y: 2, width: 1.2 },
            { x: 3, y: 8, width: 1.0 },
            { x: -4, y: 18, width: 0.8 },
            { x: -11, y: 21, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 10, y: 2, width: 1.2 },
            { x: 0, y: 8, width: 1.0 },
            { x: -10, y: 16, width: 0.8 },
            { x: -20, y: 18, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -5, y: 0, width: 1.2 },
            { x: -15, y: 8, width: 1.0 },
            { x: -20, y: 8, width: 0.8 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 5,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        
      ],
    },
    maxHp: 25000,
    soulRewardBase: 2,
    armor: 100,
    baseDamage: 1600,
    attackInterval: 0.8,
    attackRange: 520,
    moveSpeed: 60,
    physicalSize: 30,
    reward: {
      stone: 2,
    },
    projectile: {
      radius: 4,
      speed: 200,
      lifetimeMs: 5000,
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        stops: [
          { offset: 0, color: { r: 1, g: 0.9, b: 0.7, a: 1 } },
          { offset: 0.75, color: { r: 1, g: 0.9, b: 0.7, a: 0.8 } },
          { offset: 1, color: { r: 1, g: 0.9, b: 0.7, a: 0 } },
        ],
      },
      tail: {
        lengthMultiplier: 6.0,
        widthMultiplier: 1.0,
        startColor: { r: 1, g: 0.9, b: 0.7, a: 0.11 },
        endColor: { r: 1, g: 0.9, b: 0.7, a: 0 },
      },
      tailEmitter: {
        particlesPerSecond: 490,
        particleLifetimeMs: 550,
        fadeStartMs: 200,
        baseSpeed: 0.05,
        speedVariation: 0.01,
        sizeRange: { min: 4.2, max: 8.4 },
        sizeEvolutionMult: 2.75, // Particles grow from 1x to 1.25x size over lifetime
        spread: Math.PI / 5.5,
        offset: { x: -0.75, y: 0 },
        color: { r: 0.2, g: 0.85, b: 0.95, a: 0.4 },
        fill: {
          fillType: FILL_TYPES.RADIAL_GRADIENT,
          start: { x: 0, y: 0 },
          stops: [
            { offset: 0, color: { r: 1, g: 0.85, b: 0.5, a: 0.1 } },
            { offset: 0.25, color: { r: 1, g: 0.85, b: 0.5, a: 0.05 } },
            { offset: 1, color: { r: 1, g: 0.85, b: 0.5, a: 0 } },
          ],
          noise: {
            colorAmplitude: 0.0,
            alphaAmplitude: 0.02,
            scale: 0.3,
          },
        },
        shape: "circle",
        maxParticles: 100,
      },
      shape: "circle",
      hitRadius: 10,
      explosion: "smallPlasmoid",
    },
    emitter: {
      particlesPerSecond: 90,
      particleLifetimeMs: 750,
      fadeStartMs: 200,
      baseSpeed: 0.05,
      speedVariation: 0.01,
      sizeRange: { min: 14.2, max: 28.4 },
      sizeEvolutionMult: 1.75, // Particles grow from 1x to 1.25x size over lifetime
      spread: Math.PI / 5.5,
      offset: { x: -0.75, y: 0 },
      color: { r: 0.2, g: 0.85, b: 0.95, a: 0.4 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: { x: 0, y: 0 },
        stops: [
          { offset: 0, color: { r: 1, g: 0.75, b: 0.6, a: 0.1 } },
          { offset: 0.25, color: { r: 1, g: 0.75, b: 0.6, a: 0.05 } },
          { offset: 1, color: { r: 1, g: 0.75, b: 0.6, a: 0 } },
        ],
        noise: {
          colorAmplitude: 0.0,
          alphaAmplitude: 0.02,
          scale: 0.3,
        },
      },
      shape: "circle",
      maxParticles: 100,
    },
    knockBackDistance: 80,
    knockBackSpeed: 120,
  },
  silverKeeperEnemy: {
    name: "Silver Keeper",
    renderer: {
      kind: "composite",
      fill: { r: 0.7, g: 0.75, b: 0.8, a: 1 },
      layers: [
        // Head
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 24, y: 0 },
            { x: 20, y: -5 },
            { x: 16, y: -5 },
            { x: 16, y: 5 },
            { x: 20, y: 5 },
          ],
        },
        // Tentacles Left
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 18, y: -3, width: 2.5 },
            { x: 22, y: -8, width: 2.1 },
            { x: 29, y: -9, width: 1.8 },
            { x: 34, y: -12, width: 1.4 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
            groupId: "silverKeeperLeft",
            connectionSlots: [{ id: "silverKeeperTentacle_left", mode: "spine", t: 1 }],
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        {
          shape: "circle",
          radius: 8,
          segments: 32,
          offset: { x: 0, y: 0 },
          join: { anchorId: "silverKeeperTentacle_left", targetGroupId: "silverKeeperLeft" },
          fill: {
            type: "gradient",

            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              stops: [
                { offset: 0, color: { r: 0.9, g: 0.8, b: 1.0, a: 0.75 } },
                { offset: 0.6, color: { r: 0.9, g: 0.8, b: 1, a: 0.2 } },
                { offset: 1, color: { r: 0.9, g: 0.8, b: 1, a: 0.0 } },
              ],
            },
          },
        },

        // Tentacles Right
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 18, y: 3, width: 2.5 },
            { x: 22, y: 8, width: 2.1 },
            { x: 29, y: 9, width: 1.8 },
            { x: 34, y: 12, width: 1.4 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
            groupId: "silverKeeperRight",
            connectionSlots: [{ id: "silverKeeperTentacle_right", mode: "spine", t: 1 }],
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        {
          shape: "circle",
          radius: 8,
          segments: 32,
          offset: { x: 0, y: 0 },
          join: { anchorId: "silverKeeperTentacle_right", targetGroupId: "silverKeeperRight" },
          fill: {
            type: "gradient",

            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              stops: [
                { offset: 0, color: { r: 0.9, g: 0.8, b: 1.0, a: 0.75 } },
                { offset: 0.6, color: { r: 0.9, g: 0.8, b: 1, a: 0.2 } },
                { offset: 1, color: { r: 0.9, g: 0.8, b: 1, a: 0.0 } },
              ],
            },
          },
        },
        // tail
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 17, y: 0, width: 3.5 },
            { x: 10, y: -3, width: 3.1 },
            { x: -4, y: 3, width: 2.8 },
            { x: -16, y: -2, width: 2.4 },
            { x: -25, y: 1, width: 1.2 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
            groupId: "silverKeeperTail",
            connectionSlots: [
              { id: "silverKeeperTail1", mode: "spine", t: 0.25 },
              { id: "silverKeeperTail2", mode: "spine", t: 0.5 },
              { id: "silverKeeperTail3", mode: "spine", t: 0.75 },
            ],
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        // Tail sprout 1 — left
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 0, width: 1.8 },
            { x: -7, y: -6, width: 1.3 },
            { x: -9, y: -11, width: 0.8 },
            { x: -11, y: -16, width: 0.4 },
          ],
          {
            fill: { type: "base", brightness: 0.4 },
            anim: {
              type: "sway",
              periodMs: 1100,
              amplitude: 4,
              falloff: "tip",
              axis: "normal",
              phase: 0.0,
            },
            join: { anchorId: "silverKeeperTail1", targetGroupId: "silverKeeperTail" },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        // Tail sprout 1 — right
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 0, width: 1.8 },
            { x: -7, y: 6, width: 1.3 },
            { x: -9, y: 11, width: 0.8 },
            { x: -11, y: 16, width: 0.4 },
          ],
          {
            fill: { type: "base", brightness: 0.4 },
            anim: {
              type: "sway",
              periodMs: 1100,
              amplitude: 4,
              falloff: "tip",
              axis: "normal",
              phase: 0.5,
            },
            join: { anchorId: "silverKeeperTail1", targetGroupId: "silverKeeperTail" },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        // Tail sprout 2 — left
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 0, width: 1.6 },
            { x: -7, y: -6, width: 1.3 },
            { x: -11, y: -11, width: 0.8 },
            { x: -14, y: -16, width: 0.4 },
          ],
          {
            fill: { type: "base", brightness: 0.45 },
            anim: {
              type: "sway",
              periodMs: 1000,
              amplitude: 3.5,
              falloff: "tip",
              axis: "normal",
              phase: 0.3,
            },
            join: { anchorId: "silverKeeperTail2", targetGroupId: "silverKeeperTail" },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        // Tail sprout 2 — right
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 0, width: 1.6 },
            { x: -7, y: 6, width: 1.3 },
            { x: -11, y: 11, width: 0.8 },
            { x: -14, y: 16, width: 0.4 },
          ],
          {
            fill: { type: "base", brightness: 0.45 },
            anim: {
              type: "sway",
              periodMs: 1000,
              amplitude: 3.5,
              falloff: "tip",
              axis: "normal",
              phase: 0.8,
            },
            join: { anchorId: "silverKeeperTail2", targetGroupId: "silverKeeperTail" },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        // Tail sprout 3 — left
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 0, width: 1.4 },
            { x: -7, y: -4, width: 1.3 },
            { x: -11, y: -9, width: 0.8 },
            { x: -14, y: -13, width: 0.4 },
          ],
          {
            fill: { type: "base", brightness: 0.5 },
            anim: {
              type: "sway",
              periodMs: 900,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 0.6,
            },
            join: { anchorId: "silverKeeperTail3", targetGroupId: "silverKeeperTail" },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        // Tail sprout 3 — right
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 0, width: 1.4 },
            { x: -7, y: 4, width: 1.3 },
            { x: -11, y: 9, width: 0.8 },
            { x: -14, y: 13, width: 0.4 },
          ],
          {
            fill: { type: "base", brightness: 0.5 },
            anim: {
              type: "sway",
              periodMs: 900,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
            join: { anchorId: "silverKeeperTail3", targetGroupId: "silverKeeperTail" },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        
      ],
    },
    maxHp: 12500,
    soulRewardBase: 2,
    armor: 1000,
    baseDamage: 0,
    attackInterval: 1.8,
    attackRange: 280,
    moveSpeed: 60,
    physicalSize: 30,
    reward: {
      silver: 10,
    },
    arcAttack: {
      arcType: "silverKeeper",
      spawnOffset: { x: 20, y: 0 },
      chainRadius: 150,
      chainJumps: 3,
      damage: 650,
      damageOptions: {
        rewardMultiplier: 1.0,
        armorPenetration: 0,
        skipKnockback: true,
      },
    },
    emitter: {
      particlesPerSecond: 90,
      particleLifetimeMs: 750,
      fadeStartMs: 200,
      baseSpeed: 0.05,
      speedVariation: 0.01,
      sizeRange: { min: 14.2, max: 28.4 },
      sizeEvolutionMult: 1.75, // Particles grow from 1x to 1.25x size over lifetime
      spread: Math.PI / 5.5,
      offset: { x: -0.75, y: 0 },
      color: { r: 0.2, g: 0.85, b: 0.95, a: 0.4 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: { x: 0, y: 0 },
        stops: [
          { offset: 0, color: { r: 0.9, g: 0.8, b: 1, a: 0.1 } },
          { offset: 0.25, color: { r: 0.9, g: 0.8, b: 1, a: 0.05 } },
          { offset: 1, color: { r: 0.9, g: 0.8, b: 1, a: 0 } },
        ],
        noise: {
          colorAmplitude: 0.0,
          alphaAmplitude: 0.02,
          scale: 0.3,
        },
      },
      shape: "circle",
      maxParticles: 100,
    },
    knockBackDistance: 80,
    knockBackSpeed: 120,
  },
  encagedBeastEnemy: {
    name: "Encaged Beast",
    renderer: {
      kind: "composite",
      fill: { r: 0.9, g: 0.7, b: 0.8, a: 1 },
      layers: [
        // Chord
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 0, y: 0 },
            { x: -7, y: -6 },
            { x: -7, y: 6 },
          ],
        },
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: -6, y: -3 },
            { x: -10, y: -8 },
            { x: -20, y: -8 },
            { x: -24, y: -3 },
            { x: -24, y: 3 },
            { x: -20, y: 8 },
            { x: -10, y: 8 },
            { x: -6, y: 3 },
          ],
        },
        {
          shape: "circle",
          radius: 42,
          segments: 48,
          offset: { x: 0, y: 0 },
          fill: {
            type: "gradient",

            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              end: 32,
              stops: [
                { offset: 0, color: { r: 1, g: 0.8, b: 1, a: 0.45 } },
                { offset: 0.6, color: { r: 1, g: 0.8, b: 1, a: 0.3 } },
                { offset: 1, color: { r: 1.0, g: 0.7, b: 0.8, a: 0.0 } },
              ],
            },
          },
        },
        
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -4, y: 3, width: 4.6 },
            { x: -1, y: 4, width: 4.6 },
            { x: 7, y: 5, width: 4.4 },
            { x: 12, y: 7, width: 3.9 },
            { x: 16, y: 10, width: 3.6 },
            { x: 18, y: 13, width: 3.3 },
            { x: 19, y: 16, width: 2.6 },
            { x: 18, y: 19, width: 2.4 },
            { x: 16, y: 22, width: 2.2 },
            { x: 12, y: 25, width: 2.0 },
            { x: 7, y: 26, width: 1.8 },
            { x: 2, y: 27, width: 1.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -4, y: -3, width: 4.6 },
            { x: -1, y: -4, width: 4.6 },
            { x: 7, y: -5, width: 4.4 },
            { x: 12, y: -7, width: 3.9 },
            { x: 16, y: -10, width: 3.6 },
            { x: 18, y: -13, width: 3.3 },
            { x: 19, y: -16, width: 2.6 },
            { x: 18, y: -19, width: 2.4 },
            { x: 16, y: -22, width: 2.2 },
            { x: 12, y: -25, width: 2.0 },
            { x: 7, y: -26, width: 1.8 },
            { x: 2, y: -27, width: 1.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -24, y: -3, width: 1.9 },
            { x: -29, y: -8, width: 1.6 },
            { x: -31, y: -14, width: 1.3 },
            { x: -35, y: -19, width: 1.0 },
            { x: -38, y: -23, width: 0.8 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -20, y: -8, width: 1.9 },
            { x: -21, y: -14, width: 1.6 },
            { x: -24, y: -18, width: 1.3 },
            { x: -25, y: -22, width: 1.0 },
            { x: -28, y: -26, width: 0.8 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),

        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -24, y: 3, width: 1.9 },
            { x: -29, y: 8, width: 1.6 },
            { x: -31, y: 14, width: 1.3 },
            { x: -35, y: 19, width: 1.0 },
            { x: -38, y: 23, width: 0.8 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -20, y: 8, width: 1.9 },
            { x: -21, y: 14, width: 1.6 },
            { x: -24, y: 18, width: 1.3 },
            { x: -25, y: 22, width: 1.0 },
            { x: -28, y: 26, width: 0.8 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
      ],
    },
    maxHp: 25000,
    armor: 100,
    baseDamage: 600,
    attackInterval: 1.8,
    attackRange: 40,
    moveSpeed: 20,
    physicalSize: 35,
    soulRewardBase: 3,
    reward: {
      stone: 2000,
      iron: 200,
    },
    /*
    projectile: {
      radius: 6,
      speed: 200,
      lifetimeMs: 2000,
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        stops: [
          { offset: 0, color: { r: 0.8, g: 0.9, b: 1, a: 1 } },
          { offset: 1, color: { r: 0.8, g: 0.9, b: 1, a: 0 } },
        ],
      },
      shape: "circle",
      hitRadius: 10,
      explosion: "iceBrickHit",
    },*/
    knockBackDistance: 80,
    knockBackSpeed: 120,
  },
  turretEnemy: {
    name: "Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.6, g: 0.6, b: 0.6, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: 0, y: -4 },
            { x: 0, y: 4 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -3, y: -8 },
            { x: -3, y: 8 },
            { x: 0, y: 4 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: -8 },
            { x: -9, y: -11 },
            { x: -9, y: -5 },
            { x: -3, y: 3 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: 8 },
            { x: -9, y: 11 },
            { x: -9, y: 5 },
            { x: -3, y: -3 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
      ],
    },
    maxHp: 175,
    armor: 14,
    baseDamage: 34,
    attackInterval: 1.5,
    attackRange: 400,
    moveSpeed: 0, // Статична турель
    physicalSize: 30,
    reward: normalizeResourceAmount({
      stone: 20,
      iron: 4,
    }),
    projectile: {
      radius: 5,
      speed: 150,
      lifetimeMs: 2500,
      statusEffectId: "poison",
      statusEffectOptions: {
        durationMs: 5000,
        damagePerSecond: 6,
      },
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.6, g: 0.6, b: 0.4, a: 1 },
      },
      shape: "circle",
      hitRadius: 8,
      damageRadius: 34,
      explosion: "smallCannon", // Тип експлозії при влучанні снаряда
    },
    knockBackDistance: 120,
    knockBackSpeed: 160,
  },
  burstTurretEnemy: {
    name: "Burst Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.55, g: 0.8, b: 0.7, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 30,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.55, g: 0.8, b: 0.7, a: 0.4 } },
                { offset: 1, color: { r: 0.55, g: 0.8, b: 0.7, a: 0 } },
              ],
            }
          }
        },
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: 0, y: -4 },
            { x: 0, y: 4 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: 0.25 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -3, y: -8 },
            { x: -3, y: 8 },
            { x: 0, y: 4 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: -8 },
            { x: -9, y: -11 },
            { x: -9, y: -5 },
            { x: -3, y: 3 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: 8 },
            { x: -9, y: 11 },
            { x: -9, y: 5 },
            { x: -3, y: -3 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
      ],
    },
    maxHp: 7500,
    armor: 400,
    baseDamage: 240,
    attackInterval: 2.5,
    attackRange: 400,
    moveSpeed: 0, // Статична турель
    physicalSize: 30,
    reward: normalizeResourceAmount({
      stone: 50,
      iron: 10,
    }),
    projectile: {
      radius: 12,
      speed: 130,
      lifetimeMs: 4500,
      damageRadius: 18,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.6, g: 0.6, b: 0.4, a: 1 },
      },
      shape: "sprite",
      spriteName: "energetic_strike",
      hitRadius: 8,
      explosion: "smallEnergetic",
      attackSeries: {
        shots: 3,
        intervalMs: 200,
      },
      tail: {
        lengthMultiplier: 4.0,
        widthMultiplier: 1.0,
        startColor: { r: 0.6, g: 0.8, b: 0.8, a: 0.11 },
        endColor: { r: 0.6, g: 0.8, b: 0.8, a: 0 },
      },
      tailEmitter: {
        baseSpeed: 0.03,
        speedVariation: 0.0,
        particleLifetimeMs: 600,
        fadeStartMs: 700,
        color: { r: 1, g: 0.85, b: 0.55, a: 1 },
        arc: Math.PI * 0.15,
        direction: 0,
        particlesPerSecond: 1000,
        sizeRange: { min: 14.5, max: 18.4 },
        spawnRadius: { min: 0, max: 0.1 },
        spawnRadiusMultiplier: 1.25,
        sizeEvolutionMult: 2.0,
        fill: {
          fillType: FILL_TYPES.RADIAL_GRADIENT,
          stops: [
            { offset: 0, color: { r: 0.4, g: 0.9, b: 0.8, a: 0.05 } },
            { offset: 1, color: { r: 0.4, g: 0.9, b: 0.8, a: 0 } },
          ],
          noise: {
            colorAmplitude: 0.0,
            alphaAmplitude: 0.003,
            scale: 0.35,
          },
        },
        maxParticles: 1000,
      },
    },
    knockBackDistance: 120,
    knockBackSpeed: 160,
  },
  volleyTurretEnemy: {
    name: "Volley Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.55, g: 0.7, b: 0.5, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: 0, y: -4 },
            { x: 0, y: 4 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: 0.25 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -3, y: -8 },
            { x: -3, y: 8 },
            { x: 0, y: 4 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: -8 },
            { x: -9, y: -11 },
            { x: -9, y: -5 },
            { x: -3, y: 3 },
          ],
          fill: { type: "base", brightness: 0.15 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: 8 },
            { x: -9, y: 11 },
            { x: -9, y: 5 },
            { x: -3, y: -3 },
          ],
          fill: { type: "base", brightness: 0.15 },
        },
      ],
    },
    maxHp: 3135,
    armor: 9,
    baseDamage: 240,
    attackInterval: 1.4,
    attackRange: 380,
    moveSpeed: 0,
    physicalSize: 30,
    reward: normalizeResourceAmount({
      stone: 550,
      copper: 120,
    }),
    projectile: {
      radius: 9,
      speed: 170,
      lifetimeMs: 2200,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.5, g: 0.8, b: 0.75, a: 0.2 },
      },
      shape: "sprite",
      spriteName: "needle",
      hitRadius: 7,
      explosion: "smallCannonGrey",
      ringTrail: {
        spawnIntervalMs: 60,
        lifetimeMs: 820,
        startRadius: 5,
        endRadius: 21,
        startAlpha: 0.065,
        endAlpha: 0,
        innerStop: 0.46,
        outerStop: 0.76,
        color: { r: 0.5, g: 0.7, b: 0.75, a: 0.08 },
      },
      tail: {
        lengthMultiplier: 4.0,
        widthMultiplier: 1.0,
        startColor: { r: 0.5, g: 0.6, b: 0.6, a: 0.11 },
        endColor: { r: 0.5, g: 0.6, b: 0.6, a: 0 },
      },
    },
    projectileVolley: {
      count: 5,
      spreadAngleDeg: 12,
    },
    knockBackDistance: 110,
    knockBackSpeed: 130,
    projectileKnockBackDistance: 40,
    projectileKnockBackSpeed: 10,
  },
  wheelVolleyTurretEnemy: {
    name: "Wheel Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.55, g: 0.7, b: 0.5, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: 0, y: -4 },
            { x: 0, y: 4 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: 0.25 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -3, y: -8 },
            { x: -3, y: 8 },
            { x: 0, y: 4 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: -8 },
            { x: -9, y: -11 },
            { x: -9, y: -5 },
            { x: -3, y: 3 },
          ],
          fill: { type: "base", brightness: 0.15 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: 8 },
            { x: -9, y: 11 },
            { x: -9, y: 5 },
            { x: -3, y: -3 },
          ],
          fill: { type: "base", brightness: 0.15 },
        },
      ],
    },
    maxHp: 3135,
    armor: 9,
    baseDamage: 240,
    attackInterval: 1.4,
    attackRange: 380,
    moveSpeed: 0,
    physicalSize: 30,
    reward: normalizeResourceAmount({
      stone: 550,
      copper: 120,
    }),
    projectile: {
      radius: 9,
      speed: 170,
      lifetimeMs: 2200,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.5, g: 0.8, b: 0.75, a: 0.2 },
      },
      shape: "sprite",
      spriteName: "needle",
      hitRadius: 7,
      explosion: "smallCannonGrey",
      ringTrail: {
        spawnIntervalMs: 60,
        lifetimeMs: 820,
        startRadius: 5,
        endRadius: 21,
        startAlpha: 0.065,
        endAlpha: 0,
        innerStop: 0.46,
        outerStop: 0.76,
        color: { r: 0.5, g: 0.7, b: 0.75, a: 0.08 },
      },
      tail: {
        lengthMultiplier: 4.0,
        widthMultiplier: 1.0,
        startColor: { r: 0.5, g: 0.6, b: 0.6, a: 0.11 },
        endColor: { r: 0.5, g: 0.6, b: 0.6, a: 0 },
      },
    },
    projectileVolley: {
      count: 5,
      spreadAngleDeg: 12,
    },
    knockBackDistance: 110,
    knockBackSpeed: 130,
    projectileKnockBackDistance: 40,
    projectileKnockBackSpeed: 10,
  },
  explosionTurretEnemy: {
    name: "Blast Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.75, g: 0.55, b: 0.85, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 30,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.75, g: 0.55, b: 0.85, a: 0.8 } },
                { offset: 1, color: { r: 0.75, g: 0.55, b: 0.85, a: 0 } },
              ],
            }
          }
        },
        {
          shape: "circle",
          radius: 20,
          fill: {
            type: "base",
            brightness: 0.0,
          }
        },
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: -14, y: -2 },
            { x: -14, y: 2 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: 0.25 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 2, y: -14 },
            { x: -2, y: -14 },
            { x: -2, y: 14 },
            { x: 2, y: 14 },
          ],
          fill: { type: "base", brightness: 0.25 },
        },
        
      ],
    },
    maxHp: 2140,
    armor: 30,
    baseDamage: 160,
    attackInterval: 3.2,
    attackRange: 320,
    moveSpeed: 0,
    physicalSize: 30,
    reward: normalizeResourceAmount({
      stone: 60,
      iron: 14,
    }),
    explosionAttack: {
      radius: 320,
      damageMultiplier: 1,
      explosionType: "magnetic",
      explosionRadius: 60,
    },
    knockBackDistance: 140,
    knockBackSpeed: 140,
  },
  freezeTurretEnemy: {
    knockBackDistance: 160,
    knockBackSpeed: 160,
    name: "Freeze Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.55, g: 0.75, b: 0.95, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: 0, y: -4 },
            { x: 0, y: 4 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: 0.25 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -3, y: -8 },
            { x: -3, y: 8 },
            { x: 0, y: 4 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: -8 },
            { x: -9, y: -11 },
            { x: -9, y: -5 },
            { x: -3, y: 3 },
          ],
          fill: { type: "base", brightness: 0.15 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: 8 },
            { x: -9, y: 11 },
            { x: -9, y: 5 },
            { x: -3, y: -3 },
          ],
          fill: { type: "base", brightness: 0.15 },
        },
      ],
    },
    maxHp: 140,
    armor: 10,
    baseDamage: 0,
    attackInterval: 1.8,
    attackRange: 1600,
    moveSpeed: 0,
    physicalSize: 26,
    reward: normalizeResourceAmount({
      stone: 30,
      sand: 5,
    }),
    arcAttack: {
      arcType: "freeze",
      statusEffectId: "freeze",
      statusEffectOptions: {
        speedMultiplier: 0.3,
        durationMs: 2000,
      },
    },
    targeting: {
      avoidSharedTargets: true,
      skipTargetsWithEffects: ["freeze"],
      searchPadding: 200,
    },
  },
  bleedingTurretEnemy: {
    knockBackDistance: 160,
    knockBackSpeed: 160,
    name: "Bleeding Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.7, g: 0.45, b: 0.50, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 50,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.9, g: 0.55, b: 0.35, a: 0.2 } },
                { offset: 0.6, color: { r: 0.9, g: 0.55, b: 0.35, a: 0.4 } },
                { offset: 1, color: { r: 0.9, g: 0.55, b: 0.35, a: 0 } },
              ],
            }
          }
        },
        {
          shape: "polygon",
          vertices: [
            { x: 18, y: -3 },
            { x: 0, y: -4 },
            { x: 0, y: 4 },
            { x: 18, y: 3 },
          ],
          fill: { type: "base", brightness: -0.7 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -6, y: -14 },
            { x: -13, y: -14 },
            { x: -13, y: 14 },
            { x: -6, y: 14 },
            { x: 0, y: 4 },
          ],
          fill: { type: "base", brightness: 0.12 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 12, y: -14 },
            { x: -4, y: -22 },
            { x: -25, y: -22 },
            { x: -21, y: -14 },
          ],
          fill: { type: "base", brightness: -0.42 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 12, y: 14 },
            { x: -4, y: 22 },
            { x: -25, y: 22 },
            { x: -21, y: 14 },
          ],
          fill: { type: "base", brightness: -0.42 },
        },
      ],
    },
    maxHp: 25000,
    armor: 1000,
    baseDamage: 0,
    attackInterval: 1.8,
    attackRange: 1600,
    moveSpeed: 0,
    physicalSize: 26,
    reward: normalizeResourceAmount({
      iron: 32,
      coal: 6,
    }),
    arcAttack: {
      arcType: "bleeding",
      statusEffectId: "bleeding",
      statusEffectOptions: {
        damagePerSecond: 124,
        durationMs: 4000,
      },
      spawnOffset: { x: 18, y: 0 },
    },
    targeting: {
      avoidSharedTargets: true,
      searchPadding: 200,
    },
  },

  snakeEnemy: {
    name: "Snake",
    renderer: {
      kind: "composite",
      fill: { r: 0.38, g: 0.62, b: 0.22, a: 1 },
      layers: [
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            /*{ x: 18, y: 0, width: 7 },
            { x: 12, y: 0, width: 7 },*/
            { x: 18, y: 0, width: 7 },
            { x: 16, y: 0, width: 7 },
            { x: 14, y: -0.5, width: 7 },
            { x: 12, y: -1.5, width: 7 },
            { x: 10, y: -2.9, width: 7 },
            { x: 8, y: -4, width: 7 },
            { x: 6, y: -4, width: 7 },
            { x: 4, y: -2.9, width: 7 },
            { x: 2, y: -1, width: 6 },
            { x: 0, y: 1, width: 6 },
            { x: -2, y: 2.7, width: 6 },
            { x: -4, y: 3.5, width: 6 },
            { x: -6, y: 3.5, width: 6 },
            { x: -8, y: 2.7, width: 5 },
            { x: -10, y: 1, width: 5 },
            { x: -12, y: -1, width: 5 },
            { x: -14, y: -2.3, width: 5 },
            { x: -16, y: -3, width: 4 },
            { x: -18, y: -3, width: 4 },
            { x: -20, y: -2.3, width: 4 },
            { x: -22, y: -1, width: 4 },
            { x: -24, y: 1, width: 3 },
            { x: -26, y: 2.2, width: 3 },
            { x: -28, y: 3.0, width: 3 },
            { x: -30, y: 3.0, width: 3 },
            { x: -32, y: 2.2, width: 3 },
            { x: -34, y: 1, width: 3 },
          ],
          {
            fill: { type: "base", brightness: 0.1 },
            anim: {
              type: "sway",
              periodMs: 1200,
              amplitude: 5,
              falloff: "tip",
              axis: "normal",
              phase: 0.4,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        {
          shape: "circle",
          radius: 25,
          offset: { x: 20, y: -2 },
          fill: { type: "gradient", fill: {
            fillType: FILL_TYPES.RADIAL_GRADIENT,
            start: { x: 0, y: 0 },
            stops: [
              { offset: 0, color: { r: 0.38, g: 0.62, b: 0.22, a: 0.25 } },
              { offset: 0.5, color: { r: 0.68, g: 0.92, b: 0.62, a: 0.35 } },
              { offset: 1, color: { r: 0.88, g: 1, b: 0.88, a: 0.0 } },
            ],
          } },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 28, y: 0 },
            { x: 19, y: 3 },
            { x: 17, y: 3 },
            { x: 17, y: -3 },
            { x: 19, y: -3 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 35, y: -11 },
            { x: 21, y: 0 },
            { x: 17, y: -2 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 35, y: 11 },
            { x: 21, y: 0 },
            { x: 17, y: 2 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
      ],
    },
    maxHp: 150000,
    armor: 3200,
    baseDamage: 1800,
    attackInterval: 2,
    attackRange: 140,
    moveSpeed: 35,
    physicalSize: 20,
    reward: normalizeResourceAmount({
      organics: 500,
    }),
    soulRewardBase: 4,
    requireDestruction: true,
    projectile: {
      damage: 1800,
      radius: 24,
      speed: 110,
      lifetimeMs: 2000,
      statusEffectId: "poison",
      statusEffectOptions: {
        durationMs: 4000,
        damagePerSecond: 1400,
      },
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.3, g: 0.8, b: 0.2, a: 1 },
      },
      shape: "sprite",
      spriteName: "poison",
      hitRadius: 28,
    },
    knockBackDistance: 100,
    knockBackSpeed: 150,
  },

  bigGun: {
    name: "Big Gun",
    renderer: {
      kind: "composite",
      fill: { r: 0.5, g: 0.6, b: 0.6, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -3 },
            { x: 0, y: -5 },
            { x: 0, y: 5 },
            { x: 14, y: 3 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -3, y: -8 },
            { x: -8, y: -8 },
            { x: -11, y: -4 },
            { x: -11, y: 4 },
            { x: -8, y: 8},
            { x: -3, y: 8 },
            { x: 0, y: 4}
          ],
          fill: { type: "base", brightness: 0.2 },
        },
      ],
    },
    maxHp: 725,
    armor: 48,
    baseDamage: 90,
    attackInterval: 3.5,
    attackRange: 300,
    moveSpeed: 0, // Статична турель
    physicalSize: 30,
    reward: normalizeResourceAmount({
      iron: 50,
      copper: 10,
    }),
    projectile: {
      radius: 8,
      speed: 80,
      lifetimeMs: 4500,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.5, g: 0.6, b: 0.6, a: 1 },
      },
      shape: "circle",
      hitRadius: 60,
      damageRadius: 90,
      explosion: "bigCannon",
      tail: {
        lengthMultiplier: 4.0,
        widthMultiplier: 1.0,
        startColor: { r: 0.5, g: 0.6, b: 0.6, a: 0.11 },
        endColor: { r: 0.5, g: 0.6, b: 0.6, a: 0 },
      },
      tailEmitter: {
        particlesPerSecond: 150,
        particleLifetimeMs: 800,
        fadeStartMs: 100,
        baseSpeed: 0.03,
        speedVariation: 0.005,
        spread: Math.PI / 8,
        sizeEvolutionMult: 3.0,
        sizeRange: { min: 10.3, max: 14.4 },
        color: { r: 0.5, g: 0.6, b: 0.6, a: 1 },
        fill: {
          fillType: FILL_TYPES.RADIAL_GRADIENT,
          stops: [
            { offset: 0, color: { r: 0.5, g: 0.6, b: 0.6, a: 0.1 } },
            { offset: 1, color: { r: 0.5, g: 0.6, b: 0.6, a: 0 } },
          ],
          noise: {
            colorAmplitude: 0.0,
            alphaAmplitude: 0.02,
            scale: 0.45,
          }
        },
        maxParticles: 200,
      },
    },
    knockBackDistance: 120,
    knockBackSpeed: 130,
  },
  laserTurretEnemy: {
    knockBackDistance: 160,
    knockBackSpeed: 160,
    name: "Laser Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.15, g: 0.15, b: 0.25, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: 0, y: -2.5 },
            { x: 0, y: 2.5 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: -0.25 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -5 },
            { x: -9, y: -7 },
            { x: -9, y: 7 },
            { x: 0, y: 5 },
          ],
          fill: { type: "base", brightness: 0.7 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: -6 },
            { x: -6, y: -17 },
            { x: -8, y: -17 },
            { x: -8, y: -6 },
          ],
          fill: { type: "base", brightness: 0.5 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: 6 },
            { x: -6, y: 17 },
            { x: -8, y: 17 },
            { x: -8, y: 6 },
          ],
          fill: { type: "base", brightness: 0.5 },
        },
      ],
    },
    maxHp: 14000,
    armor: 140,
    baseDamage: 350,
    attackInterval: 1.8,
    attackRange: 600,
    moveSpeed: 0,
    physicalSize: 26,
    reward: normalizeResourceAmount({
      iron: 30,
      coal: 5,
    }),
    arcAttack: {
      arcType: "laser",
      explosionType: "smallLaser",
      explosionRadius: 21,
      spawnOffset: { x: 1, y: 0 },
    },
  },
  plasmaBeamTurretEnemy: {
    knockBackDistance: 180,
    knockBackSpeed: 180,
    name: "Plasma Beam Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.1, g: 0.15, b: 0.75, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 19, y: -5 },
            { x: 0, y: -5 },
            { x: 0, y: 5 },
            { x: 19, y: 5 },
          ],
          fill: { type: "base", brightness: -0.35 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -6 },
            { x: -10, y: -9 },
            { x: -10, y: 9 },
            { x: 0, y: 6 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -2, y: -7 },
            { x: -3, y: -14 },
            { x: -9, y: -14 },
            { x: -9, y: -7 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 9, y: -12 },
            { x: 0, y: -19 },
            { x: -9, y: -19 },
            { x: -14, y: -12 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -2, y: 7 },
            { x: -3, y: 14 },
            { x: -9, y: 14 },
            { x: -9, y: 7 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 9, y: 12 },
            { x: 0, y: 19 },
            { x: -9, y: 19 },
            { x: -14, y: 12 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
      ],
    },
    maxHp: 56500,
    armor: 1165,
    baseDamage: 480,
    attackInterval: 2.1,
    attackRange: 650,
    moveSpeed: 0,
    physicalSize: 28,
    reward: normalizeResourceAmount({
      copper: 80,
    }),
    emitter: {
      particlesPerSecond: 90,
      particleLifetimeMs: 750,
      fadeStartMs: 200,
      baseSpeed: 0.08,
      speedVariation: 0.01,
      sizeRange: { min: 14.2, max: 28.4 },
      sizeEvolutionMult: 1.75, // Particles grow from 1x to 1.25x size over lifetime
      spread: Math.PI / 5.5,
      offset: { x: -0.75, y: 0 },
      color: { r: 0.2, g: 0.85, b: 0.95, a: 0.4 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: { x: 0, y: 0 },
        stops: [
          { offset: 0, color: { r: 0.6, g: 0.75, b: 1, a: 0.1 } },
          { offset: 0.25, color: { r: 0.6, g: 0.75, b: 1, a: 0.05 } },
          { offset: 1, color: { r: 0.6, g: 0.75, b: 1, a: 0 } },
        ],
        noise: {
          colorAmplitude: 0.0,
          alphaAmplitude: 0.02,
          scale: 0.3,
        },
      },
      shape: "circle",
      maxParticles: 100,
    },
    arcAttack: {
      arcType: "plasmaBeam",
      explosionType: "plasmaBeam",
      explosionRadius: 36,
      spawnOffset: { x: 2, y: 0 },
    },
  },
  portalSpawnerEnemy: {
    name: "Portal Spawner",
    renderer: {
      kind: "composite",
      fill: { r: 0.65, g: 0.6, b: 0.7, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 47,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.84, g: 0.81, b: 0.95, a: 0.1 } },
                { offset: 0.75, color: { r: 0.84, g: 0.81, b: 0.95, a: 0.9 } },
                { offset: 1, color: { r: 0.84, g: 0.81, b: 0.95, a: 0 } },
              ],
            }
          }
        },
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: -44.8, width: 10 },
            { x: 38.8, y: -22.4, width: 10 },
            { x: 38.8, y: 22.4, width: 10 },
            { x: 0, y: 44.8, width: 10 },
            { x: -38.8, y: 22.4, width: 10 },
            { x: -38.8, y: -22.4, width: 10 },
            { x: 0, y: -44.8, width: 10 },
          ],          
          {
            fill: { type: "base", brightness: 0.1 },
          },
          { epsilon: 0.25, winding: "CCW" }
        ),
      ],
    },
    maxHp: 50000,
    armor: 5000,
    baseDamage: 0,
    attackInterval: 9999,
    attackRange: 0,
    moveSpeed: 0,
    physicalSize: 32,
    lockRotation: true,
    requireDestruction: true,
    spawner: {
      spawnRate: 0.2,
      enemyTypes: [
        {
          type: "silverKeeperEnemy",
          weight: 1,
        },
      ],
      maxConcurrent: 3,
    },
    reward: normalizeResourceAmount({
      silver: 150,
    }),
    emitter: {
      color: { r: 0.9, g: 0.6, b: 0.9, a: 0.9 },
      particlesPerSecond: 190,
      particleLifetimeMs: 650,
      fadeStartMs: 500,
      baseSpeed: 0.09,
      speedVariation: 0.01,
      sizeRange: { min: 3, max: 5 },
      sizeEvolutionMult: 1.0,
      shape: "triangle",
      maxParticles: 1000,
      spread: Math.PI * 2,
      /*fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        stops: [
          { offset: 0, color: { r: 0.9, g: 0.8, b: 0.9, a: 0.4 } },
          { offset: 0.25, color: { r: 0.9, g: 0.8, b: 0.9, a: 0.15 } },
          { offset: 1, color: { r: 0.9, g: 0.8, b: 0.9, a: 0 } },
        ],
      },*/
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.97, g: 0.94, b: 1, a: 0.9 },
      },
    },
  },

  greatOctopusBody: {
    name: "The Great Octopus",
    renderer: {
      kind: "composite",
      fill: { r: 0.15, g: 0.55, b: 0.8, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 76,
          segments: 48,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.75, g: 0.85, b: 1, a: 1 } },
                { offset: 0.5, color: { r: 0.75, g: 0.85, b: 1, a: 0.8 } },
                { offset: 1, color: { r: 0.15, g: 0.55, b: 0.8, a: 0 } },
              ],
            }
          }
          
        },
        {
          shape: "circle",
          radius: 38,
          segments: 32,
          fill: { type: "base", brightness: 0.1, alphaMultiplier: 0.7 },
        },
      ],
    },
    tentacles: {
      spines: (() => {
        const TENTACLE_COUNT = 8;
        const POINTS_PER_TENTACLE = 6;
        const BASE_RADIUS = 38;
        const TIP_RADIUS = 180;
        return Array.from({ length: TENTACLE_COUNT }, (_, t) => {
          const angle = (t / TENTACLE_COUNT) * Math.PI * 2;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          return Array.from({ length: POINTS_PER_TENTACLE }, (_, i) => {
            const frac = i / (POINTS_PER_TENTACLE - 1);
            const r = BASE_RADIUS + frac * (TIP_RADIUS - BASE_RADIUS);
            const width = 10 * (1 - frac * 0.75);
            const wobble = Math.sin(frac * Math.PI * 2 + t) * 12 * frac;
            const perpCos = -sin;
            const perpSin = cos;
            return {
              x: cos * r + perpCos * wobble,
              y: sin * r + perpSin * wobble,
              width,
            };
          });
        });
      })(),
      segmentsPerTentacle: 5,
      anim: {
        type: "sway" as const,
        periodMs: 2200,
        amplitude: 6,
        falloff: "tip" as const,
        axis: "normal" as const,
        phase: 0,
      },
      fill: { type: "base" as const, brightness: 0.3, saturationShift: 0.1, colorAnimation: { 
        interval: 2000, 
        keyframes: [
          { time: 0, deltaHue: 0 },
          { time: 0.5, deltaHue: 0.14 }, 
          { time: 1, deltaHue: 0 }
        ] 
      } },
      stroke: { type: "base" as const, width: 1.2, brightness: -0.1, hueShift: 0.3 },
      buildOpts: { epsilon: 0.3, winding: "CCW" as const },
      tipGlow: {
        radius: 12,
        segments: 16,
        fill: {
          type: "gradient" as const,
          fill: {
            fillType: FILL_TYPES.RADIAL_GRADIENT,
            start: { x: 0, y: 0 },
            stops: [
              { offset: 0, color: { r: 0.6, g: 0.85, b: 1, a: 0.7 } },
              { offset: 0.5, color: { r: 0.4, g: 0.7, b: 1, a: 0.3 } },
              { offset: 1, color: { r: 0.3, g: 0.6, b: 1, a: 0 } },
            ],
          },
        },
      },
    },
    maxHp: 500000,
    armor: 15000,
    baseDamage: 4000,
    attackInterval: 2.5,
    attackRange: 350,
    moveSpeed: 0,
    physicalSize: 50,
    lockRotation: true,
    requireDestruction: true,
    blocksUnits: true,
    knockBackDistance: 220,
    knockBackSpeed: 360,
    reward: normalizeResourceAmount({ stone: 5000, iron: 500 }),
    soulRewardBase: 50,
    arcAttack: {
      arcType: "plasmaBeam",
      explosionType: "plasmaBeam",
      explosionRadius: 48,
    },
  },

  greatOctopusSegment: {
    name: "Tentacle Segment",
    renderer: {
      kind: "polygon",
      fill: { r: 0, g: 0, b: 0, a: 0 },
      vertices: [
        { x: -2, y: -2 },
        { x: 2, y: -2 },
        { x: 2, y: 2 },
        { x: -2, y: 2 },
      ],
    },
    maxHp: 30000,
    armor: 2000,
    baseDamage: 1500,
    attackInterval: 5,
    attackRange: 1260,
    projectileMinSegmentIndex: 4,
    moveSpeed: 0,
    physicalSize: 14,
    lockRotation: true,
    blocksUnits: true,
    contactDamage: true,
    knockBackDistance: 220,
    knockBackSpeed: 260,
    projectileKnockBackDistance: 0,
    projectileKnockBackSpeed: 0,
    reward: normalizeResourceAmount({ stone: 200, iron: 20 }),
    soulRewardBase: 4,
    selfKnockBackDistance: 120,
    selfKnockBackSpeed: 200,
    meleeHitExplosion: { type: "tentacleHit", radius: 14 },
    projectile: {
      damage: 480,
      radius: 6,
      speed: 80,
      lifetimeMs: 7900,
      destroyOnHit: false,
      targetHitCooldownMs: 120,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.75, g: 0.82, b: 0.96, a: 0 },
      },
      attackSeries: {
        shots: 4,
        intervalMs: 200,
      },
      hitRadius: 34,
      damageRadius: 34,
      particleCluster: {
        particlesPerSecond: 300,
        particleLifetimeMs: 860,
        emissionDurationMs: 1400,
        fadeStartMs: 120,
        baseSpeed: 0.04,
        speedVariation: 0.01,
        spread: Math.PI * 2,
        offset: { x: 0, y: 0 },
        spawnRadius: { min: 0, max: 8 },
        sizeRange: { min: 15, max: 32 },
        sizeEvolutionMult: 2.35,
        color: { r: 1, g: 0.72, b: 0.2, a: 0.75 },
        fill: {
          fillType: FILL_TYPES.RADIAL_GRADIENT,
          stops: [
            { offset: 0, color: { r: 0.95, g: 0.95, b: 1, a: 0.19 } },
            { offset: 0.5, color: { r: 0.8, g: 0.87, b: 1, a: 0.08 } },
            { offset: 1, color: { r: 0.02, g: 0.24, b: 1, a: 0 } },
          ],
          noise: {
            colorAmplitude: 0.0,
            alphaAmplitude: 0.02,
            scale: 0.3,
          },
        },
        maxParticles: 240,
      },
      rendererCustomData: {
        renderComponents: {
          body: false,
          tail: false,
          glow: false,
          emitters: true,
        },
      },
    },
  },
};

export const ENEMY_TYPES = Object.keys(ENEMIES_DB) as EnemyType[];

export const isEnemyType = (value: unknown): value is EnemyType => {
  return typeof value === "string" && ENEMY_TYPES.includes(value as EnemyType);
};

export const getEnemyConfig = (type: EnemyType): EnemyConfig => {
  const config = ENEMIES_DB[type];
  if (!config) {
    throw new Error(`Unknown enemy type: ${type}`);
  }
  return config;
};
