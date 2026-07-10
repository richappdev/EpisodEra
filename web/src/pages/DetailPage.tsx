import {ArrowLeft, Bookmark, Check, CheckCircle2, Circle, Clock, ExternalLink, ListChecks, Star, Trash2} from "lucide-react";
import {EpisodeSummary, MediaDetail, TvSeasonDetail} from "../types/media";
import {ShowProgress} from "../types/progress";
import {WatchlistItem, WatchlistStatus, watchlistStatuses} from "../types/watchlist";

const statusLabels: Record<WatchlistStatus, string> = {
  planned: "Planned",
  watching: "Watching",
  completed: "Completed",
  dropped: "Dropped",
};

interface DetailPageProps {
  detail: MediaDetail;
  onEpisodeWatched: (episode: EpisodeSummary) => void;
  onEpisodeUnwatched: (episode: EpisodeSummary) => void;
  onAddToWatchlist: (detail: MediaDetail) => void;
  onBack: () => void;
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
  const watchedKeys = new Set(progress?.episodes.map((episode) => episode.episodeKey) ?? []);
  const seasons = detail.seasons ?? [];

  return (
    <main className="detail-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
        Back
      </button>

      <section className="detail-hero">
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
                  <select
                    aria-label={`Watchlist status for ${detail.title}`}
                    value={watchlistItem.status}
                    onChange={(event) => onWatchlistStatusChange(watchlistItem, event.target.value as WatchlistStatus)}
                  >
                    {watchlistStatuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => onRemoveFromWatchlist(watchlistItem)}>
                    <Trash2 size={16} aria-hidden="true" />
                    Remove
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => onAddToWatchlist(detail)}>
                  <Bookmark size={16} aria-hidden="true" />
                  Add to watchlist
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {detail.mediaType === "tv" && (
        <section className="episode-panel">
          <div className="episode-header">
            <div>
              <span className="media-kind">Episodes</span>
              <h3>{seasonDetail?.title ?? `Season ${selectedSeason}`}</h3>
            </div>
            {seasons.length > 0 && (
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
            <div className="progress-strip">
              <ListChecks size={18} aria-hidden="true" />
              {progressLoading ? (
                <span>Loading progress...</span>
              ) : progress ? (
                <span>
                  {progress.watchedEpisodeCount} of {progress.totalEpisodes} watched ({progress.progressPercent}%)
                </span>
              ) : (
                <span>No watched episodes yet.</span>
              )}
            </div>
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
                return (
                  <article className="episode-row" key={episode.episodeKey}>
                    <div className="episode-number">
                      S{episode.seasonNumber} E{episode.episodeNumber}
                    </div>
                    <div className="episode-copy">
                      <strong>{episode.title || `Episode ${episode.episodeNumber}`}</strong>
                      <p>{episode.overview || "No episode overview available."}</p>
                    </div>
                    <button
                      className={watched ? "episode-toggle watched" : "episode-toggle"}
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
        </section>
      )}
    </main>
  );
};
