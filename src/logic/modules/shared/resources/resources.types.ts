import type { ResourceId } from "../../../../db/resources-db";
import type { ResourceAmount } from "../../../../db/resources-db";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { MapRunState } from "../../active-map/map/MapRunState";
import type { UnlockService } from "../../../services/unlock/UnlockService";
import type { BonusesModule } from "../bonuses/bonuses.module";
import type { StatisticsTracker } from "../statistics/statistics.module";

export interface ResourceAmountPayload {
  id: ResourceId;
  name: string;
  amount: number;
}

export interface ResourceRunSummaryItem extends ResourceAmountPayload {
  gained: number;
  ratePerSecond: number;
}

export interface ResourceRunSummaryPayload {
  completed: boolean;
  resources: ResourceRunSummaryItem[];
  bricksDestroyed: number;
  totalBricksDestroyed: number;
}

export interface ResourcesModuleOptions {
  bridge: DataBridge;
  unlocks: UnlockService;
  bonuses: BonusesModule;
  runState: MapRunState;
  statistics?: StatisticsTracker;
}

export interface ResourcesSaveData {
  totals: ResourceAmount;
  bricksDestroyed?: number;
}
