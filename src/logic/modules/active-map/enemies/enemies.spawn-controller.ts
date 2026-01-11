import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { MapEnemySpawnPointConfig, MapEnemySpawnTypeConfig } from "../../../../db/maps-db";
import type { EnemyType } from "../../../../db/enemies-db";
import type { EnemiesModule } from "./enemies.module";
import type { EnemySpawnData } from "./enemies.types";
import { sanitizeEnemyLevel } from "./enemies.helpers";
import { clampNumber } from "@shared/helpers/numbers.helper";

export class EnemySpawnController {
  private spawnTimers = new Map<string, number>(); // spawnPoint index -> time until next spawn

  /**
   * Updates spawn timers and spawns enemies if needed
   * @param deltaMs - Time delta in milliseconds
   * @param spawnPoints - Enemy spawn point configurations
   * @param enemiesModule - Enemies module to spawn into
   * @param mapLevel - Current map level
   */
  public tick(
    deltaMs: number,
    spawnPoints: readonly MapEnemySpawnPointConfig[],
    enemiesModule: EnemiesModule,
    mapLevel: number
  ): void {
    if (deltaMs <= 0) {
      return;
    }

    spawnPoints.forEach((spawnPoint, index) => {
      if (spawnPoint.enabled === false) {
        return;
      }

      const timer = this.spawnTimers.get(index.toString()) ?? 0;
      const newTimer = timer - deltaMs;

      if (newTimer <= 0) {
        this.trySpawnEnemy(spawnPoint, enemiesModule, mapLevel, index.toString());
        const spawnIntervalMs = (1 / spawnPoint.spawnRate) * 1000;
        this.spawnTimers.set(index.toString(), spawnIntervalMs);
      } else {
        this.spawnTimers.set(index.toString(), newTimer);
      }
    });
  }

  /**
   * Resets all spawn timers
   */
  public reset(): void {
    this.spawnTimers.clear();
  }

  /**
   * Attempts to spawn an enemy from a spawn point
   */
  private trySpawnEnemy(
    spawnPoint: MapEnemySpawnPointConfig,
    enemiesModule: EnemiesModule,
    mapLevel: number,
    spawnPointId: string
  ): void {
    // Check max concurrent enemies
    if (spawnPoint.maxConcurrent !== undefined) {
      const currentEnemies = enemiesModule.getEnemies();
      const enemiesFromThisSpawn = currentEnemies.filter((enemy) => {
        // We can't easily track which enemy came from which spawn point
        // For now, we'll just check total count
        // TODO: Add spawnPointId tracking to enemies if needed
        return true;
      });
      if (enemiesFromThisSpawn.length >= spawnPoint.maxConcurrent) {
        return; // Max concurrent reached
      }
    }

    // Select enemy type based on weights and level constraints
    const selectedType = this.selectEnemyType(spawnPoint.enemyTypes, mapLevel);
    if (!selectedType) {
      return; // No valid enemy type for current level
    }

    // Calculate enemy level (map level + offset)
    const levelOffset = spawnPoint.levelOffset ?? 0;
    const enemyLevel = sanitizeEnemyLevel(mapLevel + levelOffset);

    // Create spawn data
    const spawnData: EnemySpawnData = {
      type: selectedType,
      level: enemyLevel,
      position: { ...spawnPoint.position },
    };

    // Spawn the enemy
    enemiesModule.spawnEnemy(spawnData);
  }

  /**
   * Selects an enemy type based on weights and level constraints
   */
  private selectEnemyType(
    enemyTypes: readonly MapEnemySpawnTypeConfig[],
    mapLevel: number
  ): EnemyType | null {
    // Filter by level constraints
    const validTypes = enemyTypes.filter((config) => {
      if (config.minLevel !== undefined && mapLevel < config.minLevel) {
        return false;
      }
      if (config.maxLevel !== undefined && mapLevel > config.maxLevel) {
        return false;
      }
      return true;
    });

    if (validTypes.length === 0) {
      return null;
    }

    // Calculate total weight
    const totalWeight = validTypes.reduce((sum, config) => sum + Math.max(config.weight, 0), 0);
    if (totalWeight <= 0) {
      return validTypes[0]?.type ?? null;
    }

    // Select based on weighted random
    let random = Math.random() * totalWeight;
    for (const config of validTypes) {
      random -= Math.max(config.weight, 0);
      if (random <= 0) {
        return config.type;
      }
    }

    // Fallback to last type
    return validTypes[validTypes.length - 1]?.type ?? null;
  }
}
