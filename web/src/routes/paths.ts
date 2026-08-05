import {MediaSummary} from "../types/media";
import type {UrlLocale} from "../types/settings";
import {localizePath, stripLocalePrefix} from "./locale";

export type NavView =
  | "trending"
  | "search"
  | "watchlist"
  | "likes"
  | "timeline"
  | "franchises"
  | "social"
  | "profile"
  | "settings"
  | "play";

/** Single product canvas — dark cinema across all routes. */
export type CanvasMode = "cinema";

export const routePaths = {
  landing: "/",
  home: "/home",
  landingLegacy: "/landing",
  search: "/search",
  watchlist: "/watchlist",
  likes: "/likes",
  continueWatching: "/continue-watching",
  timeline: "/timeline",
  franchises: "/franchises",
  play: "/play",
  dailyPuzzle: "/play/daily-puzzle",
  adminPuzzles: "/admin/puzzles",
  social: "/social",
  profile: "/profile",
  settings: "/settings",
  privacy: "/privacy",
  login: "/login",
  signup: "/signup",
} as const;

export const paths = {
  landing: (locale: UrlLocale) => localizePath(routePaths.landing, locale),
  home: (locale: UrlLocale) => localizePath(routePaths.home, locale),
  landingLegacy: (locale: UrlLocale) => localizePath(routePaths.landingLegacy, locale),
  search: (locale: UrlLocale) => localizePath(routePaths.search, locale),
  searchQuery: (locale: UrlLocale, query: string) =>
    `${localizePath(routePaths.search, locale)}?q=${encodeURIComponent(query)}`,
  movie: (locale: UrlLocale, id: number | string) => localizePath(`/movie/${id}`, locale),
  tv: (locale: UrlLocale, id: number | string) => localizePath(`/tv/${id}`, locale),
  tvSeason: (locale: UrlLocale, id: number | string, seasonNumber: number | string) =>
    localizePath(`/tv/${id}/season/${seasonNumber}`, locale),
  watchlist: (locale: UrlLocale) => localizePath(routePaths.watchlist, locale),
  likes: (locale: UrlLocale) => localizePath(routePaths.likes, locale),
  continueWatching: (locale: UrlLocale) => localizePath(routePaths.continueWatching, locale),
  timeline: (locale: UrlLocale) => localizePath(routePaths.timeline, locale),
  franchises: (locale: UrlLocale) => localizePath(routePaths.franchises, locale),
  franchise: (locale: UrlLocale, slug: string) =>
    localizePath(`/franchises/${encodeURIComponent(slug)}`, locale),
  list: (locale: UrlLocale, listId: string) => localizePath(`/list/${encodeURIComponent(listId)}`, locale),
  play: (locale: UrlLocale) => localizePath(routePaths.play, locale),
  dailyPuzzle: (locale: UrlLocale) => localizePath(routePaths.dailyPuzzle, locale),
  playGame: (locale: UrlLocale, slug: string) => localizePath(`/play/${encodeURIComponent(slug)}`, locale),
  adminPuzzles: (locale: UrlLocale) => localizePath(routePaths.adminPuzzles, locale),
  social: (locale: UrlLocale) => localizePath(routePaths.social, locale),
  profile: (locale: UrlLocale) => localizePath(routePaths.profile, locale),
  settings: (locale: UrlLocale) => localizePath(routePaths.settings, locale),
  privacy: (locale: UrlLocale) => localizePath(routePaths.privacy, locale),
  login: (locale: UrlLocale) => localizePath(routePaths.login, locale),
  signup: (locale: UrlLocale) => localizePath(routePaths.signup, locale),
} as const;

export const mediaPath = (locale: UrlLocale, item: Pick<MediaSummary, "mediaType" | "id">) =>
  item.mediaType === "movie" ? paths.movie(locale, item.id) : paths.tv(locale, item.id);

export const isLandingPath = (pathname: string) => {
  const routePath = stripLocalePrefix(pathname);
  return routePath === routePaths.landing || routePath === routePaths.landingLegacy;
};

export const navFromPath = (pathname: string): NavView => {
  const routePath = stripLocalePrefix(pathname);
  if (routePath.startsWith("/search")) return "search";
  if (routePath === routePaths.home || routePath.startsWith(`${routePaths.home}/`)) return "trending";
  if (routePath.startsWith("/continue-watching") || routePath.startsWith("/watchlist")) return "watchlist";
  if (routePath.startsWith("/likes")) return "likes";
  if (routePath.startsWith("/timeline")) return "timeline";
  if (routePath.startsWith("/franchises")) return "franchises";
  if (routePath.startsWith("/play") || routePath.startsWith("/admin/puzzles")) return "play";
  if (routePath.startsWith("/list/")) return "trending";
  if (routePath.startsWith("/social")) return "social";
  if (routePath.startsWith("/profile")) return "profile";
  if (routePath.startsWith("/settings")) return "settings";
  return "trending";
};

export const isDetailPath = (pathname: string) => {
  const routePath = stripLocalePrefix(pathname);
  return routePath.startsWith("/movie/") || routePath.startsWith("/tv/");
};

export const canvasFromPath = (_pathname: string): CanvasMode => "cinema";
