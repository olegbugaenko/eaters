import type { UnitTargetingMode, UnitTargetingSettings } from "../types/unit-targeting";

export const DEFAULT_UNIT_TARGETING_MODE: UnitTargetingMode = "nearest";

export const DEFAULT_UNIT_TARGETING_SETTINGS: UnitTargetingSettings = Object.freeze({
  mode: DEFAULT_UNIT_TARGETING_MODE,
});
