import type { EnemyConfig, EnemyType } from "../enemies-db";
import { ENEMIES_DB_SOURCE } from "./source";

const TURRET_IDS = [
  "turretEnemy",
  "burstTurretEnemy",
  "volleyTurretEnemy",
  "wheelVolleyTurretEnemy",
  "explosionTurretEnemy",
  "bleedingTurretEnemy",
  "freezeTurretEnemy",
  "bigGun",
  "laserTurretEnemy",
  "plasmaBeamTurretEnemy",
] as const satisfies readonly EnemyType[];

export const TURRET_ENEMIES: Partial<Record<EnemyType, EnemyConfig>> = Object.fromEntries(
  TURRET_IDS.map((id) => [id, ENEMIES_DB_SOURCE[id]]),
);
