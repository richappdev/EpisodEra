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
    [paths.dailyPuzzle]: "Daily puzzle",
    [paths.adminPuzzles]: "Puzzle studio",
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
    [paths.dailyPuzzle]: "每日謎題",
    [paths.adminPuzzles]: "謎題工作室",
    [paths.social]: "社群",
    [paths.profile]: "個人檔案",
    [paths.settings]: "設定",
    [paths.privacy]: "隱私權",
    [paths.login]: "登入",
    [paths.signup]: "建立帳號",
  },
};

const siteBlockedTitles: Record<SupportedLanguage, string> = {
  "en-US": "Under optimization",
  "zh-TW": "網站優化中",
};

export const htmlLangFor = (language: SupportedLanguage): string =>
  language === "zh-TW" ? "zh-Hant" : "en";

export const brandedPageTitle = (label: string): string => `${label} · Episodera`;

export const mediaDetailPageLabel = (
  title: string,
  options: {language: SupportedLanguage; seasonNumber?: number | null} = {
    language: "en-US",
  },
): string => {
  if (options.seasonNumber == null) {
    return title;
  }

  return options.language === "zh-TW"
    ? `${title} · 第 ${options.seasonNumber} 季`
    : `${title} · Season ${options.seasonNumber}`;
};

export const titleForPath = (pathname: string, language: SupportedLanguage): string => {
  const defaults = defaultSeoCopy[language];
  if (isLandingPath(pathname)) {
    return defaults.title;
  }

  const exact = pageTitles[language][pathname];
  if (exact) {
    return brandedPageTitle(exact);
  }

  if (pathname.startsWith("/list/")) {
    return brandedPageTitle(language === "zh-TW" ? "清單" : "List");
  }

  if (pathname.startsWith("/movie/")) {
    return brandedPageTitle(language === "zh-TW" ? "電影" : "Movie");
  }

  if (pathname.startsWith("/tv/")) {
    return brandedPageTitle(language === "zh-TW" ? "影集" : "TV show");
  }

  if (pathname.startsWith(`${paths.franchises}/`)) {
    return brandedPageTitle(language === "zh-TW" ? "片單宇宙" : "Franchise");
  }

  if (pathname.startsWith(`${paths.play}/`)) {
    return brandedPageTitle(language === "zh-TW" ? "遊戲" : "Play");
  }

  return defaults.title;
};

const setMetaContent = (selector: string, content: string) => {
  const el = document.querySelector(selector);
  if (el) {
    el.setAttribute("content", content);
  }
};

const setDocumentTitle = (title: string) => {
  document.title = title;
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[name="twitter:title"]', title);
};

export const applyBrandedDocumentTitle = (label: string) => {
  setDocumentTitle(brandedPageTitle(label));
};

export const applyDocumentSeo = (
  pathname: string,
  language: SupportedLanguage,
  options: {pageLabel?: string | null; siteBlocked?: boolean} = {},
) => {
  const defaults = defaultSeoCopy[language];
  const title = options.siteBlocked
    ? brandedPageTitle(siteBlockedTitles[language])
    : options.pageLabel
      ? brandedPageTitle(options.pageLabel)
      : titleForPath(pathname, language);

  document.documentElement.lang = htmlLangFor(language);
  setDocumentTitle(title);
  setMetaContent('meta[name="description"]', defaults.description);
  setMetaContent('meta[property="og:description"]', defaults.description);
  setMetaContent('meta[property="og:locale"]', language === "zh-TW" ? "zh_TW" : "en_US");
  setMetaContent('meta[name="twitter:description"]', defaults.description);
};
