import {useEffect, useState} from "react";
import {api, setApiTokenProvider} from "./api/client";
import {useAuth} from "./auth/AuthContext";
import {TopBar} from "./components/TopBar";
import {AuthPage} from "./pages/AuthPage";
import {DetailPage} from "./pages/DetailPage";
import {DiscoveryPage} from "./pages/DiscoveryPage";
import {WatchlistPage} from "./pages/WatchlistPage";
import {EpisodeSummary, MediaDetail, MediaSummary, TvSeasonDetail} from "./types/media";
import {ShowProgress} from "./types/progress";
import {WatchlistItem, WatchlistStatus} from "./types/watchlist";

type View = "trending" | "search" | "watchlist" | "auth";

export const App = () => {
  const {getIdToken, loading, signOutUser, user} = useAuth();
  const [view, setView] = useState<View>("trending");
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [progress, setProgress] = useState<ShowProgress | null>(null);
  const [progressItems, setProgressItems] = useState<ShowProgress[]>([]);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [seasonDetail, setSeasonDetail] = useState<TvSeasonDetail | null>(null);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);

  useEffect(() => {
    setApiTokenProvider(getIdToken);
  }, [getIdToken]);

  useEffect(() => {
    if (!user) {
      setWatchlistItems([]);
      setWatchlistError(null);
      setWatchlistLoading(false);
      setProgressItems([]);
      return;
    }

    setWatchlistLoading(true);
    setWatchlistError(null);
    Promise.all([api.listWatchlist(), api.listProgress()])
      .then(([{items}, {items: loadedProgressItems}]) => {
        setWatchlistItems(items);
        setProgressItems(loadedProgressItems);
      })
      .catch((err: Error) => setWatchlistError(err.message))
      .finally(() => setWatchlistLoading(false));
  }, [user]);

  const upsertWatchlistItem = (item: WatchlistItem) => {
    setWatchlistItems((current) => {
      const existing = current.findIndex((candidate) => candidate.itemId === item.itemId);
      if (existing === -1) {
        return [item, ...current];
      }

      return current.map((candidate) => (candidate.itemId === item.itemId ? item : candidate));
    });
  };

  const upsertProgressItem = (item: ShowProgress | null) => {
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
    api.tvSeason(detail.id, selectedSeason)
      .then(setSeasonDetail)
      .catch((err: Error) => setSeasonError(err.message))
      .finally(() => setSeasonLoading(false));
  }, [detail, selectedSeason]);

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

  const selectItem = (item: MediaSummary) => {
    setDetailError(null);
    api.detail(item.mediaType, item.id)
      .then(setDetail)
      .catch((err: Error) => setDetailError(err.message));
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
      .then(upsertWatchlistItem)
      .catch((err: Error) => setWatchlistError(err.message));
  };

  const updateWatchlistStatus = (item: WatchlistItem, status: WatchlistStatus) => {
    if (item.status === status) {
      return;
    }

    setWatchlistError(null);
    api.updateWatchlistStatus(item.itemId, status)
      .then(upsertWatchlistItem)
      .catch((err: Error) => setWatchlistError(err.message));
  };

  const removeWatchlistItem = (item: WatchlistItem) => {
    setWatchlistError(null);
    api.removeWatchlistItem(item.itemId)
      .then(() => {
        setWatchlistItems((current) => current.filter((candidate) => candidate.itemId !== item.itemId));
      })
      .catch((err: Error) => setWatchlistError(err.message));
  };

  const markEpisodeWatched = (episode: EpisodeSummary) => {
    if (!detail || detail.mediaType !== "tv") {
      return;
    }

    setProgressLoading(true);
    setProgressError(null);
    api.markEpisodeWatched(detail.id, {
      title: detail.title,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      episodeTitle: episode.title || `Episode ${episode.episodeNumber}`,
      totalEpisodes: detail.totalEpisodes ?? seasonDetail?.episodeCount ?? 1,
    })
      .then((updatedProgress) => {
        setProgress(updatedProgress);
        upsertProgressItem(updatedProgress);
      })
      .catch((err: Error) => setProgressError(err.message))
      .finally(() => setProgressLoading(false));
  };

  const markEpisodeUnwatched = (episode: EpisodeSummary) => {
    if (!detail || detail.mediaType !== "tv") {
      return;
    }

    setProgressLoading(true);
    setProgressError(null);
    api.markEpisodeUnwatched(detail.id, episode.episodeKey)
      .then(({progress: updatedProgress}) => {
        setProgress(updatedProgress);
        if (updatedProgress) {
          upsertProgressItem(updatedProgress);
        } else {
          setProgressItems((current) => current.filter((candidate) => candidate.tmdbId !== detail.id));
        }
      })
      .catch((err: Error) => setProgressError(err.message))
      .finally(() => setProgressLoading(false));
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

  if (detail) {
    return (
      <>
        {watchlistError && <div className="floating-error">{watchlistError}</div>}
        <DetailPage
          detail={detail}
          onEpisodeWatched={markEpisodeWatched}
          onEpisodeUnwatched={markEpisodeUnwatched}
          onAddToWatchlist={addToWatchlist}
          onBack={() => setDetail(null)}
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
      </>
    );
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="state-panel">Loading account...</div>
      </main>
    );
  }

  return (
    <>
      <TopBar
        activeView={view === "auth" ? "trending" : view}
        user={user}
        onAuthOpen={() => setView("auth")}
        onSignOut={() => {
          void signOutUser();
          setView("trending");
        }}
        onViewChange={setView}
      />
      {detailError && <div className="floating-error">{detailError}</div>}
      {view === "auth" ? (
        <AuthPage onDone={() => setView("trending")} />
      ) : view === "watchlist" ? (
        <WatchlistPage
          error={watchlistError}
          items={watchlistItems}
          loading={watchlistLoading}
          progressItems={progressItems}
          signedIn={Boolean(user)}
          onRemove={removeWatchlistItem}
          onSelect={selectWatchlistItem}
          onStatusChange={updateWatchlistStatus}
        />
      ) : (
        <DiscoveryPage view={view} onSelect={selectItem} />
      )}
    </>
  );
};
