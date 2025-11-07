import { DataBridge } from "../../../core/DataBridge";
import type { PlayerUnitBlueprintStats } from "../../../../types/player-units";
import type { UnitDesignId } from "../../camp/UnitDesignModule";

export interface UnitStatisticsReporterOptions {
  readonly bridge: DataBridge;
}

export class UnitStatisticsReporter {
  private readonly bridge: DataBridge;
  private lastCount = -1;
  private lastTotalHp = -1;
  private lastCountsSignature: string | null = null;

  constructor(options: UnitStatisticsReporterOptions) {
    this.bridge = options.bridge;
  }

  public pushCounts(
    units: readonly { hp: number; designId: UnitDesignId | null }[],
    keys: { countKey: string; totalHpKey: string; countsByDesignKey: string },
  ): void {
    const countsByDesign = new Map<UnitDesignId, number>();
    let totalHp = 0;
    for (let index = 0; index < units.length; index += 1) {
      const unit = units[index];
      totalHp += Math.max(unit?.hp ?? 0, 0);
      const designId = unit?.designId;
      if (designId !== null && typeof designId !== "undefined") {
        countsByDesign.set(designId, (countsByDesign.get(designId) ?? 0) + 1);
      }
    }

    if (units.length !== this.lastCount) {
      this.bridge.setValue(keys.countKey, units.length);
      this.lastCount = units.length;
    }
    if (totalHp !== this.lastTotalHp) {
      this.bridge.setValue(keys.totalHpKey, totalHp);
      this.lastTotalHp = totalHp;
    }

    const signatureParts: string[] = [];
    countsByDesign.forEach((count, designId) => {
      signatureParts.push(`${designId}:${count}`);
    });
    signatureParts.sort();
    const signature = signatureParts.join("|");
    if (signature !== this.lastCountsSignature) {
      const payload: Record<string, number> = {};
      countsByDesign.forEach((count, designId) => {
        payload[designId] = count;
      });
      this.bridge.setValue(keys.countsByDesignKey, payload);
      this.lastCountsSignature = signature;
    }
  }

  public pushBlueprints(
    blueprints: readonly PlayerUnitBlueprintStats[],
    key: string,
  ): void {
    this.bridge.setValue(key, blueprints);
  }
}


