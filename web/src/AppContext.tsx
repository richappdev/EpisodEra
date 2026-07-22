import {createContext, useContext, useEffect, useMemo, type ReactNode} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {setApiTokenProvider} from "./api/client";
import {useAuth} from "./auth/AuthContext";
import {useProfile} from "./hooks/useProfile";
import {useProfileStats} from "./hooks/useProfileStats";
import {useProgress} from "./hooks/useProgress";
import {useLikes} from "./hooks/useLikes";
import {useSettings} from "./hooks/useSettings";
import {useWatchlist} from "./hooks/useWatchlist";
import {
  promotedTvWatchlistStatus,
  suggestedWatchlistStatusForProgress,
  type ContinuationEntry,
} from "./lib/continuation";
import {setAnalyticsUserId} from "./firebase";
import {HistoryEntry} from "./types/history";
import {LikedItem} from "./types/likes";
import {MediaDetail, MediaSummary} from "./types/media";
import {UserProfile} from "./types/profile";
import {ShowProgressSummary} from "./types/progress";
import {mediaPath, paths, type NavView} from "./routes/paths";
import {SupportedLanguage} from "./types/settings";
import {YearRecap} from "./types/stats";
import {WatchlistItem, WatchlistStatus} from "./types/watchlist";

interface AppContextValue {
  autoMarkPreviousEpisodesWatched: boolean;
  historyError: string | null;
  historyHasMore: boolean;
  historyItems: ReturnType<typeof useProfileStats>["historyItems"];
  historyLoading: boolean;
  historyLoadingMore: boolean;
  historyTotalCount: number;
  language: SupportedLanguage;
  likedError: string | null;
  likedItems: LikedItem[];
  likedLoading: boolean;
  likedTotalCount: number;
  pendingShowIds: ReadonlySet<number>;
  preferredProviderIds: number[];
  profile: UserProfile | null;
  progressItems: ShowProgressSummary[];
  achievementsEnabled: boolean;
  showAchievementsOnProfile: boolean;
  shareActivityWithFriends: boolean;
  allowFriendRequests: boolean;
  hideSpoilersUntilWatched: boolean;
  recap: YearRecap | null;
  recapError: string | null;
  recapLoading: boolean;
  recapYear: number;
  settingsError: string | null;
  settingsLoading: boolean;
  stats: ReturnType<typeof useProfileStats>["stats"];
  statsError: string | null;
  statsLoading: boolean;
  watchlistError: string | null;
  watchlistHasMore: boolean;
  watchlistItems: WatchlistItem[];
  watchlistLoading: boolean;
  watchlistLoadingMore: boolean;
  watchlistTotalCount: number;
  watchRegion: string;
  addToWatchlist: (detail: MediaDetail) => void;
  changeAutoMarkPreviousEpisodesWatched: (enabled: boolean) => void;
  changeLanguage: (nextLanguage: SupportedLanguage) => void;
  changePreferredProviderIds: (providerIds: number[]) => void;
  changeWatchRegion: (region: string) => void;
  changeAchievementsEnabled: (enabled: boolean) => void;
  changeShowAchievementsOnProfile: (enabled: boolean) => void;
  changeShareActivityWithFriends: (enabled: boolean) => void;
  changeAllowFriendRequests: (enabled: boolean) => void;
  changeHideSpoilersUntilWatched: (enabled: boolean) => void;
  deleteHistoryEntry: (historyId: string) => Promise<void>;
  loadMoreHistory: () => void;
  loadMoreWatchlist: () => void;
  loadRecap: (year: number) => Promise<void>;
  markContinuationEpisodeWatched: (entry: ContinuationEntry) => Promise<ShowProgressSummary | null>;
  openAuth: () => void;
  openContinuationDetail: (entry: ContinuationEntry, nav: NavView) => void;
  openMediaDetail: (item: MediaSummary | WatchlistItem | LikedItem, nav: NavView) => void;
  refreshStats: () => void;
  reloadStats: () => void;
  reloadHistory: () => void;
  reloadLikes: () => void;
  reloadWatchlist: () => void;
  removeLikedItem: (item: LikedItem) => void;
  removeWatchlistItem: (item: WatchlistItem) => void;
  setProfile: (profile: UserProfile | null) => void;
  signOutAndReset: () => Promise<void>;
  syncWatchlistStatusFromProgress: (progress: ShowProgressSummary) => void;
  toggleLike: (detail: MediaDetail) => void;
  updateHistoryWatchedAt: (historyId: string, watchedAt: string) => Promise<HistoryEntry>;
  updateWatchlistStatus: (item: WatchlistItem, status: WatchlistStatus) => void;
  upsertWatchlistItem: (item: WatchlistItem) => void;
  upsertProgressItem: (item: ShowProgressSummary | null) => void;
  removeProgressItem: (showId: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider.");
  }
  return context;
};

export const AppProvider = ({children}: {children: ReactNode}) => {
  const {getIdToken, signOutUser, user} = useAuth();
  // Register before child/hook effects so /me/* fetches always see a provider.
  setApiTokenProvider(getIdToken);

  const navigate = useNavigate();
  const location = useLocation();
  const profileStats = useProfileStats(user);
  const profileState = useProfile(user);
  const settings = useSettings(user);
  const watchlist = useWatchlist(user, () => {
    void profileStats.refresh();
  });
  const likes = useLikes(user, () => {
    void profileStats.refresh();
  });
  const progress = useProgress(user, () => {
    void profileStats.refresh();
  });

  useEffect(() => {
    setAnalyticsUserId(user?.uid ?? null);
  }, [user]);

  const openMediaDetail = (item: MediaSummary | WatchlistItem | LikedItem, nav: NavView) => {
    const mediaType = item.mediaType;
    const id = "tmdbId" in item ? item.tmdbId : item.id;
    navigate(mediaPath({mediaType, id}), {state: {nav}});
  };

  const openContinuationDetail = (entry: ContinuationEntry, nav: NavView) => {
    navigate(mediaPath({mediaType: "tv", id: entry.tmdbId}), {state: {nav}});
  };

  const openAuth = () => {
    navigate(paths.login, {state: {from: `${location.pathname}${location.search}`}});
  };

  const signOutAndReset = async () => {
    await signOutUser();
    navigate(paths.landing);
  };

  const addToWatchlist = (selectedDetail: MediaDetail) => {
    void watchlist.addToWatchlist({
      tmdbId: selectedDetail.id,
      mediaType: selectedDetail.mediaType,
      title: selectedDetail.title,
      poster: selectedDetail.images.poster,
      backdrop: selectedDetail.images.backdrop,
    });
  };

  const toggleLike = (selectedDetail: MediaDetail) => {
    const itemId = `${selectedDetail.mediaType}_${selectedDetail.id}`;
    const existing = likes.items.find((candidate) => candidate.itemId === itemId);
    if (existing) {
      void likes.removeLikedItem(existing);
      return;
    }

    void likes.addLikedItem({
      tmdbId: selectedDetail.id,
      mediaType: selectedDetail.mediaType,
      title: selectedDetail.title,
      poster: selectedDetail.images.poster,
      backdrop: selectedDetail.images.backdrop,
    });
  };

  const syncWatchlistStatusFromProgress = (updatedProgress: ShowProgressSummary) => {
    const item = watchlist.items.find(
      (candidate) => candidate.mediaType === "tv" && candidate.tmdbId === updatedProgress.tmdbId,
    );
    if (!item) {
      return;
    }

    const nextStatus = promotedTvWatchlistStatus(
      item.status,
      suggestedWatchlistStatusForProgress(updatedProgress),
    );
    if (!nextStatus) {
      return;
    }

    void watchlist.updateWatchlistStatus(item, nextStatus);
  };

  const markContinuationEpisodeWatched = async (entry: ContinuationEntry) => {
    watchlist.setError(null);
    progress.setError(null);

    if (!entry.progress.nextEpisode) {
      watchlist.setError(`No available next episode found for ${entry.title}.`);
      return null;
    }

    try {
      const updated = await progress.markNextEpisodeWatched(entry.tmdbId, entry.progress.nextEpisode);
      if (updated) {
        syncWatchlistStatusFromProgress(updated);
      }
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not mark next episode watched.";
      watchlist.setError(message);
      return null;
    }
  };

  const value = useMemo(
    () => ({
      autoMarkPreviousEpisodesWatched: settings.autoMarkPreviousEpisodesWatched,
      historyError: profileStats.historyError,
      historyHasMore: profileStats.historyHasMore,
      historyItems: profileStats.historyItems,
      historyLoading: profileStats.historyLoading,
      historyLoadingMore: profileStats.historyLoadingMore,
      historyTotalCount: profileStats.historyTotalCount,
      language: settings.language,
      pendingShowIds: progress.pendingShowIds,
      preferredProviderIds: settings.preferredProviderIds,
      achievementsEnabled: settings.achievementsEnabled,
      showAchievementsOnProfile: settings.showAchievementsOnProfile,
      shareActivityWithFriends: settings.shareActivityWithFriends,
      allowFriendRequests: settings.allowFriendRequests,
      hideSpoilersUntilWatched: settings.hideSpoilersUntilWatched,
      profile: profileState.profile,
      progressItems: progress.items,
      recap: profileStats.recap,
      recapError: profileStats.recapError,
      recapLoading: profileStats.recapLoading,
      recapYear: profileStats.recapYear,
      settingsError: settings.error,
      settingsLoading: settings.loading,
      stats: profileStats.stats,
      statsError: profileStats.statsError,
      statsLoading: profileStats.statsLoading,
      likedError: likes.error,
      likedItems: likes.items,
      likedLoading: likes.loading,
      likedTotalCount: likes.totalCount,
      watchlistError: watchlist.error,
      watchlistHasMore: watchlist.hasMore,
      watchlistItems: watchlist.items,
      watchlistLoading: watchlist.loading,
      watchlistLoadingMore: watchlist.loadingMore,
      watchlistTotalCount: watchlist.totalCount,
      watchRegion: settings.watchRegion,
      addToWatchlist,
      changeAutoMarkPreviousEpisodesWatched: settings.changeAutoMarkPreviousEpisodesWatched,
      changeLanguage: settings.changeLanguage,
      changePreferredProviderIds: settings.changePreferredProviderIds,
      changeWatchRegion: settings.changeWatchRegion,
      changeAchievementsEnabled: settings.changeAchievementsEnabled,
      changeShowAchievementsOnProfile: settings.changeShowAchievementsOnProfile,
      changeShareActivityWithFriends: settings.changeShareActivityWithFriends,
      changeAllowFriendRequests: settings.changeAllowFriendRequests,
      changeHideSpoilersUntilWatched: settings.changeHideSpoilersUntilWatched,
      deleteHistoryEntry: profileStats.deleteHistoryEntry,
      loadMoreHistory: profileStats.loadMoreHistory,
      loadMoreWatchlist: watchlist.loadMore,
      loadRecap: profileStats.loadRecap,
      markContinuationEpisodeWatched,
      openAuth,
      openContinuationDetail,
      openMediaDetail,
      refreshStats: () => {
        void profileStats.refresh();
      },
      reloadStats: () => {
        void profileStats.reloadStats();
      },
      reloadHistory: () => {
        void profileStats.reloadHistory();
      },
      reloadLikes: () => {
        void likes.reload();
      },
      reloadWatchlist: () => {
        void watchlist.reload();
      },
      removeLikedItem: (item: LikedItem) => {
        void likes.removeLikedItem(item);
      },
      removeWatchlistItem: (item: WatchlistItem) => {
        void watchlist.removeWatchlistItem(item);
      },
      setProfile: profileState.setProfile,
      signOutAndReset,
      syncWatchlistStatusFromProgress,
      toggleLike,
      updateHistoryWatchedAt: profileStats.updateHistoryWatchedAt,
      updateWatchlistStatus: (item: WatchlistItem, status: WatchlistStatus) => {
        void watchlist.updateWatchlistStatus(item, status);
      },
      upsertWatchlistItem: watchlist.upsertWatchlistItem,
      upsertProgressItem: progress.upsertProgressItem,
      removeProgressItem: progress.removeProgressItem,
    }),
    [likes, profileState.profile, profileStats, progress, settings, watchlist, user],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
