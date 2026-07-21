import {isLandingPath, paths} from "../routes/paths";
import {SupportedLanguage} from "../types/settings";

export const siteOrigin = "https://episodera.web.app";

export const defaultSeoCopy: Record<
  SupportedLanguage,
  {title: string; description: string}
> = {
  "en-US": {
    title: "Episodera — Track shows, episodes & watch history",
    description:
      "Track movies and TV, never lose the next episode, and keep a personal diary of what you watched. Free watchlist, progress, and year recap — all in Episodera.",
  },
  "zh-TW": {
    title: "Episodera — 追蹤影集、集數與觀看紀錄",
    description:
      "追蹤電影與影集、不再錯過下一集，並留下你看過什麼的個人日記。免費待看清單、進度同步與年度回顧，都在 Episodera。",
  },
};

const pageTitles: Record<SupportedLanguage, Partial<Record<string, string>>> = {
  "en-US": {
    [paths.home]: "Home",
    [paths.search]: "Search",
    [paths.watchlist]: "Watchlist",
    [paths.continueWatching]: "Continue watching",
    [paths.timeline]: "Timeline",
    [paths.franchises]: "Franchises",
    [paths.social]: "Social",
    [paths.profile]: "Profile",
    [paths.settings]: "Settings",
    [paths.privacy]: "Privacy",
    [paths.login]: "Sign in",
    [paths.signup]: "Create account",
  },
  "zh-TW": {
    [paths.home]: "首頁",
    [paths.search]: "搜尋",
    [paths.watchlist]: "待看清單",
    [paths.continueWatching]: "繼續觀看",
    [paths.timeline]: "時間軸",
    [paths.franchises]: "片單宇宙",
    [paths.social]: "社群",
    [paths.profile]: "個人檔案",
    [paths.settings]: "設定",
    [paths.privacy]: "隱私權",
    [paths.login]: "登入",
    [paths.signup]: "建立帳號",
  },
};

export const htmlLangFor = (language: SupportedLanguage): string =>
  language === "zh-TW" ? "zh-Hant" : "en";

export const titleForPath = (pathname: string, language: SupportedLanguage): string => {
  const defaults = defaultSeoCopy[language];
  if (isLandingPath(pathname)) {
    return defaults.title;
  }

  const exact = pageTitles[language][pathname];
  if (exact) {
    return `${exact} · Episodera`;
  }

  if (pathname.startsWith("/movie/") || pathname.startsWith("/tv/")) {
    return language === "zh-TW" ? "作品詳情 · Episodera" : "Title · Episodera";
  }

  if (pathname.startsWith(`${paths.franchises}/`)) {
    return language === "zh-TW" ? "片單宇宙 · Episodera" : "Franchise · Episodera";
  }

  return defaults.title;
};

const setMetaContent = (selector: string, content: string) => {
  const el = document.querySelector(selector);
  if (el) {
    el.setAttribute("content", content);
  }
};

export const applyDocumentSeo = (pathname: string, language: SupportedLanguage) => {
  const defaults = defaultSeoCopy[language];
  const title = titleForPath(pathname, language);

  document.documentElement.lang = htmlLangFor(language);
  document.title = title;
  setMetaContent('meta[name="description"]', defaults.description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', defaults.description);
  setMetaContent('meta[property="og:locale"]', language === "zh-TW" ? "zh_TW" : "en_US");
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', defaults.description);
};
