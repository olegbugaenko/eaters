import type { MapId } from "@db/maps/maps-db";
import type { SkillId } from "@db/skills-db";
import type { UnitModuleId } from "@db/unit-modules-db";
import type { LanguageEntry } from "@db/languages-db";

export type SupportedLanguage = "en" | "ua" | "de" | "pl" | "ru";

export interface LocalizedSkillText {
  readonly name: string;
  readonly description: string;
}

export interface LocalizedUnitModuleText {
  readonly name: string;
  readonly description: string;
  readonly bonusLabel: string;
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
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    localization: LocalizationServiceUiApi;
  }
}
