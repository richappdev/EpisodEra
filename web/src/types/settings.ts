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

export const uiCopy = {
  "en-US": {
    topBar: {
      tagline: "Track movies, shows, and next episodes",
      trending: "Trending",
      search: "Search",
      watchlist: "Watchlist",
      profile: "Profile",
      settings: "Settings",
      signIn: "Sign in",
      signOut: "Sign out",
    },
    settings: {
      eyebrow: "Settings",
      title: "Language",
      fieldLabel: "App language",
      note: "Metadata is loaded from TMDb in the selected language where available. Unsupported locales fall back to English.",
      signedOutNote: "Sign in to sync this preference across sessions. This device still uses it now.",
      saving: "Saving language...",
    },
    search: {
      noResults: "No results found.",
    },
  },
  "zh-TW": {
    topBar: {
      tagline: "追蹤電影、影集與下一集",
      trending: "熱門",
      search: "搜尋",
      watchlist: "片單",
      profile: "個人檔案",
      settings: "設定",
      signIn: "登入",
      signOut: "登出",
    },
    settings: {
      eyebrow: "設定",
      title: "語言",
      fieldLabel: "應用程式語言",
      note: "中繼資料會優先使用 TMDb 支援的所選語言；不支援的地區設定會回退為英文。",
      signedOutNote: "登入後可跨工作階段同步此偏好。此裝置現在仍會套用此設定。",
      saving: "正在儲存語言...",
    },
    search: {
      noResults: "找不到結果。",
    },
  },
} as const satisfies Record<SupportedLanguage, object>;
