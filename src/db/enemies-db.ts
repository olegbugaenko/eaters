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

export type EnemyType = "basicEnemy" | "fastEnemy" | "tankEnemy";

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
    maxHp: 12,
    armor: 1,
    baseDamage: 3,
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
      kind: "polygon",
      fill: { r: 0.3, g: 0.3, b: 0.8, a: 1 },
      stroke: {
        color: { r: 0.4, g: 0.4, b: 0.9, a: 1 },
        width: 2,
      },
      vertices: TANK_ENEMY_VERTICES,
    },
    maxHp: 50,
    armor: 5,
    baseDamage: 6,
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
