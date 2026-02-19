import { BRICK_EXPLOSIONS } from "./explosions.bricks";
import { PROJECTILE_EXPLOSIONS } from "./explosions.projectiles";
import { PLAYER_UNIT_EXPLOSIONS } from "./explosions.player-units";
import type { ExplosionConfig, ExplosionType } from "./explosions.types";

export type {
  ExplosionConfig,
  ExplosionType,
  ExplosionWaveConfig,
  ExplosionStarburstConfig,
} from "./explosions.types";
export { createSimpleWave } from "./explosions.helpers";
export { BRICK_EXPLOSIONS } from "./explosions.bricks";
export { PROJECTILE_EXPLOSIONS } from "./explosions.projectiles";
export { PLAYER_UNIT_EXPLOSIONS } from "./explosions.player-units";
export * from "./explosions.colors.const";
export * from "./explosions.emitters.const";

const EXPLOSION_DB: Record<ExplosionType, ExplosionConfig> = {
  ...PROJECTILE_EXPLOSIONS,
  ...BRICK_EXPLOSIONS,
  ...PLAYER_UNIT_EXPLOSIONS,
} as Record<ExplosionType, ExplosionConfig>;

export const getExplosionConfig = (type: ExplosionType): ExplosionConfig => {
  const config = EXPLOSION_DB[type];
  if (!config) {
    throw new Error(`Unknown explosion type: ${type}`);
  }
  return config;
};

export const EXPLOSION_TYPES = Object.keys(EXPLOSION_DB) as ExplosionType[];
