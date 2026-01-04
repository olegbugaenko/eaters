import { DataBridge } from "@/logic/core/DataBridge";
import { GameModule } from "@/logic/core/types";
import { sanitizeNonNegativeNumber } from "../../../helpers/numbers.helper";

export const STATISTICS_BRIDGE_KEY = "statistics/summary";

export interface CampStatisticsSnapshot {
  bricksDestroyed: number;
  creaturesDied: number;
  damageDealt: number;
  damageTaken: number;
}

export const DEFAULT_CAMP_STATISTICS: CampStatisticsSnapshot = Object.freeze({
  bricksDestroyed: 0,
  creaturesDied: 0,
  damageDealt: 0,
  damageTaken: 0,
});

export interface StatisticsTracker {
  recordBrickDestroyed(count?: number): void;
  recordCreatureDeath(count?: number): void;
  recordDamageDealt(amount: number): void;
  recordDamageTaken(amount: number): void;
  syncBrickDestroyed(total: number): void;
}

interface StatisticsModuleOptions {
  bridge: DataBridge;
}

interface StatisticsSaveData {
  stats?: Partial<CampStatisticsSnapshot>;
}

const sanitizeSnapshot = (value: unknown): CampStatisticsSnapshot => {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_CAMP_STATISTICS };
  }
  const stats = value as Partial<CampStatisticsSnapshot>;
  return {
    bricksDestroyed: sanitizeNonNegativeNumber(stats.bricksDestroyed),
    creaturesDied: sanitizeNonNegativeNumber(stats.creaturesDied),
    damageDealt: sanitizeNonNegativeNumber(stats.damageDealt),
    damageTaken: sanitizeNonNegativeNumber(stats.damageTaken),
  };
};

export class StatisticsModule
  implements GameModule, StatisticsTracker
{
  public readonly id = "statistics";

  private readonly bridge: DataBridge;
  private stats: CampStatisticsSnapshot = { ...DEFAULT_CAMP_STATISTICS };

  constructor(options: StatisticsModuleOptions) {
    this.bridge = options.bridge;
  }

  public initialize(): void {
    this.push();
  }

  public reset(): void {
    this.stats = { ...DEFAULT_CAMP_STATISTICS };
    this.push();
  }

  public load(data: unknown | undefined): void {
    if (data && typeof data === "object" && "stats" in data) {
      this.stats = sanitizeSnapshot((data as StatisticsSaveData).stats);
    } else {
      this.stats = { ...DEFAULT_CAMP_STATISTICS };
    }
    this.push();
  }

  public save(): unknown {
    return {
      stats: { ...this.stats },
    } satisfies StatisticsSaveData;
  }

  public tick(): void {
    // no-op
  }

  public recordBrickDestroyed(count = 1): void {
    const increment = sanitizeNonNegativeNumber(count);
    if (increment <= 0) {
      return;
    }
    this.stats.bricksDestroyed += increment;
    this.push();
  }

  public recordCreatureDeath(count = 1): void {
    const increment = sanitizeNonNegativeNumber(count);
    if (increment <= 0) {
      return;
    }
    this.stats.creaturesDied += increment;
    this.push();
  }

  public recordDamageDealt(amount: number): void {
    const increment = sanitizeNonNegativeNumber(amount);
    if (increment <= 0) {
      return;
    }
    this.stats.damageDealt += increment;
    this.push();
  }

  public recordDamageTaken(amount: number): void {
    const increment = sanitizeNonNegativeNumber(amount);
    if (increment <= 0) {
      return;
    }
    this.stats.damageTaken += increment;
    this.push();
  }

  public syncBrickDestroyed(total: number): void {
    const sanitized = sanitizeNonNegativeNumber(total);
    if (sanitized <= this.stats.bricksDestroyed) {
      return;
    }
    this.stats.bricksDestroyed = sanitized;
    this.push();
  }

  private push(): void {
    this.bridge.setValue(STATISTICS_BRIDGE_KEY, { ...this.stats });
  }
}
