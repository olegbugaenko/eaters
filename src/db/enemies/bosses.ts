import type { EnemyConfig, EnemyType } from "../enemies-db";
import { ENEMIES_DB_SOURCE } from "./source";

const BOSS_IDS = [
  "encagedBeastEnemy",
  "greatOctopusBody",
  "greatOctopusSegment",
] as const satisfies readonly EnemyType[];

export const BOSS_ENEMIES: Partial<Record<EnemyType, EnemyConfig>> = Object.fromEntries(
  BOSS_IDS.map((id) => [id, ENEMIES_DB_SOURCE[id]]),
);
