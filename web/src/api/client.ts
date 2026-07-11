import {DiscoveryResponse, MediaDetail, MediaType, TvSeasonDetail} from "../types/media";
import {HistoryResponse} from "../types/history";
import {
  BatchEpisodeProgressInput,
  MarkEpisodeWatchedInput,
  ProgressListResponse,
  ProgressResponse,
  ShowProgress,
} from "../types/progress";
import {SupportedLanguage, UserSettings} from "../types/settings";
import {UserStats} from "../types/stats";
import {AddWatchlistItemInput, WatchlistItem, WatchlistResponse, WatchlistStatus} from "../types/watchlist";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5001/episodera/us-central1/api";

let tokenProvider: (() => Promise<string | null>) | null = null;

export const setApiTokenProvider = (provider: () => Promise<string | null>) => {
  tokenProvider = provider;
};

interface RequestOptions {
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
}

const withLanguage = (path: string, language: SupportedLanguage) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}language=${encodeURIComponent(language)}`;
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const token = tokenProvider ? await tokenProvider() : null;
  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    const message = payload?.error?.message ?? "Request failed.";
    throw new Error(message);
  }

  return payload as T;
};

export const api = {
  trending: (language: SupportedLanguage) => request<DiscoveryResponse>(withLanguage("/trending", language)),
  trendingMovies: (language: SupportedLanguage) =>
    request<DiscoveryResponse["movies"]>(withLanguage("/trending/movie", language)),
  trendingShows: (language: SupportedLanguage) =>
    request<DiscoveryResponse["tv"]>(withLanguage("/trending/tv", language)),
  search: (query: string, language: SupportedLanguage) =>
    request<DiscoveryResponse>(withLanguage(`/search?q=${encodeURIComponent(query)}`, language)),
  detail: (mediaType: MediaType, id: number, language: SupportedLanguage) =>
    request<MediaDetail>(withLanguage(`/${mediaType}/${id}`, language)),
  tvSeason: (id: number, seasonNumber: number, language: SupportedLanguage) =>
    request<TvSeasonDetail>(withLanguage(`/tv/${id}/season/${seasonNumber}`, language)),
  listProgress: () => request<ProgressListResponse>("/progress"),
  getProgress: (showId: number) => request<ProgressResponse>(`/progress/${showId}`),
  markEpisodeWatched: (showId: number, input: MarkEpisodeWatchedInput) =>
    request<ShowProgress>(`/progress/${showId}/episode`, {method: "POST", body: input}),
  updateEpisodes: (showId: number, input: BatchEpisodeProgressInput) =>
    request<ShowProgress>(`/progress/${showId}/episodes/batch`, {method: "POST", body: input}),
  markEpisodeUnwatched: (showId: number, episodeKey: string) =>
    request<ProgressResponse>(`/progress/${showId}/episode/${episodeKey}`, {method: "DELETE"}),
  meHistory: () => request<HistoryResponse>("/me/history"),
  meSettings: () => request<UserSettings>("/me/settings"),
  updateMeSettings: (settings: Partial<Pick<UserSettings, "autoMarkPreviousEpisodesWatched" | "language">>) =>
    request<UserSettings>("/me/settings", {method: "PATCH", body: settings}),
  meStats: () => request<UserStats>("/me/stats"),
  listWatchlist: () => request<WatchlistResponse>("/watchlist"),
  addWatchlistItem: (input: AddWatchlistItemInput) =>
    request<WatchlistItem>("/watchlist", {method: "POST", body: input}),
  updateWatchlistStatus: (itemId: string, status: WatchlistStatus) =>
    request<WatchlistItem>(`/watchlist/${itemId}/status`, {method: "PATCH", body: {status}}),
  removeWatchlistItem: (itemId: string) => request<null>(`/watchlist/${itemId}`, {method: "DELETE"}),
};
