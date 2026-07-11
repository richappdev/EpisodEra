export const supportedLanguages = ["en-US", "zh-TW"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export interface UserSettings {
  language: SupportedLanguage;
  updatedAt: string | null;
}

export const languageLabels: Record<SupportedLanguage, string> = {
  "en-US": "English",
  "zh-TW": "Traditional Chinese",
};

export const isSupportedLanguage = (value: string | null): value is SupportedLanguage =>
  supportedLanguages.includes(value as SupportedLanguage);
