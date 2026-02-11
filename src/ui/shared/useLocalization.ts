import { useMemo } from "react";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui/shared/useBridgeValue";
import { LOCALIZATION_LANGUAGE_BRIDGE_KEY } from "@logic/services/localization/localization.const";
import type { SupportedLanguage } from "@logic/services/localization/localization.types";
import type { LanguageEntry } from "@db/languages-db";

export interface LocalizationHookValue {
  readonly language: SupportedLanguage;
  readonly setLanguage: (language: SupportedLanguage) => void;
  readonly availableLanguages: readonly LanguageEntry[];
  readonly hasStoredLanguagePreference: () => boolean;
  readonly t: (key: string, fallback?: string) => string;
}

export const useLocalization = (): LocalizationHookValue => {
  const { uiApi, bridge } = useAppLogic();
  const language = useBridgeValue(bridge, LOCALIZATION_LANGUAGE_BRIDGE_KEY, "en" as SupportedLanguage);

  return useMemo(
    () => ({
      language,
      setLanguage: uiApi.localization.setLanguage,
      availableLanguages: uiApi.localization.getAvailableLanguages(),
      hasStoredLanguagePreference: uiApi.localization.hasStoredLanguagePreference,
      t: uiApi.localization.tUi,
    }),
    [
      language,
      uiApi.localization.setLanguage,
      uiApi.localization.tUi,
      uiApi.localization.hasStoredLanguagePreference,
      uiApi.localization,
    ],
  );
};
