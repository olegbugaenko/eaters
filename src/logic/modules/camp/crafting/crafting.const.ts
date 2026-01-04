import type { CraftingBridgeState } from "./crafting.types";

export const DEFAULT_CRAFTING_STATE: CraftingBridgeState = Object.freeze({
  unlocked: false,
  recipes: [],
});

export const CRAFTING_STATE_BRIDGE_KEY = "crafting/state";
export const PROGRESS_PUSH_INTERVAL_MS = 100;
