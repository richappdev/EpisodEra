import {createContext, useContext, useEffect, useMemo, type ReactNode} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {setApiTokenProvider} from "./api/client";
import {useAuth} from "./auth/AuthContext";
import {useProfile} from "./hooks/useProfile";
import {useProfileStats} from "./hooks/useProfileStats";
import {useProgress} from "./hooks/useProgress";
import {useSettings} from "./hooks/useSettings";
import {useWatchlist} from "./hooks/useWatchlist";
import {setAnalyticsUserId} from "./firebase";
import {MediaDetail, MediaSummary} from "./types/media";
import {UserProfile} from "./types/profile";
import {ShowProgressSummary} from "./types/progress";
import {mediaPath, paths, type NavView} from "./routes/paths";
import {SupportedLanguage} from "./types/settings";
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
  profile: UserProfile | null;
  progressItems: ShowProgressSummary[];
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
  addToWatchlist: (detail: MediaDetail) => void;
  changeAutoMarkPreviousEpisodesWatched: (enabled: boolean) => void;
  changeLanguage: (nextLanguage: SupportedLanguage) => void;
  loadMoreHistory: () => void;
  loadMoreWatchlist: () => void;
  markNextWatchlistEpisodeWatched: (item: WatchlistItem, itemProgress: ShowProgressSummary) => Promise<void>;
  openAuth: () => void;
  openMediaDetail: (item: MediaSummary | WatchlistItem, nav: NavView) => void;
  refreshStats: () => void;
  reloadStats: () => void;
  reloadHistory: () => void;
  reloadWatchlist: () => void;
  removeWatchlistItem: (item: WatchlistItem) => void;
  setProfile: (profile: UserProfile | null) => void;
  signOutAndReset: () => Promise<void>;
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
  const navigate = useNavigate();
  const location = useLocation();
  const profileStats = useProfileStats(user);
  const profileState = useProfile(user);
  const settings = useSettings(user);
  const watchlist = useWatchlist(user, () => {
    void profileStats.refresh();
  });
  const progress = useProgress(user, () => {
    void profileStats.refresh();
  });

  useEffect(() => {
    setApiTokenProvider(getIdToken);
  }, [getIdToken]);

  useEffect(() => {
    setAnalyticsUserId(user?.uid ?? null);
  }, [user]);

  const openMediaDetail = (item: MediaSummary | WatchlistItem, nav: NavView) => {
    const mediaType = item.mediaType;
    const id = "tmdbId" in item ? item.tmdbId : item.id;
    navigate(mediaPath({mediaType, id}), {state: {nav}});
  };

  const openAuth = () => {
    navigate(paths.login, {state: {from: `${location.pathname}${location.search}`}});
  };

  const signOutAndReset = async () => {
    await signOutUser();
    navigate(paths.home);
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

  const markNextWatchlistEpisodeWatched = async (item: WatchlistItem, itemProgress: ShowProgressSummary) => {
    if (item.mediaType !== "tv") {
      return;
    }

    watchlist.setError(null);

    if (!itemProgress.nextEpisode) {
      watchlist.setError(`No available next episode found for ${item.title}.`);
      return;
    }

    try {
      await progress.markNextEpisodeWatched(item.tmdbId, itemProgress.nextEpisode);
    } catch (err) {
      watchlist.setError(err instanceof Error ? err.message : "Could not mark next episode watched.");
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
      profile: profileState.profile,
      progressItems: progress.items,
      settingsError: settings.error,
      settingsLoading: settings.loading,
      stats: profileStats.stats,
      statsError: profileStats.statsError,
      statsLoading: profileStats.statsLoading,
      watchlistError: watchlist.error,
      watchlistHasMore: watchlist.hasMore,
      watchlistItems: watchlist.items,
      watchlistLoading: watchlist.loading,
      watchlistLoadingMore: watchlist.loadingMore,
      watchlistTotalCount: watchlist.totalCount,
      addToWatchlist,
      changeAutoMarkPreviousEpisodesWatched: settings.changeAutoMarkPreviousEpisodesWatched,
      changeLanguage: settings.changeLanguage,
      loadMoreHistory: profileStats.loadMoreHistory,
      loadMoreWatchlist: watchlist.loadMore,
      markNextWatchlistEpisodeWatched,
      openAuth,
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
      reloadWatchlist: () => {
        void watchlist.reload();
      },
      removeWatchlistItem: (item: WatchlistItem) => {
        void watchlist.removeWatchlistItem(item);
      },
      setProfile: profileState.setProfile,
      signOutAndReset,
      updateWatchlistStatus: (item: WatchlistItem, status: WatchlistStatus) => {
        void watchlist.updateWatchlistStatus(item, status);
      },
      upsertWatchlistItem: watchlist.upsertWatchlistItem,
      upsertProgressItem: progress.upsertProgressItem,
      removeProgressItem: progress.removeProgressItem,
    }),
    [profileState.profile, profileStats, progress, settings, watchlist, user],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
