import {useEffect, useMemo, useRef, useState} from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  ListChecks,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {nextEpisodeLabelFor} from "../lib/continuation";
import {
  availableUnwatchedEpisodes,
  availableWatchedEpisodes,
  buildSeasonProgressSnapshots,
  formatWatchTime,
  previousEpisodesToMark,
  showProgressRemaining,
  type SeasonProgressSnapshot,
} from "../lib/seasonProgress";
import {EpisodeSummary, MediaDetail, TvSeasonDetail} from "../types/media";
import {ShowProgress} from "../types/progress";
import {WatchlistItem, WatchlistStatus, tvWatchlistStatuses} from "../types/watchlist";
import {DiscussionPanel} from "../components/DiscussionPanel";

const statusLabels: Record<WatchlistStatus, string> = {
  planned: "Planned",
  watching: "Watching",
  completed: "Completed",
  dropped: "Dropped",
  unwatched: "Not watched",
  watched: "Watched",
};

interface DetailPageProps {
  detail: MediaDetail;
  onEpisodeWatched: (episode: EpisodeSummary) => void;
  onEpisodeUnwatched: (episode: EpisodeSummary) => void;
  onAddToWatchlist: (detail: MediaDetail) => void;
  onBack: () => void;
  onMarkAvailableSeasonWatched: () => void;
  onMarkNextEpisodeWatched: () => void;
  onMarkPreviousEpisodesWatched: () => void;
  onMarkSeasonUnwatched: () => void;
  onMarkSelectedEpisodes: (episodes: EpisodeSummary[], watched: boolean) => void;
  onRemoveFromWatchlist: (item: WatchlistItem) => void;
  onSeasonChange: (seasonNumber: number) => void;
  onWatchlistStatusChange: (item: WatchlistItem, status: WatchlistStatus) => void;
  progress: ShowProgress | null;
  progressError: string | null;
  progressLoading: boolean;
  seasonDetail: TvSeasonDetail | null;
  seasonError: string | null;
  seasonLoading: boolean;
  selectedSeason: number;
  signedIn: boolean;
  watchlistItem: WatchlistItem | null;
}

export const DetailPage = ({
  detail,
  onEpisodeWatched,
  onEpisodeUnwatched,
  onAddToWatchlist,
  onBack,
  onMarkAvailableSeasonWatched,
  onMarkNextEpisodeWatched,
  onMarkPreviousEpisodesWatched,
  onMarkSeasonUnwatched,
  onMarkSelectedEpisodes,
  onRemoveFromWatchlist,
  onSeasonChange,
  onWatchlistStatusChange,
  progress,
  progressError,
  progressLoading,
  seasonDetail,
  seasonError,
  seasonLoading,
  selectedSeason,
  signedIn,
  watchlistItem,
}: DetailPageProps) => {
  const watchedKeys = useMemo(
    () => new Set(progress?.episodes.map((episode) => episode.episodeKey) ?? []),
    [progress],
  );
  const seasons = detail.seasons ?? [];
  const seasonSnapshots = useMemo(
    () => buildSeasonProgressSnapshots(seasons, progress, seasonDetail),
    [progress, seasonDetail, seasons],
  );
  const selectedSnapshot =
    seasonSnapshots.find((season) => season.seasonNumber === selectedSeason) ?? null;
  const unwatchedAvailableSeasonCount = seasonDetail
    ? availableUnwatchedEpisodes(seasonDetail, watchedKeys).length
    : 0;
  const watchedInSeasonCount = seasonDetail ? availableWatchedEpisodes(seasonDetail, watchedKeys).length : 0;
  const previousCount = seasonDetail
    ? previousEpisodesToMark(seasonDetail, watchedKeys, progress?.nextEpisode ?? null).length
    : 0;
  const seasonRemainingMinutes = selectedSnapshot?.estimatedRemainingMinutes ?? 0;
  const showRemainingMinutes = seasonSnapshots.reduce(
    (sum, season) => sum + season.estimatedRemainingMinutes,
    0,
  );
  const showRemaining = showProgressRemaining(progress);
  const nextEpisode = progress?.nextEpisode ?? null;
  const [dismissedNextKey, setDismissedNextKey] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [expandedSeason, setExpandedSeason] = useState<number | null>(selectedSeason);
  const seasonCardRefs = useRef(new Map<number, HTMLElement>());
  const hasMountedSelectedSeason = useRef(false);
  const showNextPrompt =
    signedIn && detail.mediaType === "tv" && Boolean(nextEpisode) && dismissedNextKey !== nextEpisode?.episodeKey;

  useEffect(() => {
    setDismissedNextKey(null);
  }, [detail.id]);

  useEffect(() => {
    setSelectMode(false);
    setSelectedKeys(new Set());
  }, [selectedSeason, detail.id]);

  useEffect(() => {
    setExpandedSeason(selectedSeason);
  }, [selectedSeason, detail.id]);

  useEffect(() => {
    if (!hasMountedSelectedSeason.current) {
      hasMountedSelectedSeason.current = true;
      return;
    }
    if (expandedSeason == null) {
      return;
    }
    const node = seasonCardRefs.current.get(expandedSeason);
    if (typeof node?.scrollIntoView === "function") {
      node.scrollIntoView({behavior: "smooth", block: "nearest"});
    }
  }, [expandedSeason]);

  const toggleSelected = (episodeKey: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(episodeKey)) {
        next.delete(episodeKey);
      } else {
        next.add(episodeKey);
      }
      return next;
    });
  };

  const selectedEpisodes = (seasonDetail?.episodes ?? []).filter((episode) => selectedKeys.has(episode.episodeKey));

  const handleSeasonCardActivate = (season: SeasonProgressSnapshot) => {
    if (expandedSeason === season.seasonNumber) {
      setExpandedSeason(null);
      return;
    }
    setExpandedSeason(season.seasonNumber);
    if (season.seasonNumber !== selectedSeason) {
      onSeasonChange(season.seasonNumber);
    }
  };

  const episodeContent = (
    <div className="season-episode-panel" data-testid="season-episode-panel">
      <div className="episode-header">
        <div>
          <span className="media-kind">Episodes</span>
          <h3>{seasonDetail?.title ?? `Season ${selectedSeason}`}</h3>
        </div>
        {seasons.length > 1 && (
          <select
            aria-label={`Season for ${detail.title}`}
            value={selectedSeason}
            onChange={(event) => onSeasonChange(Number(event.target.value))}
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.seasonNumber}>
                {season.title} ({season.episodeCount})
              </option>
            ))}
          </select>
        )}
      </div>

      {signedIn ? (
        <>
          <div className="progress-strip">
            <span className="progress-copy">
              <ListChecks size={18} aria-hidden="true" />
              {progressLoading ? (
                <span>Loading progress...</span>
              ) : progress ? (
                <span>
                  {progress.watchedEpisodeCount} of {progress.totalEpisodes} watched ({progress.progressPercent}%)
                  {selectedSnapshot
                    ? ` · Season ${selectedSnapshot.watchedCount}/${selectedSnapshot.totalEpisodes}`
                    : ""}
                </span>
              ) : (
                <span>No watched episodes yet.</span>
              )}
            </span>
            {seasonRemainingMinutes > 0 && (
              <span className="progress-eta" data-testid="season-remaining-time">
                <Clock size={16} aria-hidden="true" />
                ~{formatWatchTime(seasonRemainingMinutes)} left
              </span>
            )}
          </div>

          <div className="season-bulk-actions" data-testid="season-bulk-actions">
            <button
              className="season-watch-button"
              data-testid="mark-season-watched"
              type="button"
              disabled={progressLoading || seasonLoading || unwatchedAvailableSeasonCount === 0}
              onClick={onMarkAvailableSeasonWatched}
            >
              <CheckCircle2 size={18} aria-hidden="true" />
              Mark season watched
            </button>
            <button
              className="text-button"
              data-testid="mark-previous-watched"
              type="button"
              disabled={progressLoading || seasonLoading || previousCount === 0}
              onClick={onMarkPreviousEpisodesWatched}
            >
              Mark previous watched
            </button>
            <button
              className="text-button"
              data-testid="mark-season-unwatched"
              type="button"
              disabled={progressLoading || seasonLoading || watchedInSeasonCount === 0}
              onClick={onMarkSeasonUnwatched}
            >
              Mark season unwatched
            </button>
            <button
              className="text-button"
              data-testid="toggle-episode-select"
              type="button"
              disabled={progressLoading || seasonLoading || !seasonDetail?.episodes.length}
              onClick={() => {
                setSelectMode((current) => !current);
                setSelectedKeys(new Set());
              }}
            >
              {selectMode ? "Cancel select" : "Select episodes"}
            </button>
          </div>

          {selectMode && (
            <div className="season-bulk-actions select-actions" data-testid="episode-select-actions">
              <span>{selectedKeys.size} selected</span>
              <button
                className="text-button"
                data-testid="mark-selected-watched"
                type="button"
                disabled={progressLoading || selectedEpisodes.length === 0}
                onClick={() => onMarkSelectedEpisodes(selectedEpisodes, true)}
              >
                Mark selected watched
              </button>
              <button
                className="text-button"
                data-testid="mark-selected-unwatched"
                type="button"
                disabled={progressLoading || selectedEpisodes.length === 0}
                onClick={() => onMarkSelectedEpisodes(selectedEpisodes, false)}
              >
                Mark selected unwatched
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="state-panel">Sign in to track watched episodes.</div>
      )}

      {progressError && <div className="state-panel error">{progressError}</div>}
      {seasonError && <div className="state-panel error">{seasonError}</div>}
      {seasonLoading ? (
        <div className="state-panel">Loading episodes...</div>
      ) : (
        <div className="episode-list">
          {(seasonDetail?.episodes ?? []).map((episode) => {
            const watched = watchedKeys.has(episode.episodeKey);
            const selected = selectedKeys.has(episode.episodeKey);
            return (
              <article
                className={selectMode ? "episode-row selectable" : "episode-row"}
                data-testid={`episode-row-${episode.episodeKey}`}
                key={episode.episodeKey}
              >
                {selectMode && (
                  <label className="episode-select">
                    <input
                      type="checkbox"
                      data-testid={`episode-select-${episode.episodeKey}`}
                      checked={selected}
                      onChange={() => toggleSelected(episode.episodeKey)}
                    />
                    <span className="sr-only">Select {episode.title || `Episode ${episode.episodeNumber}`}</span>
                  </label>
                )}
                <div className="episode-number">
                  S{episode.seasonNumber} E{episode.episodeNumber}
                </div>
                <div className="episode-copy">
                  <strong>{episode.title || `Episode ${episode.episodeNumber}`}</strong>
                  <p>{episode.overview || "No episode overview available."}</p>
                </div>
                <button
                  className={watched ? "episode-toggle watched" : "episode-toggle"}
                  data-testid={`episode-toggle-${episode.episodeKey}`}
                  type="button"
                  disabled={!signedIn || progressLoading}
                  onClick={() => (watched ? onEpisodeUnwatched(episode) : onEpisodeWatched(episode))}
                >
                  {watched ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                  {watched ? "Watched" : "Mark watched"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <main className="detail-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
        Back
      </button>

      <section className="detail-hero" data-testid={`detail-${detail.mediaType}-${detail.id}`}>
        {detail.images.backdrop && <img src={detail.images.backdrop} alt="" />}
        <div className="detail-overlay" />
        <div className="detail-content">
          <div className="detail-poster">
            {detail.images.poster ? <img src={detail.images.poster} alt="" /> : <span>No poster</span>}
          </div>
          <div className="detail-copy">
            <span className="media-kind">{detail.mediaType === "movie" ? "Movie" : "TV"}</span>
            <h2>{detail.title}</h2>
            <div className="detail-facts">
              <span>
                <Star size={16} fill="currentColor" aria-hidden="true" />
                {detail.voteAverage.toFixed(1)}
              </span>
              {detail.runtimeMinutes && (
                <span>
                  <Clock size={16} aria-hidden="true" />
                  {detail.runtimeMinutes} min
                </span>
              )}
              {detail.status && <span>{detail.status}</span>}
              {detail.totalEpisodes && <span>{detail.totalEpisodes} episodes</span>}
            </div>
            {signedIn && detail.mediaType === "tv" && progress && (
              <div className="show-progress-summary" data-testid="show-progress-summary">
                <span>
                  {progress.watchedEpisodeCount} / {progress.totalEpisodes} episodes · {progress.progressPercent}%
                  complete
                </span>
                <span>
                  {showRemaining.remainingCount} episode{showRemaining.remainingCount === 1 ? "" : "s"} remaining
                  {showRemainingMinutes > 0
                    ? ` · approximately ${formatWatchTime(showRemainingMinutes)}`
                    : ""}
                </span>
                <div
                  className="progress-bar show-progress-bar"
                  aria-label={`${detail.title} progress ${progress.progressPercent}%`}
                >
                  <span style={{width: `${Math.min(progress.progressPercent, 100)}%`}} />
                </div>
              </div>
            )}
            <p>{detail.overview || "No overview available."}</p>
            <div className="genre-row">
              {detail.genres.map((genre) => (
                <span key={genre.id}>{genre.name}</span>
              ))}
            </div>
            {detail.homepage && (
              <a href={detail.homepage} target="_blank" rel="noreferrer">
                <ExternalLink size={16} aria-hidden="true" />
                Official site
              </a>
            )}
            <div className="detail-actions">
              {!signedIn ? (
                <span className="auth-note">Sign in to save this title.</span>
              ) : watchlistItem ? (
                <>
                  <span className="saved-chip">
                    <Check size={16} aria-hidden="true" />
                    In watchlist
                  </span>
                  {detail.mediaType === "movie" ? (
                    <button
                      className={
                        watchlistItem.status === "watched" ? "watched-toggle is-watched" : "watched-toggle"
                      }
                      type="button"
                      data-testid="detail-watchlist-status"
                      aria-pressed={watchlistItem.status === "watched"}
                      aria-label={
                        watchlistItem.status === "watched"
                          ? `Mark ${detail.title} as not watched`
                          : `Mark ${detail.title} as watched`
                      }
                      title={watchlistItem.status === "watched" ? "Watched" : "Not watched"}
                      onClick={() =>
                        onWatchlistStatusChange(
                          watchlistItem,
                          watchlistItem.status === "watched" ? "unwatched" : "watched",
                        )
                      }
                    >
                      {watchlistItem.status === "watched" ? (
                        <Eye size={18} aria-hidden="true" />
                      ) : (
                        <EyeOff size={18} aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    <select
                      aria-label={`Watchlist status for ${detail.title}`}
                      data-testid="detail-watchlist-status"
                      value={watchlistItem.status}
                      onChange={(event) =>
                        onWatchlistStatusChange(watchlistItem, event.target.value as WatchlistStatus)
                      }
                    >
                      {tvWatchlistStatuses.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  )}
                  <button data-testid="detail-remove-watchlist" type="button" onClick={() => onRemoveFromWatchlist(watchlistItem)}>
                    <Trash2 size={16} aria-hidden="true" />
                    Remove
                  </button>
                </>
              ) : (
                <button data-testid="detail-add-watchlist" type="button" onClick={() => onAddToWatchlist(detail)}>
                  <Bookmark size={16} aria-hidden="true" />
                  Add to watchlist
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {showNextPrompt && nextEpisode && (
        <section className="next-episode-prompt" data-testid="next-episode-prompt">
          <div className="next-episode-prompt-copy">
            <span className="media-kind">Watch next</span>
            <strong>
              {nextEpisodeLabelFor(progress!)}
              {nextEpisode.episodeTitle ? ` · ${nextEpisode.episodeTitle}` : ""}
            </strong>
            <span>
              {progress!.watchedEpisodeCount} of {progress!.totalEpisodes} watched
              {showRemaining.remainingCount > 0 ? ` · ${showRemaining.remainingCount} remaining` : ""}
            </span>
          </div>
          <div className="next-episode-prompt-actions">
            <button
              className="continue-button"
              data-testid="next-episode-mark-watched"
              type="button"
              disabled={progressLoading}
              onClick={onMarkNextEpisodeWatched}
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              Mark watched
            </button>
            <button
              className="icon-button"
              data-testid="next-episode-dismiss"
              type="button"
              aria-label="Dismiss next episode prompt"
              onClick={() => setDismissedNextKey(nextEpisode.episodeKey)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {detail.mediaType === "tv" && (
        <section className="episode-panel">
          {seasonSnapshots.length > 0 ? (
            <div className="season-card-list" data-testid="season-card-list">
              {seasonSnapshots.map((season) => {
                const expanded = season.seasonNumber === expandedSeason;
                const showEpisodes = expanded && season.seasonNumber === selectedSeason;
                return (
                  <article
                    className={expanded ? "season-card expanded" : "season-card"}
                    data-testid={`season-card-${season.seasonNumber}`}
                    key={season.seasonNumber}
                    ref={(node) => {
                      if (node) {
                        seasonCardRefs.current.set(season.seasonNumber, node);
                      } else {
                        seasonCardRefs.current.delete(season.seasonNumber);
                      }
                    }}
                  >
                    <button
                      className="season-card-toggle"
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => handleSeasonCardActivate(season)}
                    >
                      <span className="season-card-chevron" aria-hidden="true">
                        {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </span>
                      <span className="season-card-copy">
                        <strong>{season.title}</strong>
                        <span>
                          {season.watchedCount} / {season.totalEpisodes} episodes · {season.progressPercent}%
                          {season.remainingCount > 0
                            ? ` · ${season.remainingCount} remaining`
                            : ""}
                        </span>
                      </span>
                      {season.completed ? (
                        <span className="season-complete-badge" data-testid={`season-complete-${season.seasonNumber}`}>
                          <CheckCircle2 size={14} aria-hidden="true" />
                          Complete
                        </span>
                      ) : (
                        <span className="season-eta">~{formatWatchTime(season.estimatedRemainingMinutes)}</span>
                      )}
                    </button>
                    <div
                      className="progress-bar"
                      aria-label={`${season.title} progress ${season.progressPercent}%`}
                    >
                      <span style={{width: `${Math.min(season.progressPercent, 100)}%`}} />
                    </div>
                    {showEpisodes && episodeContent}
                    {expanded && !showEpisodes && (
                      <div className="season-episode-panel">
                        <div className="state-panel">Loading episodes...</div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            episodeContent
          )}
        </section>
      )}

      <DiscussionPanel
        mediaType={detail.mediaType}
        signedIn={signedIn}
        tmdbId={detail.id}
        seasonNumber={detail.mediaType === "tv" ? selectedSeason : null}
        episodeNumber={null}
      />
    </main>
  );
};
