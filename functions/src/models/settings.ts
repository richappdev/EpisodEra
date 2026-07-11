export const supportedLanguages = ["en-US", "zh-TW"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export interface UserSettings {
  autoMarkPreviousEpisodesWatched: boolean;
  language: SupportedLanguage;
  updatedAt: string | null;
}
