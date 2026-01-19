import { clampNumber } from "@shared/helpers/numbers.helper";
import { getMapEffectConfig, MapEffectId } from "../../../../db/map-effects-db";
import type { EnemiesModule } from "../enemies/enemies.module";
import type { PlayerUnitsModule } from "../player-units/player-units.module";
import type { MapEffectRuntimeState } from "./map-effects.types";

interface MapEffectsModuleOptions {
  playerUnits: PlayerUnitsModule;
  enemies: EnemiesModule;
}

export class MapEffectsModule {
  private activeEffects: MapEffectRuntimeState[] = [];

  constructor(private readonly options: MapEffectsModuleOptions) {}

  public reset(): void {
    this.activeEffects = [];
  }

  public startRun(effectIds: readonly MapEffectId[]): void {
    this.activeEffects = effectIds.map((id) => {
      const config = getMapEffectConfig(id);
      return {
        id,
        level: 0,
        maxLevel: Math.max(config.maxLevel, 0),
        growthPerSecond: Math.max(config.growthPerSecond, 0),
        hpDrainPercentPerSecond: Math.max(config.hpDrainPercentPerSecond, 0),
        targets: config.targets,
      };
    });
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0 || this.activeEffects.length === 0) {
      return;
    }
    const deltaSeconds = Math.max(deltaMs, 0) / 1000;
    if (deltaSeconds <= 0) {
      return;
    }

    this.activeEffects.forEach((effect) => {
      if (effect.maxLevel > 0 && effect.growthPerSecond > 0) {
        effect.level = clampNumber(
          effect.level + effect.growthPerSecond * deltaSeconds,
          0,
          effect.maxLevel,
        );
      }
      if (effect.level <= 0 || effect.hpDrainPercentPerSecond <= 0) {
        return;
      }

      const damagePercentPerSecond = effect.level * effect.hpDrainPercentPerSecond;
      const damageMultiplier = (damagePercentPerSecond / 100) * deltaSeconds;
      if (damageMultiplier <= 0) {
        return;
      }

      if (effect.targets.includes("playerUnits")) {
        this.options.playerUnits.forEachUnit((unit) => {
          if (unit.hp <= 0 || unit.maxHp <= 0) {
            return;
          }
          const damage = unit.maxHp * damageMultiplier;
          if (damage > 0) {
            this.options.playerUnits.applyDamage(unit.id, damage);
          }
        });
      }

      if (effect.targets.includes("enemies")) {
        const enemies = this.options.enemies.getEnemies();
        enemies.forEach((enemy) => {
          if (enemy.hp <= 0 || enemy.maxHp <= 0) {
            return;
          }
          const damage = enemy.maxHp * damageMultiplier;
          if (damage > 0) {
            this.options.enemies.applyDamage(enemy.id, damage);
          }
        });
      }
    });
  }
}
