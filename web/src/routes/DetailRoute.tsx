import {useEffect, useMemo, useState} from "react";
import {useLocation, useNavigate, useParams} from "react-router-dom";
import {api} from "../api/client";
import {useAuth} from "../auth/AuthContext";
import {useAppContext} from "../AppContext";
import {DetailPage} from "../pages/DetailPage";
import {trackEvent} from "../firebase";
import {EpisodeSummary, MediaDetail, MediaType, TvSeasonDetail} from "../types/media";
import {ShowProgress} from "../types/progress";
import {paths} from "./paths";

const isAvailableEpisode = (episode: EpisodeSummary) => {
  if (!episode.airDate) {
    return true;
  }

  return new Date(`${episode.airDate}T00:00:00`).getTime() <= Date.now();
};

const parsePositiveInt = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

interface MediaDetailRouteProps {
  mediaType: MediaType;
}

export const MediaDetailRoute = ({mediaType}: MediaDetailRouteProps) => {
  const {id, seasonNumber: seasonNumberParam} = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {user} = useAuth();
  const {
    addToWatchlist,
    autoMarkPreviousEpisodesWatched,
    language,
    refreshStats,
    removeWatchlistItem,
    removeProgressItem,
    updateWatchlistStatus,
    upsertProgressItem,
    watchlistItems,
  } = useAppContext();

  const mediaId = parsePositiveInt(id);
  const routeSeasonNumber = parsePositiveInt(seasonNumberParam);
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ShowProgress | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [seasonDetail, setSeasonDetail] = useState<TvSeasonDetail | null>(null);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);

  useEffect(() => {
    if (!mediaId) {
      setDetail(null);
      setDetailError("Invalid media id.");
      return;
    }

    setDetailError(null);
    api.detail(mediaType, mediaId, language)
      .then((loadedDetail) => {
        setDetail(loadedDetail);
        trackEvent("screen_view", {
          firebase_screen: "detail",
          firebase_screen_class: "DetailPage",
          media_type: loadedDetail.mediaType,
          tmdb_id: loadedDetail.id,
        });
      })
      .catch((err: Error) => {
        setDetail(null);
        setDetailError(err.message);
      });
  }, [language, mediaId, mediaType]);

  useEffect(() => {
    if (!detail || detail.mediaType !== "tv") {
      setSelectedSeason(1);
      return;
    }

    const firstSeason = detail.seasons?.[0]?.seasonNumber ?? 1;
    const nextSeason = routeSeasonNumber ?? firstSeason;
    const seasonExists = detail.seasons?.some((season) => season.seasonNumber === nextSeason);
    setSelectedSeason(seasonExists ? nextSeason : firstSeason);
  }, [detail, routeSeasonNumber]);

  useEffect(() => {
    if (!detail || detail.mediaType !== "tv" || !mediaId) {
      setSeasonDetail(null);
      setSeasonError(null);
      setSeasonLoading(false);
      return;
    }

    setSeasonLoading(true);
    setSeasonError(null);
    api.tvSeason(mediaId, selectedSeason, language)
      .then(setSeasonDetail)
      .catch((err: Error) => setSeasonError(err.message))
      .finally(() => setSeasonLoading(false));
  }, [detail, language, mediaId, selectedSeason]);

  useEffect(() => {
    if (!detail || detail.mediaType !== "tv" || !user || !mediaId) {
      setProgress(null);
      setProgressError(null);
      setProgressLoading(false);
      return;
    }

    setProgressLoading(true);
    setProgressError(null);
    api.getProgress(mediaId)
      .then(({progress: loadedProgress}) => setProgress(loadedProgress))
      .catch((err: Error) => setProgressError(err.message))
      .finally(() => setProgressLoading(false));
  }, [detail, mediaId, user]);

  const currentWatchlistItem = useMemo(
    () =>
      detail
        ? watchlistItems.find((item) => item.mediaType === detail.mediaType && item.tmdbId === detail.id) ?? null
        : null,
    [detail, watchlistItems],
  );

  const handleSeasonChange = (nextSeason: number) => {
    if (!mediaId) {
      return;
    }

    navigate(paths.tvSeason(mediaId, nextSeason), {replace: true, state: location.state});
  };

  const markEpisodeWatched = async (episode: EpisodeSummary) => {
    if (!detail || detail.mediaType !== "tv" || !mediaId) {
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

      const latestProgress = await api.updateEpisodes(mediaId, {
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
    if (!detail || detail.mediaType !== "tv" || !seasonDetail || !mediaId) {
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
      const latestProgress = await api.updateEpisodes(mediaId, {
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
    if (!detail || detail.mediaType !== "tv" || !mediaId) {
      return;
    }

    setProgressLoading(true);
    setProgressError(null);
    api.markEpisodeUnwatched(mediaId, episode.episodeKey)
      .then(({progress: updatedProgress}) => {
        trackEvent("select_content", {
          content_type: "episode_unwatched",
          item_id: episode.episodeKey,
        });
        setProgress(updatedProgress);
        if (updatedProgress) {
          upsertProgressItem(updatedProgress);
        } else {
          removeProgressItem(mediaId);
        }
        refreshStats();
      })
      .catch((err: Error) => setProgressError(err.message))
      .finally(() => setProgressLoading(false));
  };

  if (!mediaId) {
    return (
      <main className="page-shell">
        <div className="state-panel error">Invalid media id.</div>
      </main>
    );
  }

  if (detailError) {
    return (
      <>
        {detailError && <div className="floating-error">{detailError}</div>}
        <main className="page-shell">
          <div className="state-panel error">{detailError}</div>
        </main>
      </>
    );
  }

  if (!detail) {
    return (
      <main className="page-shell">
        <div className="state-panel">Loading detail...</div>
      </main>
    );
  }

  return (
    <>
      {detailError && <div className="floating-error">{detailError}</div>}
      <DetailPage
        detail={detail}
        onEpisodeWatched={markEpisodeWatched}
        onEpisodeUnwatched={markEpisodeUnwatched}
        onAddToWatchlist={addToWatchlist}
        onBack={() => navigate(-1)}
        onMarkAvailableSeasonWatched={markAvailableSeasonWatched}
        onRemoveFromWatchlist={removeWatchlistItem}
        onSeasonChange={handleSeasonChange}
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
};
