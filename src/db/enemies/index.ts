import type { EnemyConfig, EnemyType } from "./enemies.types";
import { BOSSES_ENEMIES } from "./bosses";
import { MONSTERS_ENEMIES } from "./monsters";
import { SPAWNERS_ENEMIES } from "./spawners";
import { TURRETS_ENEMIES } from "./turrets";

export const ENEMIES_DB: Record<EnemyType, EnemyConfig> = {
  ...MONSTERS_ENEMIES,
  ...TURRETS_ENEMIES,
  ...BOSSES_ENEMIES,
  ...SPAWNERS_ENEMIES,
} as Record<EnemyType, EnemyConfig>;
