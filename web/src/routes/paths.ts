import {MediaSummary} from "../types/media";

export type NavView =
  | "trending"
  | "search"
  | "watchlist"
  | "timeline"
  | "franchises"
  | "social"
  | "profile"
  | "settings";

export const paths = {
  home: "/",
  search: "/search",
  searchQuery: (query: string) => `/search?q=${encodeURIComponent(query)}`,
  movie: (id: number | string) => `/movie/${id}`,
  tv: (id: number | string) => `/tv/${id}`,
  tvSeason: (id: number | string, seasonNumber: number | string) => `/tv/${id}/season/${seasonNumber}`,
  watchlist: "/watchlist",
  continueWatching: "/continue-watching",
  timeline: "/timeline",
  franchises: "/franchises",
  franchise: (slug: string) => `/franchises/${encodeURIComponent(slug)}`,
  social: "/social",
  profile: "/profile",
  settings: "/settings",
  privacy: "/privacy",
  login: "/login",
  signup: "/signup",
} as const;

export const mediaPath = (item: Pick<MediaSummary, "mediaType" | "id">) =>
  item.mediaType === "movie" ? paths.movie(item.id) : paths.tv(item.id);

export const navFromPath = (pathname: string): NavView => {
  if (pathname.startsWith("/search")) {
    return "search";
  }
  if (pathname.startsWith("/watchlist") || pathname.startsWith("/continue-watching")) {
    return "watchlist";
  }
  if (pathname.startsWith("/timeline")) {
    return "timeline";
  }
  if (pathname.startsWith("/franchises")) {
    return "franchises";
  }
  if (pathname.startsWith("/social")) {
    return "social";
  }
  if (pathname.startsWith("/profile")) {
    return "profile";
  }
  if (pathname.startsWith("/settings")) {
    return "settings";
  }
  return "trending";
};

export const isDetailPath = (pathname: string) =>
  pathname.startsWith("/movie/") || pathname.startsWith("/tv/");
