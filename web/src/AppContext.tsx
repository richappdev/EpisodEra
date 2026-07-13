import {createContext, useContext, useEffect, useMemo, useState, type ReactNode} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {api, setApiTokenProvider} from "./api/client";
import {useAuth} from "./auth/AuthContext";
import {setAnalyticsUserId, trackEvent} from "./firebase";
import {HistoryEntry} from "./types/history";
import {MediaDetail, MediaSummary} from "./types/media";
import {UserProfile} from "./types/profile";
import {MarkEpisodeWatchedInput, ShowProgressSummary} from "./types/progress";
import {mediaPath, paths, type NavView} from "./routes/paths";
import {SupportedLanguage, isSupportedLanguage} from "./types/settings";
import {UserStats} from "./types/stats";
import {WatchlistItem, WatchlistStatus} from "./types/watchlist";

const languageStorageKey = "episodera.language";
const autoMarkPreviousEpisodesWatchedStorageKey = "episodera.autoMarkPreviousEpisodesWatched";

const initialLanguage = (): SupportedLanguage => {
  const stored = window.localStorage.getItem(languageStorageKey);
  return isSupportedLanguage(stored) ? stored : "en-US";
};

const initialAutoMarkPreviousEpisodesWatched = () =>
  window.localStorage.getItem(autoMarkPreviousEpisodesWatchedStorageKey) === "true";

interface AppContextValue {
  autoMarkPreviousEpisodesWatched: boolean;
  historyItems: HistoryEntry[];
  language: SupportedLanguage;
  profile: UserProfile | null;
  progressItems: ShowProgressSummary[];
  settingsError: string | null;
  settingsLoading: boolean;
  stats: UserStats | null;
  statsError: string | null;
  statsLoading: boolean;
  watchlistError: string | null;
  watchlistItems: WatchlistItem[];
  watchlistLoading: boolean;
  addToWatchlist: (detail: MediaDetail) => void;
  changeAutoMarkPreviousEpisodesWatched: (enabled: boolean) => void;
  changeLanguage: (nextLanguage: SupportedLanguage) => void;
  markNextWatchlistEpisodeWatched: (item: WatchlistItem, itemProgress: ShowProgressSummary) => Promise<void>;
  openAuth: () => void;
  openMediaDetail: (item: MediaSummary | WatchlistItem, nav: NavView) => void;
  refreshStats: () => void;
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
  const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [progressItems, setProgressItems] = useState<ShowProgressSummary[]>([]);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [autoMarkPreviousEpisodesWatched, setAutoMarkPreviousEpisodesWatched] = useState(
    initialAutoMarkPreviousEpisodesWatched,
  );

  useEffect(() => {
    setApiTokenProvider(getIdToken);
  }, [getIdToken]);

  useEffect(() => {
    setAnalyticsUserId(user?.uid ?? null);
  }, [user]);

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(autoMarkPreviousEpisodesWatchedStorageKey, String(autoMarkPreviousEpisodesWatched));
  }, [autoMarkPreviousEpisodesWatched]);

  useEffect(() => {
    if (!user) {
      setWatchlistItems([]);
      setWatchlistError(null);
      setWatchlistLoading(false);
      setProfile(null);
      setStats(null);
      setHistoryItems([]);
      setStatsError(null);
      setStatsLoading(false);
      setProgressItems([]);
      setSettingsError(null);
      setSettingsLoading(false);
      return;
    }

    setWatchlistLoading(true);
    setStatsLoading(true);
    setSettingsLoading(true);
    setWatchlistError(null);
    setStatsError(null);
    setSettingsError(null);
    Promise.allSettled([
      api.listWatchlist(),
      api.listProgress(),
      api.meProfile(),
      api.meStats(),
      api.meHistory(),
      api.meSettings(),
    ])
      .then(([watchlistResult, progressResult, profileResult, statsResult, historyResult, settingsResult]) => {
        if (watchlistResult.status === "fulfilled") {
          setWatchlistItems(watchlistResult.value.items);
        } else {
          setWatchlistError(
            watchlistResult.reason instanceof Error ? watchlistResult.reason.message : "Could not load watchlist.",
          );
        }

        if (progressResult.status === "fulfilled") {
          setProgressItems(progressResult.value.items);
        }

        if (profileResult.status === "fulfilled") {
          setProfile(profileResult.value.profile);
        }

        if (statsResult.status === "fulfilled") {
          setStats(statsResult.value);
        } else {
          setStatsError(
            statsResult.reason instanceof Error ? statsResult.reason.message : "Could not load profile stats.",
          );
        }

        if (historyResult.status === "fulfilled") {
          setHistoryItems(historyResult.value.items);
        } else {
          setStatsError(historyResult.reason instanceof Error ? historyResult.reason.message : "Could not load history.");
        }

        if (settingsResult.status === "fulfilled") {
          setLanguage(settingsResult.value.language);
          setAutoMarkPreviousEpisodesWatched(settingsResult.value.autoMarkPreviousEpisodesWatched);
        } else {
          setSettingsError(
            settingsResult.reason instanceof Error ? settingsResult.reason.message : "Could not load settings.",
          );
        }
      })
      .finally(() => {
        setWatchlistLoading(false);
        setStatsLoading(false);
        setSettingsLoading(false);
      });
  }, [user]);

  const refreshStats = () => {
    if (!user) {
      return;
    }

    setStatsLoading(true);
    setStatsError(null);
    Promise.all([api.meStats(), api.meHistory()])
      .then(([loadedStats, {items}]) => {
        setStats(loadedStats);
        setHistoryItems(items);
      })
      .catch((err: Error) => setStatsError(err.message))
      .finally(() => setStatsLoading(false));
  };

  const upsertWatchlistItem = (item: WatchlistItem) => {
    setWatchlistItems((current) => {
      const existing = current.findIndex((candidate) => candidate.itemId === item.itemId);
      if (existing === -1) {
        return [item, ...current];
      }

      return current.map((candidate) => (candidate.itemId === item.itemId ? item : candidate));
    });
  };

  const upsertProgressItem = (item: ShowProgressSummary | null) => {
    if (!item) {
      return;
    }

    setProgressItems((current) => {
      const existing = current.findIndex((candidate) => candidate.showId === item.showId);
      if (existing === -1) {
        return [item, ...current];
      }

      return current.map((candidate) => (candidate.showId === item.showId ? item : candidate));
    });
  };

  const removeProgressItem = (showId: number) => {
    setProgressItems((current) => current.filter((candidate) => candidate.tmdbId !== showId));
  };

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

  const changeLanguage = (nextLanguage: SupportedLanguage) => {
    setLanguage(nextLanguage);
    trackEvent("select_content", {
      content_type: "language",
      item_id: nextLanguage,
    });
    setSettingsError(null);

    if (!user) {
      return;
    }

    setSettingsLoading(true);
    api.updateMeSettings({language: nextLanguage})
      .then((settings) => {
        setLanguage(settings.language);
        setAutoMarkPreviousEpisodesWatched(settings.autoMarkPreviousEpisodesWatched);
      })
      .catch((err: Error) => setSettingsError(err.message))
      .finally(() => setSettingsLoading(false));
  };

  const changeAutoMarkPreviousEpisodesWatched = (enabled: boolean) => {
    setAutoMarkPreviousEpisodesWatched(enabled);
    trackEvent("select_content", {
      content_type: "auto_mark_previous_episodes_watched",
      item_id: String(enabled),
    });
    setSettingsError(null);

    if (!user) {
      return;
    }

    setSettingsLoading(true);
    api.updateMeSettings({autoMarkPreviousEpisodesWatched: enabled})
      .then((settings) => {
        setLanguage(settings.language);
        setAutoMarkPreviousEpisodesWatched(settings.autoMarkPreviousEpisodesWatched);
      })
      .catch((err: Error) => setSettingsError(err.message))
      .finally(() => setSettingsLoading(false));
  };

  const addToWatchlist = (selectedDetail: MediaDetail) => {
    setWatchlistError(null);
    api.addWatchlistItem({
      tmdbId: selectedDetail.id,
      mediaType: selectedDetail.mediaType,
      title: selectedDetail.title,
      poster: selectedDetail.images.poster,
      backdrop: selectedDetail.images.backdrop,
    })
      .then((item) => {
        trackEvent("add_to_wishlist", {
          content_type: selectedDetail.mediaType,
          item_id: String(selectedDetail.id),
        });
        upsertWatchlistItem(item);
        refreshStats();
      })
      .catch((err: Error) => setWatchlistError(err.message));
  };

  const updateWatchlistStatus = (item: WatchlistItem, status: WatchlistStatus) => {
    if (item.status === status) {
      return;
    }

    setWatchlistError(null);
    api.updateWatchlistStatus(item.itemId, status)
      .then((updatedItem) => {
        trackEvent("select_content", {
          content_type: "watchlist_status",
          item_id: status,
        });
        upsertWatchlistItem(updatedItem);
        refreshStats();
      })
      .catch((err: Error) => setWatchlistError(err.message));
  };

  const removeWatchlistItem = (item: WatchlistItem) => {
    setWatchlistError(null);
    api.removeWatchlistItem(item.itemId)
      .then(() => {
        trackEvent("remove_from_wishlist", {
          content_type: item.mediaType,
          item_id: String(item.tmdbId),
        });
        setWatchlistItems((current) => current.filter((candidate) => candidate.itemId !== item.itemId));
        refreshStats();
      })
      .catch((err: Error) => setWatchlistError(err.message));
  };

  const markNextWatchlistEpisodeWatched = async (item: WatchlistItem, itemProgress: ShowProgressSummary) => {
    if (item.mediaType !== "tv") {
      return;
    }

    setWatchlistError(null);

    try {
      if (!itemProgress.nextEpisode) {
        setWatchlistError(`No available next episode found for ${item.title}.`);
        return;
      }

      const nextEpisode: MarkEpisodeWatchedInput = {
        seasonNumber: itemProgress.nextEpisode.seasonNumber,
        episodeNumber: itemProgress.nextEpisode.episodeNumber,
      };
      const updatedProgress = await api.updateEpisodes(item.tmdbId, {
        watched: true,
        episodes: [nextEpisode],
      });

      trackEvent("select_content", {
        content_type: "episode_watched",
        item_id: itemProgress.nextEpisode.episodeKey,
      });
      upsertProgressItem(updatedProgress);
      refreshStats();
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : "Could not mark next episode watched.");
    }
  };

  const value = useMemo(
    () => ({
      autoMarkPreviousEpisodesWatched,
      historyItems,
      language,
      profile,
      progressItems,
      settingsError,
      settingsLoading,
      stats,
      statsError,
      statsLoading,
      watchlistError,
      watchlistItems,
      watchlistLoading,
      addToWatchlist,
      changeAutoMarkPreviousEpisodesWatched,
      changeLanguage,
      markNextWatchlistEpisodeWatched,
      openAuth,
      openMediaDetail,
      refreshStats,
      removeWatchlistItem,
      setProfile,
      signOutAndReset,
      updateWatchlistStatus,
      upsertWatchlistItem,
      upsertProgressItem,
      removeProgressItem,
    }),
    [
      autoMarkPreviousEpisodesWatched,
      historyItems,
      language,
      profile,
      progressItems,
      settingsError,
      settingsLoading,
      stats,
      statsError,
      statsLoading,
      watchlistError,
      watchlistItems,
      watchlistLoading,
      user,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
