import {isLandingPath, routePaths} from "../routes/paths";
import {localizePath, parseLocalizedPath, stripLocalePrefix} from "../routes/locale";
import {SupportedLanguage, urlLocaleForLanguage} from "../types/settings";

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
    [routePaths.home]: "Home",
    [routePaths.search]: "Search",
    [routePaths.watchlist]: "Watchlist",
    [routePaths.continueWatching]: "Continue watching",
    [routePaths.timeline]: "Timeline",
    [routePaths.franchises]: "Franchises",
    [routePaths.dailyPuzzle]: "Daily puzzle",
    [routePaths.adminPuzzles]: "Puzzle studio",
    [routePaths.social]: "Social",
    [routePaths.profile]: "Profile",
    [routePaths.settings]: "Settings",
    [routePaths.privacy]: "Privacy",
    [routePaths.login]: "Sign in",
    [routePaths.signup]: "Create account",
  },
  "zh-TW": {
    [routePaths.home]: "首頁",
    [routePaths.search]: "搜尋",
    [routePaths.watchlist]: "待看清單",
    [routePaths.continueWatching]: "繼續觀看",
    [routePaths.timeline]: "時間軸",
    [routePaths.franchises]: "片單宇宙",
    [routePaths.dailyPuzzle]: "每日謎題",
    [routePaths.adminPuzzles]: "謎題工作室",
    [routePaths.social]: "社群",
    [routePaths.profile]: "個人檔案",
    [routePaths.settings]: "設定",
    [routePaths.privacy]: "隱私權",
    [routePaths.login]: "登入",
    [routePaths.signup]: "建立帳號",
  },
};

const siteBlockedTitles: Record<SupportedLanguage, string> = {
  "en-US": "Under optimization",
  "zh-TW": "網站優化中",
};

export const htmlLangFor = (language: SupportedLanguage): string =>
  language === "zh-TW" ? "zh-Hant-TW" : "en-US";

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
  const routePath = stripLocalePrefix(pathname);
  const defaults = defaultSeoCopy[language];
  if (isLandingPath(routePath)) {
    return defaults.title;
  }

  const exact = pageTitles[language][routePath];
  if (exact) {
    return brandedPageTitle(exact);
  }

  if (routePath.startsWith("/list/")) {
    return brandedPageTitle(language === "zh-TW" ? "清單" : "List");
  }

  if (routePath.startsWith("/movie/")) {
    return brandedPageTitle(language === "zh-TW" ? "電影" : "Movie");
  }

  if (routePath.startsWith("/tv/")) {
    return brandedPageTitle(language === "zh-TW" ? "影集" : "TV show");
  }

  if (routePath.startsWith(`${routePaths.franchises}/`)) {
    return brandedPageTitle(language === "zh-TW" ? "片單宇宙" : "Franchise");
  }

  if (routePath.startsWith(`${routePaths.play}/`)) {
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

const ensureMeta = (selector: string, attributes: Record<string, string>) => {
  let element = document.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element?.setAttribute(name, value));
};

const ensureLink = (key: string, attributes: Record<string, string>) => {
  const semanticSelector = key === "canonical"
    ? 'link[rel="canonical"]'
    : key.startsWith("alternate-")
      ? `link[rel="alternate"][hreflang="${key.slice("alternate-".length)}"]`
      : `link[data-seo-key="${key}"]`;
  let element = document.querySelector<HTMLLinkElement>(semanticSelector);
  if (!element) {
    element = document.createElement("link");
    element.dataset.seoKey = key;
    document.head.appendChild(element);
  }
  element.dataset.seoKey = key;
  Object.entries(attributes).forEach(([name, value]) => element?.setAttribute(name, value));
};

const removeLocalizedLinks = () => {
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((element) => element.remove());
};

export const isIndexablePath = (pathname: string): boolean => {
  if (!parseLocalizedPath(pathname)) return false;
  const routePath = stripLocalePrefix(pathname);
  return (
    routePath === routePaths.landing ||
    routePath === routePaths.home ||
    routePath === routePaths.franchises ||
    routePath.startsWith(`${routePaths.franchises}/`) ||
    routePath.startsWith("/movie/") ||
    routePath.startsWith("/tv/") ||
    routePath.startsWith("/list/") ||
    routePath === routePaths.dailyPuzzle ||
    routePath === routePaths.privacy
  );
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
  const indexable = isIndexablePath(pathname) && !options.siteBlocked;
  ensureMeta('meta[name="robots"]', {name: "robots", content: indexable ? "index,follow" : "noindex,follow"});

  if (!parseLocalizedPath(pathname)) {
    document.querySelector('link[data-seo-key="canonical"]')?.remove();
    removeLocalizedLinks();
    return;
  }

  const canonicalUrl = `${siteOrigin}${pathname}`;
  ensureLink("canonical", {rel: "canonical", href: canonicalUrl});
  ensureMeta('meta[property="og:url"]', {property: "og:url", content: canonicalUrl});
  if (!indexable) {
    removeLocalizedLinks();
    return;
  }

  const basePath = stripLocalePrefix(pathname);
  const alternates: Array<[string, SupportedLanguage]> = [
    ["en-US", "en-US"],
    ["zh-TW", "zh-TW"],
  ];
  alternates.forEach(([hreflang, alternateLanguage]) => {
    ensureLink(`alternate-${hreflang}`, {
      rel: "alternate",
      hreflang,
      href: `${siteOrigin}${localizePath(basePath, urlLocaleForLanguage(alternateLanguage))}`,
    });
  });
  ensureLink("alternate-x-default", {
    rel: "alternate",
    hreflang: "x-default",
    href: `${siteOrigin}${localizePath(basePath, "en-us")}`,
  });
};
