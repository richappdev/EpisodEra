export const supportedLanguages = ["en-US", "zh-TW"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export interface UserSettings {
  autoMarkPreviousEpisodesWatched: boolean;
  language: SupportedLanguage;
  preferredProviderIds: number[];
  watchRegion: string;
  achievementsEnabled: boolean;
  showAchievementsOnProfile: boolean;
  shareActivityWithFriends: boolean;
  allowFriendRequests: boolean;
  hideSpoilersUntilWatched: boolean;
  updatedAt: string | null;
}

export const languageLabels: Record<SupportedLanguage, string> = {
  "en-US": "English",
  "zh-TW": "Traditional Chinese",
};

export const isSupportedLanguage = (value: string | null): value is SupportedLanguage =>
  supportedLanguages.includes(value as SupportedLanguage);

export const commonStreamingProviders = [
  {id: 8, name: "Netflix"},
  {id: 9, name: "Amazon Prime Video"},
  {id: 15, name: "Hulu"},
  {id: 337, name: "Disney+"},
  {id: 350, name: "Apple TV+"},
  {id: 1899, name: "Max"},
] as const;

export const uiCopy = {
  "en-US": {
    topBar: {
      tagline: "Track movies, shows, and next episodes",
      home: "Home",
      trending: "Trending",
      search: "Search",
      watchlist: "Watchlist",
      timeline: "Timeline",
      franchises: "Franchises",
      play: "Puzzle",
      social: "Social",
      profile: "Profile",
      settings: "Settings",
      signIn: "Sign in",
      signOut: "Sign out",
    },
    settings: {
      eyebrow: "Settings",
      title: "Settings",
      languageTitle: "Language",
      languageFieldLabel: "App language",
      languageNote: "Metadata is loaded from TMDb in the selected language where available. Unsupported locales fall back to English.",
      progressTitle: "Episode progress",
      autoMarkPreviousLabel: "Automatically mark earlier episodes watched",
      autoMarkPreviousNote:
        "When enabled, marking a later episode watched also marks earlier unwatched episodes in that season.",
      providersTitle: "Streaming providers",
      providersNote: "Suggestions prefer titles available on your selected services when provider data is available.",
      regionLabel: "Watch region",
      privacyTitle: "Privacy and social",
      achievementsEnabledLabel: "Enable achievements",
      achievementsEnabledNote: "Turn off to hide achievement progress and stop calculating badges.",
      showAchievementsLabel: "Show achievements on profile",
      shareActivityLabel: "Share recent watching with friends",
      allowFriendRequestsLabel: "Allow friend requests",
      hideSpoilersLabel: "Hide spoilers until I have watched the title",
      signedOutNote: "Sign in to sync these preferences across sessions. This device still uses them now.",
      saving: "Saving settings...",
    },
    search: {
      noResults: "No results found.",
    },
  },
  "zh-TW": {
    topBar: {
      tagline: "追蹤電影、影集與下一集",
      home: "首頁",
      trending: "熱門",
      search: "搜尋",
      watchlist: "片單",
      timeline: "時間軸",
      franchises: "系列宇宙",
      play: "謎題",
      social: "社交",
      profile: "個人檔案",
      settings: "設定",
      signIn: "登入",
      signOut: "登出",
    },
    settings: {
      eyebrow: "設定",
      title: "設定",
      languageTitle: "語言",
      languageFieldLabel: "應用程式語言",
      languageNote: "中繼資料會優先使用 TMDb 支援的所選語言；不支援的地區設定會回退為英文。",
      progressTitle: "集數進度",
      autoMarkPreviousLabel: "自動將較早集數標記為已觀看",
      autoMarkPreviousNote: "啟用後，將較後面的集數標記為已觀看時，也會標記同季中較早且尚未觀看的集數。",
      providersTitle: "串流平台",
      providersNote: "有平台資料時，推薦會優先顯示你所選服務上的片單。",
      regionLabel: "觀看地區",
      privacyTitle: "隱私與社交",
      achievementsEnabledLabel: "啟用成就",
      achievementsEnabledNote: "關閉後將隱藏成就進度並停止計算徽章。",
      showAchievementsLabel: "在個人檔案顯示成就",
      shareActivityLabel: "與好友分享近期觀看",
      allowFriendRequestsLabel: "允許好友邀請",
      hideSpoilersLabel: "觀看前隱藏劇透",
      signedOutNote: "登入後可跨工作階段同步這些偏好。此裝置現在仍會套用這些設定。",
      saving: "正在儲存設定...",
    },
    search: {
      noResults: "找不到結果。",
    },
  },
} as const satisfies Record<SupportedLanguage, object>;
