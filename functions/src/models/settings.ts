export const supportedLanguages = ["en-US", "zh-TW"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export interface UserSettings {
  language: SupportedLanguage;
  updatedAt: string | null;
}
