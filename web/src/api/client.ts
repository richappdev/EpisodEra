import {DiscoveryResponse, MediaDetail, MediaType, TvSeasonDetail} from "../types/media";
import {PaginationParams, withPagination} from "../types/pagination";
import {DiscoveryListResponse, DiscoverySuggestionsResponse} from "../types/discovery";
import {FranchiseCatalog, FranchiseOrder, FranchiseProgress, FranchiseSummary} from "../types/franchise";
import {HistoryEntry, HistoryResponse, UpdateHistoryInput} from "../types/history";
import {ProfileResponse, UpdateUserProfileInput, UserProfile} from "../types/profile";
import {
  BatchEpisodeProgressInput,
  MarkEpisodeWatchedInput,
  ProgressListResponse,
  ProgressResponse,
  ShowProgress,
} from "../types/progress";
import {SupportedLanguage, UserSettings} from "../types/settings";
import {UserStats, YearRecap} from "../types/stats";
import {AchievementsResponse} from "../types/achievement";
import {
  ActivityFeedItem,
  ChallengeProgress,
  CompatibilityResult,
  DiscussionComment,
  FriendsResponse,
} from "../types/social";
import {AddWatchlistItemInput, WatchlistItem, WatchlistResponse, WatchlistStatus} from "../types/watchlist";
import {
  ImportEpisodeInput,
  ImportJobSummary,
  ImportRunResult,
  ImportWatchlistItemInput,
  MediaMapping,
  ResolveTvTimeShowInput,
  ResolveTvTimeShowsResponse,
} from "../types/import";
import {UserDataExport} from "../types/export";
import {getAppCheckToken} from "../firebase";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5001/episodera/us-central1/api";

let tokenProvider: (() => Promise<string | null>) | null = null;

export const setApiTokenProvider = (provider: () => Promise<string | null>) => {
  tokenProvider = provider;
};

interface RequestOptions {
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token?: string | null;
}

const withLanguage = (path: string, language: SupportedLanguage) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}language=${encodeURIComponent(language)}`;
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const token = options.token !== undefined ? options.token : tokenProvider ? await tokenProvider() : null;
  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) {
    headers.set("X-Firebase-AppCheck", appCheckToken);
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

const withLanguageAndPagination = (
  path: string,
  language: SupportedLanguage,
  pagination?: PaginationParams,
) => withPagination(withLanguage(path, language), pagination);

export const api = {
  trending: (language: SupportedLanguage, pagination?: PaginationParams) =>
    request<DiscoveryResponse>(withLanguageAndPagination("/trending", language, pagination)),
  trendingMovies: (language: SupportedLanguage, pagination?: PaginationParams) =>
    request<DiscoveryResponse["movies"]>(withLanguageAndPagination("/trending/movie", language, pagination)),
  trendingShows: (language: SupportedLanguage, pagination?: PaginationParams) =>
    request<DiscoveryResponse["tv"]>(withLanguageAndPagination("/trending/tv", language, pagination)),
  search: (query: string, language: SupportedLanguage, pagination?: PaginationParams) =>
    request<DiscoveryResponse>(
      withLanguageAndPagination(`/search?q=${encodeURIComponent(query)}`, language, pagination),
    ),
  detail: (mediaType: MediaType, id: number, language: SupportedLanguage) =>
    request<MediaDetail>(withLanguage(`/${mediaType}/${id}`, language)),
  tvSeason: (id: number, seasonNumber: number, language: SupportedLanguage) =>
    request<TvSeasonDetail>(withLanguage(`/tv/${id}/season/${seasonNumber}`, language)),
  listProgress: (pagination?: PaginationParams) =>
    request<ProgressListResponse>(withPagination("/progress", pagination)),
  getProgress: (showId: number) => request<ProgressResponse>(`/progress/${showId}`),
  markEpisodeWatched: (showId: number, input: MarkEpisodeWatchedInput) =>
    request<ShowProgress>(`/progress/${showId}/episode`, {method: "POST", body: input}),
  updateEpisodes: (showId: number, input: BatchEpisodeProgressInput) =>
    request<ShowProgress>(`/progress/${showId}/episodes/batch`, {method: "POST", body: input}),
  markEpisodeUnwatched: (showId: number, episodeKey: string) =>
    request<ProgressResponse>(`/progress/${showId}/episode/${episodeKey}`, {method: "DELETE"}),
  meHistory: (pagination?: PaginationParams) =>
    request<HistoryResponse>(withPagination("/me/history", pagination)),
  meExport: () => request<UserDataExport>("/me/export"),
  updateHistoryEntry: (historyId: string, input: UpdateHistoryInput) =>
    request<HistoryEntry>(`/me/history/${encodeURIComponent(historyId)}`, {method: "PATCH", body: input}),
  deleteHistoryEntry: (historyId: string) =>
    request<null>(`/me/history/${encodeURIComponent(historyId)}`, {method: "DELETE"}),
  meProfile: () => request<ProfileResponse>("/me/profile"),
  updateMeProfile: (profile: UpdateUserProfileInput, token?: string | null) =>
    request<UserProfile>("/me/profile", {method: "PATCH", body: profile, token}),
  meSettings: () => request<UserSettings>("/me/settings"),
  updateMeSettings: (settings: Partial<UserSettings>) =>
    request<UserSettings>("/me/settings", {method: "PATCH", body: settings}),
  meStats: () => request<UserStats>("/me/stats"),
  meRecap: (year?: number) =>
    request<YearRecap>(year == null ? "/me/recap" : `/me/recap?year=${encodeURIComponent(String(year))}`),
  meAchievements: () => request<AchievementsResponse>("/me/achievements"),
  meFriends: () => request<FriendsResponse>("/me/friends"),
  requestFriend: (friendCode: string) =>
    request<FriendsResponse>("/me/friends/request", {method: "POST", body: {friendCode}}),
  updateFriendStatus: (friendUserId: string, status: "accepted" | "declined" | "removed") =>
    request<FriendsResponse>(`/me/friends/${encodeURIComponent(friendUserId)}`, {
      method: "PATCH",
      body: {status},
    }),
  meFeed: () => request<{items: ActivityFeedItem[]}>("/me/feed"),
  meCompatibility: (friendUserId: string) =>
    request<CompatibilityResult>(`/me/friends/${encodeURIComponent(friendUserId)}/compatibility`),
  meChallenges: (friendUserId?: string) =>
    request<{items: ChallengeProgress[]}>(
      friendUserId
        ? `/me/challenges?friendUserId=${encodeURIComponent(friendUserId)}`
        : "/me/challenges",
    ),
  listDiscussions: (mediaType: MediaType, id: number) =>
    request<{items: DiscussionComment[]}>(`/discussions/${mediaType}/${id}`),
  createDiscussion: (
    mediaType: MediaType,
    id: number,
    input: {body: string; seasonNumber?: number | null; episodeNumber?: number | null},
  ) => request<DiscussionComment>(`/discussions/${mediaType}/${id}`, {method: "POST", body: input}),
  listFranchises: () => request<{items: FranchiseSummary[]}>("/franchises"),
  getFranchise: (slug: string) => request<FranchiseCatalog>(`/franchises/${encodeURIComponent(slug)}`),
  meFranchiseProgress: (slug: string, order: FranchiseOrder = "release") =>
    request<FranchiseProgress>(
      `/me/franchises/${encodeURIComponent(slug)}/progress?order=${encodeURIComponent(order)}`,
    ),
  discoverSuggestions: (
    language: SupportedLanguage,
    options?: {mood?: string; maxMinutes?: number; providers?: number[]; region?: string},
  ) => {
    const params = new URLSearchParams();
    params.set("language", language);
    if (options?.mood) {
      params.set("mood", options.mood);
    }
    if (options?.maxMinutes != null) {
      params.set("maxMinutes", String(options.maxMinutes));
    }
    if (options?.providers && options.providers.length > 0) {
      params.set("providers", options.providers.join(","));
    }
    if (options?.region) {
      params.set("region", options.region);
    }
    return request<DiscoverySuggestionsResponse>(`/discover/suggestions?${params.toString()}`);
  },
  discoverList: (
    listId: string,
    language: SupportedLanguage,
    options?: {page?: number; maxMinutes?: number; providers?: number[]; region?: string},
  ) => {
    const params = new URLSearchParams();
    params.set("language", language);
    if (options?.page != null) {
      params.set("page", String(options.page));
    }
    if (options?.maxMinutes != null) {
      params.set("maxMinutes", String(options.maxMinutes));
    }
    if (options?.providers && options.providers.length > 0) {
      params.set("providers", options.providers.join(","));
    }
    if (options?.region) {
      params.set("region", options.region);
    }
    return request<DiscoveryListResponse>(
      `/discover/lists/${encodeURIComponent(listId)}?${params.toString()}`,
    );
  },
  listWatchlist: (pagination?: PaginationParams) =>
    request<WatchlistResponse>(withPagination("/watchlist", pagination)),
  addWatchlistItem: (input: AddWatchlistItemInput) =>
    request<WatchlistItem>("/watchlist", {method: "POST", body: input}),
  updateWatchlistStatus: (itemId: string, status: WatchlistStatus) =>
    request<WatchlistItem>(`/watchlist/${itemId}/status`, {method: "PATCH", body: {status}}),
  removeWatchlistItem: (itemId: string) => request<null>(`/watchlist/${itemId}`, {method: "DELETE"}),
  deleteAccount: () => request<null>("/me/account", {method: "DELETE"}),
  resolveTvTimeShows: (shows: ResolveTvTimeShowInput[]) =>
    request<ResolveTvTimeShowsResponse>("/me/imports/resolve-tv-time-shows", {
      method: "POST",
      body: {shows},
    }),
  upsertMediaMapping: (body: {
    provider: "tv_time";
    mediaType: "tv" | "movie";
    externalId: string;
    tmdbId: number;
    title?: string | null;
  }) => request<{mapping: MediaMapping}>("/me/imports/media-mappings", {method: "PUT", body}),
  createImport: (body: {provider?: "tv_time"; sourceHash?: string | null}) =>
    request<{import: ImportJobSummary}>("/me/imports", {method: "POST", body}),
  getImport: (importId: string) =>
    request<{import: ImportJobSummary}>(`/me/imports/${encodeURIComponent(importId)}`),
  stageImportWatchlist: (importId: string, items: ImportWatchlistItemInput[]) =>
    request<{import: ImportJobSummary}>(`/me/imports/${encodeURIComponent(importId)}/watchlist`, {
      method: "POST",
      body: {items},
    }),
  stageImportEpisodes: (importId: string, episodes: ImportEpisodeInput[]) =>
    request<{import: ImportJobSummary}>(`/me/imports/${encodeURIComponent(importId)}/episodes`, {
      method: "POST",
      body: {episodes},
    }),
  commitImport: (importId: string) =>
    request<{import: ImportJobSummary}>(`/me/imports/${encodeURIComponent(importId)}/commit`, {
      method: "POST",
      body: {},
    }),
  runImport: (importId: string, maxEpisodeWrites = 100) =>
    request<ImportRunResult>(`/me/imports/${encodeURIComponent(importId)}/run`, {
      method: "POST",
      body: {maxEpisodeWrites},
    }),
};
