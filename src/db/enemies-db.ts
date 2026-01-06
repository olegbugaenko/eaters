import {
  SceneColor,
  SceneFill,
  SceneVector2,
} from "../logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "../logic/services/scene-object-manager/scene-object-manager.const";
import type { ParticleEmitterConfig } from "../logic/interfaces/visuals/particle-emitters-config";
import { ResourceAmount, normalizeResourceAmount } from "./resources-db";
import type { ExtendedRendererLayerFields, BaseRendererLayerConfig } from "@shared/types/renderer.types";
import type { UnitProjectileVisualConfig } from "../logic/modules/active-map/projectiles/projectiles.types";
import { mapLineToPolygonShape } from "@/shared/helpers/paths.helper";

export type EnemyType = "basicEnemy" | "fastEnemy" | "tankEnemy" | "turretEnemy";

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

export type EnemyRendererLayerConfig = BaseRendererLayerConfig<ExtendedRendererLayerFields>;

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

export type EnemyRendererConfig = EnemyRendererCompositeConfig | EnemyRendererPolygonConfig;

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
  readonly projectile?: UnitProjectileVisualConfig; // Якщо вказано - ворог стріляє снарядами, якщо ні - instant damage
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
     {x: 14, y: -2 },
     {x: -14, y: -10 },
     {x: -14, y: 10 },
     {x: 14, y: 2 },
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
            ...mapLineToPolygonShape<Omit<EnemyRendererLayerConfig, "shape" | "vertices">>(
                [{ x: 0, y: -6, width: 2.6 }, {x: -4, y: -6.5, width: 2.3}, { x: -7, y: -7.5, width: 2.0}, { x: -9, y: -9, width: 1.7}, { x: -10, y: -11, width: 1.4}, { x: -11, y: -11, width: 1.0}],
                { fill: { type: "base", brightness: -0.1 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 2, falloff: "tip", axis: "normal", phase: 1.1 } },
                { epsilon: 0.25, winding: "CCW" }
              ),
            ...mapLineToPolygonShape<Omit<EnemyRendererLayerConfig, "shape" | "vertices">>(
                [{ x: 0, y: 6, width: 2.6 }, {x: -4, y: 6.5, width: 2.3}, { x: -7, y: 7.5, width: 2.0}, { x: -9, y: 9, width: 1.7}, { x: -10, y: 11, width: 1.4}, { x: -11, y: 11, width: 1.0}],
                { fill: { type: "base", brightness: -0.1 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 2, falloff: "tip", axis: "normal", phase: 1.1 } },
                { epsilon: 0.25, winding: "CCW" }
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
    maxHp: 80,
    armor: 8,
    baseDamage: 14,
    attackInterval: 1.5,
    attackRange: 400,
    moveSpeed: 0, // Статична турель
    physicalSize: 20,
    reward: normalizeResourceAmount({
      stone: 3,
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
      explosion: "smallCannon", // Тип експлозії при влучанні снаряда
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
