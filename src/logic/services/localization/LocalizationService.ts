import type { DataBridge } from "@core/logic/ui/DataBridge";
import type { MapId } from "@db/maps/maps-db";
import type { SkillId } from "@db/skills-db";
import type { UnitModuleId } from "@db/unit-modules-db";
import type { BuildingId } from "@db/buildings-db";
import { LANGUAGES_DB } from "@db/languages-db";
import uiEn from "@/localization/en/ui.json";
import mapsEn from "@/localization/en/maps.json";
import skillsEn from "@/localization/en/skills.json";
import unitModulesEn from "@/localization/en/unit-modules.json";
import buildingsEn from "@/localization/en/buildings.json";
import uiUa from "@/localization/ua/ui.json";
import mapsUa from "@/localization/ua/maps.json";
import skillsUa from "@/localization/ua/skills.json";
import unitModulesUa from "@/localization/ua/unit-modules.json";
import buildingsUa from "@/localization/ua/buildings.json";
import uiDe from "@/localization/de/ui.json";
import mapsDe from "@/localization/de/maps.json";
import skillsDe from "@/localization/de/skills.json";
import unitModulesDe from "@/localization/de/unit-modules.json";
import buildingsDe from "@/localization/de/buildings.json";
import uiPl from "@/localization/pl/ui.json";
import mapsPl from "@/localization/pl/maps.json";
import skillsPl from "@/localization/pl/skills.json";
import unitModulesPl from "@/localization/pl/unit-modules.json";
import buildingsPl from "@/localization/pl/buildings.json";
import uiRu from "@/localization/ru/ui.json";
import mapsRu from "@/localization/ru/maps.json";
import skillsRu from "@/localization/ru/skills.json";
import unitModulesRu from "@/localization/ru/unit-modules.json";
import buildingsRu from "@/localization/ru/buildings.json";
import {
  DEFAULT_LANGUAGE,
  LOCALIZATION_LANGUAGE_BRIDGE_KEY,
  LOCALIZATION_STORAGE_KEY,
} from "./localization.const";
import type {
  LocalizedBuildingText,
  LocalizedSkillText,
  LocalizedUnitModuleText,
  LocalizationServiceUiApi,
  SupportedLanguage,
} from "./localization.types";

type LocalizationBundle = {
  readonly ui: Readonly<Record<string, string>>;
  readonly maps: Readonly<Record<string, { readonly name?: string }>>;
  readonly skills: Readonly<Record<string, { readonly name?: string; readonly description?: string }>>;
  readonly unitModules: Readonly<
    Record<string, { readonly name?: string; readonly description?: string; readonly bonusLabel?: string }>
  >;
  readonly buildings: Readonly<Record<string, { readonly name?: string; readonly description?: string }>>;
};

const bundles: Readonly<Record<SupportedLanguage, LocalizationBundle>> = {
  en: {
    ui: uiEn,
    maps: mapsEn,
    skills: skillsEn,
    unitModules: unitModulesEn,
    buildings: buildingsEn,
  },
  ua: {
    ui: uiUa,
    maps: mapsUa,
    skills: skillsUa,
    unitModules: unitModulesUa,
    buildings: buildingsUa,
  },
  de: {
    ui: uiDe,
    maps: mapsDe,
    skills: skillsDe,
    unitModules: unitModulesDe,
    buildings: buildingsDe,
  },
  pl: {
    ui: uiPl,
    maps: mapsPl,
    skills: skillsPl,
    unitModules: unitModulesPl,
    buildings: buildingsPl,
  },
  ru: {
    ui: uiRu,
    maps: mapsRu,
    skills: skillsRu,
    unitModules: unitModulesRu,
    buildings: buildingsRu,
  },
};

const isSupportedLanguage = (value: string): value is SupportedLanguage => value in bundles;

export class LocalizationService implements LocalizationServiceUiApi {
  private bridge: DataBridge | null = null;
  private language: SupportedLanguage = DEFAULT_LANGUAGE;

  constructor() {
    this.language = this.resolveInitialLanguage();
  }

  public attachBridge(bridge: DataBridge): void {
    this.bridge = bridge;
    this.pushLanguageToBridge();
  }

  public getLanguage(): SupportedLanguage {
    return this.language;
  }

  public setLanguage(language: SupportedLanguage): void {
    const changed = this.language !== language;
    this.language = language;
    this.persistLanguage(language);
    if (changed) {
      this.pushLanguageToBridge();
    }
  }

  public getAvailableLanguages() {
    return LANGUAGES_DB;
  }

  public hasStoredLanguagePreference(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(LOCALIZATION_STORAGE_KEY) !== null;
  }

  public tUi(key: string, fallback: string = key): string {
    const value = bundles[this.language].ui[key];
    return typeof value === "string" ? value : fallback;
  }

  public getMapName(mapId: MapId, fallback: string): string {
    const localized = bundles[this.language].maps[mapId]?.name;
    return localized ?? fallback;
  }

  public getSkillText(skillId: SkillId, fallback: LocalizedSkillText): LocalizedSkillText {
    const localized = bundles[this.language].skills[skillId];
    return {
      name: localized?.name ?? fallback.name,
      description: localized?.description ?? fallback.description,
    };
  }

  public getUnitModuleText(
    moduleId: UnitModuleId,
    fallback: LocalizedUnitModuleText,
  ): LocalizedUnitModuleText {
    const localized = bundles[this.language].unitModules[moduleId];
    return {
      name: localized?.name ?? fallback.name,
      description: localized?.description ?? fallback.description,
      bonusLabel: localized?.bonusLabel ?? fallback.bonusLabel,
    };
  }

  public getBuildingText(buildingId: BuildingId, fallback: LocalizedBuildingText): LocalizedBuildingText {
    const localized = bundles[this.language].buildings[buildingId];
    return {
      name: localized?.name ?? fallback.name,
      description: localized?.description ?? fallback.description,
    };
  }

  private resolveInitialLanguage(): SupportedLanguage {
    if (typeof window === "undefined") {
      return DEFAULT_LANGUAGE;
    }
    const stored = window.localStorage.getItem(LOCALIZATION_STORAGE_KEY);
    if (stored && isSupportedLanguage(stored)) {
      return stored;
    }
    return DEFAULT_LANGUAGE;
  }

  private persistLanguage(language: SupportedLanguage): void {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(LOCALIZATION_STORAGE_KEY, language);
  }

  private pushLanguageToBridge(): void {
    if (!this.bridge) {
      return;
    }
    this.bridge.setValue(LOCALIZATION_LANGUAGE_BRIDGE_KEY, this.language);
  }
}
