import type { EnemyConfig, EnemyType } from "../enemies-db";
import { ENEMIES_DB_SOURCE } from "./source";

const MONSER_IDS = [
  "basicEnemy",
  "fastEnemy",
  "tankEnemy",
  "spectreEnemy",
  "coalConvoyGuardian",
  "silverKeeperEnemy",
  "snakeEnemy",
] as const satisfies readonly EnemyType[];

export const MONSERS_ENEMIES: Partial<Record<EnemyType, EnemyConfig>> = Object.fromEntries(
  MONSER_IDS.map((id) => [id, ENEMIES_DB_SOURCE[id]]),
);
