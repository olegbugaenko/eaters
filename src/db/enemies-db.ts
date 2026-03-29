import { ENEMIES_DB } from "./enemies";
import type { EnemyConfig, EnemyType } from "./enemies/enemies.types";

export type {
  EnemyArcAttackConfig,
  EnemyAuraConfig,
  EnemyConfig,
  EnemyProjectileConfig,
  EnemyStreamAttackConfig,
  EnemyStreamAttackVisualConfig,
  EnemyRendererCompositeConfig,
  EnemyRendererConfig,
  EnemyRendererLayerConfig,
  EnemyRendererPolygonConfig,
  EnemyTargetingOptions,
  EnemyType,
  OctopusTentacleConfig,
  OctopusTentacleTipGlowConfig,
} from "./enemies/enemies.types";

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
