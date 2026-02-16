import type { DarkResearchBridgeState } from "./dark-research.types";

export const DARK_RESEARCH_STATE_BRIDGE_KEY = "darkResearch/state";
export const DARK_RESEARCH_UNLOCK_SKILL_ID = "souls_harvest" as const;

export const DEFAULT_DARK_RESEARCH_STATE: DarkResearchBridgeState = Object.freeze({
  unlocked: false,
  totalSouls: 0,
  freeSouls: 0,
  researches: [],
});
