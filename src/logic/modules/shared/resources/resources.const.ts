import type { ResourceId } from "../../../../db/resources-db";
import type { BonusId } from "../../../../db/bonuses-db";
import type { ResourceRunSummaryPayload } from "./resources.types";

export const RESOURCE_TOTALS_BRIDGE_KEY = "resources/totals";
export const RESOURCE_RUN_SUMMARY_BRIDGE_KEY = "resources/runSummary";
export const RESOURCE_RUN_DURATION_BRIDGE_KEY = "resources/runDuration";

export const PASSIVE_RESOURCE_BONUS_IDS: Partial<Record<ResourceId, BonusId>> = {
  stone: "stone_income",
};

export const DEFAULT_RESOURCE_RUN_SUMMARY: ResourceRunSummaryPayload = Object.freeze({
  completed: false,
  resources: [],
  bricksDestroyed: 0,
  totalBricksDestroyed: 0,
});

export const VISIBILITY_REFRESH_INTERVAL_MS = 250; // 4x per second is enough
