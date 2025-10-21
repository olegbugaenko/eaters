export type UnitTargetingMode =
  | "nearest"
  | "highestHp"
  | "lowestHp"
  | "highestDamage"
  | "lowestDamage"
  | "none";

export interface UnitTargetingSettings {
  readonly mode: UnitTargetingMode;
}

export const DEFAULT_UNIT_TARGETING_MODE: UnitTargetingMode = "nearest";

export const DEFAULT_UNIT_TARGETING_SETTINGS: UnitTargetingSettings = Object.freeze({
  mode: DEFAULT_UNIT_TARGETING_MODE,
});
