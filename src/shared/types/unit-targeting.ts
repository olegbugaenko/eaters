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

export type UnitTargetingSettingsMap = Readonly<Record<string, UnitTargetingSettings>>;
