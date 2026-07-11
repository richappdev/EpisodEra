import {useEffect, useState} from "react";
import {api, setApiTokenProvider} from "./api/client";
import {useAuth} from "./auth/AuthContext";
import {TopBar} from "./components/TopBar";
import {setAnalyticsUserId, trackEvent} from "./firebase";
import {HistoryEntry} from "./types/history";
import {AuthPage} from "./pages/AuthPage";
import {DetailPage} from "./pages/DetailPage";
import {DiscoveryPage} from "./pages/DiscoveryPage";
import {ProfilePage} from "./pages/ProfilePage";
import {SettingsPage} from "./pages/SettingsPage";
import {WatchlistPage} from "./pages/WatchlistPage";
import {EpisodeSummary, MediaDetail, MediaSummary, TvSeasonDetail} from "./types/media";
import {MarkEpisodeWatchedInput, ShowProgress, ShowProgressSummary} from "./types/progress";
import {SupportedLanguage, isSupportedLanguage} from "./types/settings";
import {UserStats} from "./types/stats";
import {WatchlistItem, WatchlistStatus} from "./types/watchlist";

type View = "trending" | "search" | "watchlist" | "profile" | "settings" | "auth";

const languageStorageKey = "episodera.language";
const autoMarkPreviousEpisodesWatchedStorageKey = "episodera.autoMarkPreviousEpisodesWatched";

const initialLanguage = (): SupportedLanguage => {
  const stored = window.localStorage.getItem(languageStorageKey);
  return isSupportedLanguage(stored) ? stored : "en-US";
};

const initialAutoMarkPreviousEpisodesWatched = () =>
  window.localStorage.getItem(autoMarkPreviousEpisodesWatchedStorageKey) === "true";

const isAvailableEpisode = (episode: EpisodeSummary) => {
  if (!episode.airDate) {
    return true;
  }

  return new Date(`${episode.airDate}T00:00:00`).getTime() <= Date.now();
};

export const App = () => {
  const {getIdToken, loading, signOutUser, user} = useAuth();
  const [view, setView] = useState<View>("trending");
  const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage);
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [progress, setProgress] = useState<ShowProgress | null>(null);
  const [progressItems, setProgressItems] = useState<ShowProgressSummary[]>([]);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [seasonDetail, setSeasonDetail] = useState<TvSeasonDetail | null>(null);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [autoMarkPreviousEpisodesWatched, setAutoMarkPreviousEpisodesWatched] = useState(
    initialAutoMarkPreviousEpisodesWatched,
  );
  const [selectedSeason, setSelectedSeason] = useState(1);

  useEffect(() => {
    setApiTokenProvider(getIdToken);
  }, [getIdToken]);

  useEffect(() => {
    setAnalyticsUserId(user?.uid ?? null);
  }, [user]);

  useEffect(() => {
    if (detail) {
      trackEvent("screen_view", {
        firebase_screen: "detail",
        firebase_screen_class: "DetailPage",
        media_type: detail.mediaType,
        tmdb_id: detail.id,
      });
      return;
    }

    trackEvent("screen_view", {
      firebase_screen: view,
      firebase_screen_class: "App",
    });
  }, [detail, view]);

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
    Promise.allSettled([api.listWatchlist(), api.listProgress(), api.meStats(), api.meHistory(), api.meSettings()])
      .then(([watchlistResult, progressResult, statsResult, historyResult, settingsResult]) => {
        if (watchlistResult.status === "fulfilled") {
          setWatchlistItems(watchlistResult.value.items);
        } else {
          setWatchlistError(watchlistResult.reason instanceof Error ? watchlistResult.reason.message : "Could not load watchlist.");
        }

        if (progressResult.status === "fulfilled") {
          setProgressItems(progressResult.value.items);
        } else {
          setProgressError(progressResult.reason instanceof Error ? progressResult.reason.message : "Could not load progress.");
        }

        if (statsResult.status === "fulfilled") {
          setStats(statsResult.value);
        } else {
          setStatsError(statsResult.reason instanceof Error ? statsResult.reason.message : "Could not load profile stats.");
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
          setSettingsError(settingsResult.reason instanceof Error ? settingsResult.reason.message : "Could not load settings.");
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

  useEffect(() => {
    if (!detail || detail.mediaType !== "tv") {
      setProgress(null);
      setProgressError(null);
      setProgressLoading(false);
      setSeasonDetail(null);
      setSeasonError(null);
      setSeasonLoading(false);
      setSelectedSeason(1);
      return;
    }

    const firstSeason = detail.seasons?.[0]?.seasonNumber ?? 1;
    setSelectedSeason(firstSeason);
  }, [detail]);

  useEffect(() => {
    if (!detail || detail.mediaType !== "tv") {
      return;
    }

    setSeasonLoading(true);
    setSeasonError(null);
    api.tvSeason(detail.id, selectedSeason, language)
      .then(setSeasonDetail)
      .catch((err: Error) => setSeasonError(err.message))
      .finally(() => setSeasonLoading(false));
  }, [detail, language, selectedSeason]);

  useEffect(() => {
    if (!detail || detail.mediaType !== "tv" || !user) {
      setProgress(null);
      setProgressError(null);
      setProgressLoading(false);
      return;
    }

    setProgressLoading(true);
    setProgressError(null);
    api.getProgress(detail.id)
      .then(({progress: loadedProgress}) => setProgress(loadedProgress))
      .catch((err: Error) => setProgressError(err.message))
      .finally(() => setProgressLoading(false));
  }, [detail, user]);

  useEffect(() => {
    if (!detail) {
      return;
    }

    setDetailError(null);
    api.detail(detail.mediaType, detail.id, language)
      .then(setDetail)
      .catch((err: Error) => setDetailError(err.message));
  }, [detail?.id, detail?.mediaType, language]);

  const selectItem = (item: MediaSummary) => {
    setDetailError(null);
    api.detail(item.mediaType, item.id, language)
      .then(setDetail)
      .catch((err: Error) => setDetailError(err.message));
  };

  const changeView = (nextView: Exclude<View, "auth">) => {
    setDetail(null);
    setDetailError(null);
    setView(nextView);
  };

  const openAuth = () => {
    setDetail(null);
    setDetailError(null);
    setView("auth");
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

  const markEpisodeWatched = async (episode: EpisodeSummary) => {
    if (!detail || detail.mediaType !== "tv") {
      return;
    }

    setProgressLoading(true);
    setProgressError(null);

    try {
      const watchedKeys = new Set(progress?.episodes.map((watchedEpisode) => watchedEpisode.episodeKey) ?? []);
      const currentSeasonEpisodes =
        seasonDetail?.seasonNumber === episode.seasonNumber ? seasonDetail.episodes : [episode];
      const previousEpisodes = currentSeasonEpisodes
        .filter(
          (candidate) =>
            candidate.seasonNumber === episode.seasonNumber &&
            candidate.episodeNumber < episode.episodeNumber &&
            !watchedKeys.has(candidate.episodeKey),
        )
        .sort((left, right) => left.episodeNumber - right.episodeNumber);
      const shouldMarkPrevious = previousEpisodes.length > 0 && autoMarkPreviousEpisodesWatched;
      const episodesToMark = shouldMarkPrevious ? [...previousEpisodes, episode] : [episode];

      const latestProgress = await api.updateEpisodes(detail.id, {
        watched: true,
        episodes: episodesToMark.map(({seasonNumber, episodeNumber}) => ({seasonNumber, episodeNumber})),
      });

      if (!latestProgress) {
        return;
      }

      trackEvent("select_content", {
        content_type: "episode_watched",
        item_id: episode.episodeKey,
      });
      setProgress(latestProgress);
      upsertProgressItem(latestProgress);
      refreshStats();
    } catch (err) {
      setProgressError(err instanceof Error ? err.message : "Could not update episode progress.");
    } finally {
      setProgressLoading(false);
    }
  };

  const markAvailableSeasonWatched = async () => {
    if (!detail || detail.mediaType !== "tv" || !seasonDetail) {
      return;
    }

    const watchedKeys = new Set(progress?.episodes.map((episode) => episode.episodeKey) ?? []);
    const episodesToMark = seasonDetail.episodes
      .filter((episode) => isAvailableEpisode(episode) && !watchedKeys.has(episode.episodeKey))
      .sort((left, right) => left.episodeNumber - right.episodeNumber);

    if (episodesToMark.length === 0) {
      return;
    }

    const shouldMarkSeason = window.confirm(
      `Mark ${episodesToMark.length} available episode${episodesToMark.length === 1 ? "" : "s"} in ${
        seasonDetail.title || `Season ${selectedSeason}`
      } as watched?`,
    );

    if (!shouldMarkSeason) {
      return;
    }

    setProgressLoading(true);
    setProgressError(null);

    try {
      const latestProgress = await api.updateEpisodes(detail.id, {
        watched: true,
        episodes: episodesToMark.map(({seasonNumber, episodeNumber}) => ({seasonNumber, episodeNumber})),
      });

      if (!latestProgress) {
        return;
      }

      trackEvent("select_content", {
        content_type: "season_watched",
        item_id: `${detail.id}:${selectedSeason}`,
      });
      setProgress(latestProgress);
      upsertProgressItem(latestProgress);
      refreshStats();
    } catch (err) {
      setProgressError(err instanceof Error ? err.message : "Could not mark season episodes watched.");
    } finally {
      setProgressLoading(false);
    }
  };

  const markEpisodeUnwatched = (episode: EpisodeSummary) => {
    if (!detail || detail.mediaType !== "tv") {
      return;
    }

    setProgressLoading(true);
    setProgressError(null);
    api.markEpisodeUnwatched(detail.id, episode.episodeKey)
      .then(({progress: updatedProgress}) => {
        trackEvent("select_content", {
          content_type: "episode_unwatched",
          item_id: episode.episodeKey,
        });
        setProgress(updatedProgress);
        if (updatedProgress) {
          upsertProgressItem(updatedProgress);
        } else {
          setProgressItems((current) => current.filter((candidate) => candidate.tmdbId !== detail.id));
        }
        refreshStats();
      })
      .catch((err: Error) => setProgressError(err.message))
      .finally(() => setProgressLoading(false));
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
      if (detail?.mediaType === "tv" && detail.id === item.tmdbId) {
        setProgress(updatedProgress);
      }
      refreshStats();
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : "Could not mark next episode watched.");
    }
  };

  const selectWatchlistItem = (item: WatchlistItem) => {
    selectItem({
      id: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      overview: "",
      releaseDate: null,
      voteAverage: 0,
      popularity: 0,
      images: {poster: item.poster, backdrop: item.backdrop},
    });
  };

  const currentWatchlistItem = detail
    ? watchlistItems.find((item) => item.mediaType === detail.mediaType && item.tmdbId === detail.id) ?? null
    : null;
  const isDetailView = detail !== null && !["auth", "profile", "settings", "watchlist"].includes(view);

  if (loading) {
    return (
      <>
        <TopBar
          activeView={view === "auth" ? "trending" : view}
          language={language}
          user={user}
          onAuthOpen={openAuth}
          onSignOut={() => {
            void signOutUser();
            setDetail(null);
            setView("trending");
          }}
          onViewChange={changeView}
        />
        <main className="page-shell">
          <div className="state-panel">Loading account...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar
        activeView={view === "auth" ? "trending" : view}
        language={language}
        user={user}
        onAuthOpen={openAuth}
        onSignOut={() => {
          void signOutUser();
          setDetail(null);
          setView("trending");
        }}
        onViewChange={changeView}
      />
      {detailError && <div className="floating-error">{detailError}</div>}
      {isDetailView && detail ? (
        <DetailPage
          detail={detail}
          onEpisodeWatched={markEpisodeWatched}
          onEpisodeUnwatched={markEpisodeUnwatched}
          onAddToWatchlist={addToWatchlist}
          onBack={() => setDetail(null)}
          onMarkAvailableSeasonWatched={markAvailableSeasonWatched}
          onRemoveFromWatchlist={removeWatchlistItem}
          onSeasonChange={setSelectedSeason}
          onWatchlistStatusChange={updateWatchlistStatus}
          progress={progress}
          progressError={progressError}
          progressLoading={progressLoading}
          seasonDetail={seasonDetail}
          seasonError={seasonError}
          seasonLoading={seasonLoading}
          selectedSeason={selectedSeason}
          signedIn={Boolean(user)}
          watchlistItem={currentWatchlistItem}
        />
      ) : view === "auth" ? (
        <AuthPage onDone={() => changeView("trending")} />
      ) : view === "profile" ? (
        <ProfilePage
          error={statsError}
          history={historyItems}
          loading={statsLoading}
          signedIn={Boolean(user)}
          stats={stats}
          userEmail={user?.email ?? null}
        />
      ) : view === "settings" ? (
        <SettingsPage
          autoMarkPreviousEpisodesWatched={autoMarkPreviousEpisodesWatched}
          error={settingsError}
          language={language}
          loading={settingsLoading}
          signedIn={Boolean(user)}
          onAutoMarkPreviousEpisodesWatchedChange={changeAutoMarkPreviousEpisodesWatched}
          onLanguageChange={changeLanguage}
        />
      ) : view === "watchlist" ? (
        <WatchlistPage
          error={watchlistError}
          items={watchlistItems}
          loading={watchlistLoading}
          progressItems={progressItems}
          signedIn={Boolean(user)}
          onRemove={removeWatchlistItem}
          onSelect={selectWatchlistItem}
          onNextEpisodeWatched={markNextWatchlistEpisodeWatched}
          onStatusChange={updateWatchlistStatus}
        />
      ) : (
        <DiscoveryPage view={view} language={language} onSelect={selectItem} />
      )}
    </>
  );
};
