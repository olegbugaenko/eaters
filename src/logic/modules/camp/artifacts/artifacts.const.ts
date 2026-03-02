import type { ArtifactsBridgeState } from "./artifacts.types";

export const ARTIFACTS_STATE_BRIDGE_KEY = "artifacts/state";
export const ARTIFACTS_SLOT_COUNT = 2;

export const DEFAULT_ARTIFACTS_STATE: ArtifactsBridgeState = Object.freeze({
  unlocked: false,
  slotCount: ARTIFACTS_SLOT_COUNT,
  activeSlots: Array.from({ length: ARTIFACTS_SLOT_COUNT }, () => null),
  artifacts: [],
});
