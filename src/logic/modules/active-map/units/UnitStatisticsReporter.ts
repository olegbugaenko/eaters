import { DataBridge } from "../../../core/DataBridge";
import type { PlayerUnitBlueprintStats } from "../../../../types/player-units";
import type { UnitDesignId } from "../../camp/UnitDesignModule";

export interface UnitStatsSnapshot {
  readonly hp: number;
  readonly designId: UnitDesignId | null;
}

export interface UnitStatisticsReporterOptions {
  readonly bridge: DataBridge;
}

export class UnitStatisticsReporter {
  private readonly bridge: DataBridge;

  constructor(options: UnitStatisticsReporterOptions) {
    this.bridge = options.bridge;
  }

  public pushCounts(
    units: readonly UnitStatsSnapshot[],
    keys: { countKey: string; totalHpKey: string; countsByDesignKey: string },
  ): void {
    const totalHp = units.reduce((sum, u) => sum + Math.max(u.hp, 0), 0);
    const countsByDesign = new Map<UnitDesignId, number>();
    units.forEach((u) => {
      if (u.designId) {
        countsByDesign.set(u.designId, (countsByDesign.get(u.designId) ?? 0) + 1);
      }
    });

    this.bridge.setValue(keys.countKey, units.length);
    this.bridge.setValue(keys.totalHpKey, totalHp);
    this.bridge.setValue(keys.countsByDesignKey, Object.fromEntries(countsByDesign));
  }

  public pushBlueprints(
    blueprints: readonly PlayerUnitBlueprintStats[],
    key: string,
  ): void {
    this.bridge.setValue(key, blueprints);
  }
}


