import type { MapId } from "@db/maps/maps-db";
import type { SkillId } from "@db/skills-db";
import type { UnitModuleId } from "@db/unit-modules-db";
import type { BuildingId } from "@db/buildings-db";
import type { ResourceId } from "@db/resources-db";
import type { SpellId } from "@db/spells-db";
import type { LanguageEntry } from "@db/languages-db";

export type SupportedLanguage = "en" | "ua" | "de" | "pl" | "ru";

export interface LocalizedSkillText {
  readonly name: string;
  readonly description: string;
  /** Optional text for event log when skill is obtained */
  readonly registerEventText?: string;
}

export interface LocalizedUnitModuleText {
  readonly name: string;
  readonly description: string;
  readonly bonusLabel: string;
}

export interface LocalizedBuildingText {
  readonly name: string;
  readonly description: string;
}

export interface LocalizedSpellText {
  readonly name: string;
  readonly description: string;
}

export interface LocalizationServiceUiApi {
  getLanguage(): SupportedLanguage;
  setLanguage(language: SupportedLanguage): void;
  getAvailableLanguages(): readonly LanguageEntry[];
  hasStoredLanguagePreference(): boolean;
  tUi(key: string, fallback?: string): string;
  getMapName(mapId: MapId, fallback: string): string;
  getSkillText(skillId: SkillId, fallback: LocalizedSkillText): LocalizedSkillText;
  getUnitModuleText(moduleId: UnitModuleId, fallback: LocalizedUnitModuleText): LocalizedUnitModuleText;
  getBuildingText(buildingId: BuildingId, fallback: LocalizedBuildingText): LocalizedBuildingText;
  getResourceName(resourceId: ResourceId, fallback: string): string;
  getSpellText(spellId: SpellId, fallback: LocalizedSpellText): LocalizedSpellText;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    localization: LocalizationServiceUiApi;
  }
}
