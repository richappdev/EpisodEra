import {SupportedLanguage} from "./settings";

export const landingCopy: Record<
  SupportedLanguage,
  {
    brand: string;
    openApp: string;
    signIn: string;
    heroHeadline: string;
    heroSupport: string;
    primaryCta: string;
    secondaryCta: string;
    sections: Array<{eyebrow: string; title: string; body: string}>;
    closeHeadline: string;
    closeSupport: string;
    closeCta: string;
  }
> = {
  "en-US": {
    brand: "Episodera",
    openApp: "Open app",
    signIn: "Sign in",
    heroHeadline: "Your watching memory, in one place.",
    heroSupport: "Track movies, shows, and next episodes—then keep the story of what you watched.",
    primaryCta: "Create free account",
    secondaryCta: "Browse trending",
    sections: [
      {
        eyebrow: "Track",
        title: "Never lose the next episode.",
        body: "Save a watchlist, mark seasons and episodes, and pick up from Continue Watching with the next unwatched episode ready.",
      },
      {
        eyebrow: "Remember",
        title: "A diary for everything you finish.",
        body: "Build a personal timeline of movies and episodes, then revisit the year with a cinematic Year Recap.",
      },
      {
        eyebrow: "Discover",
        title: "Find what to watch next.",
        body: "Explore trending titles, mood-based suggestions, and curated franchises so universe progress stays in order.",
      },
    ],
    closeHeadline: "Bring your history here—then make it memorable.",
    closeSupport: "Free to start. Sync watchlist, progress, and timeline across sessions.",
    closeCta: "Join Episodera",
  },
  "zh-TW": {
    brand: "Episodera",
    openApp: "開啟應用",
    signIn: "登入",
    heroHeadline: "把觀看記憶，收在同一個地方。",
    heroSupport: "追蹤電影、影集與下一集——並留下你看過什麼的故事。",
    primaryCta: "免費建立帳號",
    secondaryCta: "瀏覽熱門",
    sections: [
      {
        eyebrow: "追蹤",
        title: "下一集不再迷路。",
        body: "收藏待看清單、標記季與集進度，並從「繼續觀看」直接接上下一集未看內容。",
      },
      {
        eyebrow: "記憶",
        title: "完成作品的個人日記。",
        body: "累積電影與影集的時間軸，再用電影感的年度回顧重溫一整年。",
      },
      {
        eyebrow: "探索",
        title: "找到下一部想看的。",
        body: "瀏覽熱門、依心情推薦，以及策展片單宇宙，按發行或時間線追進度。",
      },
    ],
    closeHeadline: "把觀看紀錄帶來——再讓它變得難忘。",
    closeSupport: "免費開始。登入後即可同步待看清單、進度與時間軸。",
    closeCta: "加入 Episodera",
  },
};
