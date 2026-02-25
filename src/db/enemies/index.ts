import type { EnemyConfig, EnemyType } from "../enemies-db";
import { BOSS_ENEMIES } from "./bosses";
import { MONSERS_ENEMIES } from "./monsers";
import { SPAWNER_ENEMIES } from "./spawners";
import { TURRET_ENEMIES } from "./turrets";

export const ENEMIES_DB: Record<EnemyType, EnemyConfig> = {
  ...MONSERS_ENEMIES,
  ...TURRET_ENEMIES,
  ...BOSS_ENEMIES,
  ...SPAWNER_ENEMIES,
} as Record<EnemyType, EnemyConfig>;
