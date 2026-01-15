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
} from "@shared/types/renderer.types";
import type { UnitProjectileVisualConfig } from "../logic/modules/active-map/projectiles/projectiles.types";
import { mapLineToPolygonShape } from "@/shared/helpers/paths.helper";
import type { ArcType } from "./arcs-db";
import type { StatusEffectId } from "./status-effects-db";
import type { StatusEffectApplicationOptions } from "@/logic/modules/active-map/status-effects/status-effects.types";
import type { ExplosionType } from "./explosions-db";
import type { AttackSeriesConfig } from "@shared/types/attack-series.types";

export type EnemyType =
  | "basicEnemy"
  | "fastEnemy"
  | "tankEnemy"
  | "turretEnemy"
  | "burstTurretEnemy"
  | "volleyTurretEnemy"
  | "explosionTurretEnemy"
  | "spectreEnemy"
  | "encagedBeastEnemy"
  | "freezeTurretEnemy"
  | "bigGun"
  | "laserTurretEnemy";

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
}

export interface EnemyProjectileConfig extends UnitProjectileVisualConfig {
  readonly attackSeries?: AttackSeriesConfig;
}

export interface EnemyTargetingOptions {
  readonly avoidSharedTargets?: boolean;
  readonly skipTargetsWithEffects?: readonly StatusEffectId[];
  readonly searchPadding?: number;
}

export interface EnemyConfig {
  readonly name: string;
  readonly renderer: EnemyRendererConfig;
  readonly maxHp: number;
  readonly armor: number;
  readonly baseDamage: number;
  readonly attackInterval: number; // seconds
  readonly attackRange?: number;
  readonly moveSpeed: number;
  readonly physicalSize: number;
  readonly reward?: ResourceAmount;
  readonly emitter?: ParticleEmitterConfig;
  readonly projectile?: EnemyProjectileConfig; // Якщо вказано - ворог стріляє снарядами, якщо ні - instant damage
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
  readonly knockBackDistance?: number; // Відстань knockback при атаці юнітів
  readonly knockBackSpeed?: number; // Швидкість knockback при атаці юнітів
  readonly selfKnockBackDistance?: number; // Відстань knockback для ворога при отриманні урону
  readonly selfKnockBackSpeed?: number; // Швидкість knockback для ворога при отриманні урону
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
    baseDamage: 600,
    attackInterval: 1.8,
    attackRange: 280,
    moveSpeed: 20,
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
        particleLifetimeMs: 400,
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
    knockBackSpeed: 150,
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
    knockBackSpeed: 180,
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
    knockBackSpeed: 160,
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
