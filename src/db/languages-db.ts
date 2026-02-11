export const LANGUAGE_CODES = ["en", "ua"] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export interface LanguageEntry {
  readonly code: LanguageCode;
  readonly label: string;
}

export const LANGUAGES_DB: readonly LanguageEntry[] = [
  { code: "en", label: "English" },
  { code: "ua", label: "Українська" },
] as const;
