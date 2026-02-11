export const LANGUAGE_CODES = ["en", "ua", "de", "pl", "ru"] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export interface LanguageEntry {
  readonly code: LanguageCode;
  readonly label: string;
}

export const LANGUAGES_DB: readonly LanguageEntry[] = [
  { code: "en", label: "English" },
  { code: "ua", label: "Українська" },
  { code: "de", label: "Deutch" },
  { code: "pl", label: "Polska" },
  { code: "ru", label: "Русский" },
] as const;
