import type { MapEnemySpawnTypeConfig } from "../../../../db/maps/maps-db";
import type { EnemyType } from "../../../../db/enemies-db";

export interface EnemySpawnSourceConfig {
  readonly spawnRate: number;
  readonly enemyTypes: readonly MapEnemySpawnTypeConfig[];
  readonly levelOffset?: number;
  readonly maxConcurrent?: number;
}

export class EnemySpawnSourceController {
  public getSpawnIntervalMs(spawnRate: number): number {
    return (1 / spawnRate) * 1000;
  }

  public selectEnemyType(
    enemyTypes: readonly MapEnemySpawnTypeConfig[],
    mapLevel: number
  ): EnemyType | null {
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

    const totalWeight = validTypes.reduce((sum, config) => sum + Math.max(config.weight, 0), 0);
    if (totalWeight <= 0) {
      return validTypes[0]?.type ?? null;
    }

    let random = Math.random() * totalWeight;
    for (const config of validTypes) {
      random -= Math.max(config.weight, 0);
      if (random <= 0) {
        return config.type;
      }
    }

    return validTypes[validTypes.length - 1]?.type ?? null;
  }
}
