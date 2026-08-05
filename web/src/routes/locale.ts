import {
  isSupportedLanguage,
  isUrlLocale,
  languageForUrlLocale,
  urlLocaleForLanguage,
  type SupportedLanguage,
  type UrlLocale,
} from "../types/settings";

export const languageStorageKey = "episodera.language";
export const defaultLanguage: SupportedLanguage = "en-US";

export interface LocalizedPath {
  language: SupportedLanguage;
  pathname: string;
  urlLocale: UrlLocale;
}

const normalizedPathname = (pathname: string): string => {
  if (!pathname || pathname === "/") {
    return "/";
  }
  return `/${pathname.replace(/^\/+|\/+$/g, "")}`;
};

export const parseLocalizedPath = (pathname: string): LocalizedPath | null => {
  const normalized = normalizedPathname(pathname);
  const [, candidate = "", ...segments] = normalized.split("/");
  const lowered = candidate.toLowerCase();
  if (!isUrlLocale(lowered)) {
    return null;
  }

  return {
    language: languageForUrlLocale(lowered),
    pathname: segments.length ? `/${segments.join("/")}` : "/",
    urlLocale: lowered,
  };
};

export const stripLocalePrefix = (pathname: string): string =>
  parseLocalizedPath(pathname)?.pathname ?? normalizedPathname(pathname);

export const localizePath = (pathname: string, urlLocale: UrlLocale): string => {
  const basePath = stripLocalePrefix(pathname);
  return basePath === "/" ? `/${urlLocale}` : `/${urlLocale}${basePath}`;
};

export const replaceLocationLanguage = (
  location: Pick<Location, "pathname" | "search" | "hash">,
  language: SupportedLanguage,
): string =>
  `${localizePath(location.pathname, urlLocaleForLanguage(language))}${location.search}${location.hash}`;

export const browserPreferredLanguage = (languages: readonly string[]): SupportedLanguage => {
  for (const language of languages) {
    const normalized = language.toLowerCase();
    if (normalized === "zh-tw" || normalized.startsWith("zh-hant")) {
      return "zh-TW";
    }
    if (normalized === "en" || normalized.startsWith("en-")) {
      return "en-US";
    }
  }
  return defaultLanguage;
};

export const localPreferredLanguage = (): SupportedLanguage => {
  const stored = window.localStorage.getItem(languageStorageKey);
  if (isSupportedLanguage(stored)) {
    return stored;
  }
  return browserPreferredLanguage(window.navigator.languages ?? [window.navigator.language]);
};
