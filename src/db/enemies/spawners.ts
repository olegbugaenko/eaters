import type { EnemyConfig, EnemyType } from "../enemies-db";
import { ENEMIES_DB_SOURCE } from "./source";

const SPAWNER_IDS = ["portalSpawnerEnemy"] as const satisfies readonly EnemyType[];

export const SPAWNER_ENEMIES: Partial<Record<EnemyType, EnemyConfig>> = Object.fromEntries(
  SPAWNER_IDS.map((id) => [id, ENEMIES_DB_SOURCE[id]]),
);
