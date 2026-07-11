import {Bookmark, CheckCircle2, Film, ListChecks, Loader2, Trash2} from "lucide-react";
import {ShowProgressSummary} from "../types/progress";
import {WatchlistItem, WatchlistStatus, movieWatchlistStatuses, tvWatchlistStatuses} from "../types/watchlist";

const statusLabels: Record<WatchlistStatus, string> = {
  planned: "Planned",
  watching: "Watching",
  completed: "Completed",
  dropped: "Dropped",
  unwatched: "Not watched",
  watched: "Watched",
};

interface WatchlistPageProps {
  error: string | null;
  items: WatchlistItem[];
  loading: boolean;
  progressItems: ShowProgressSummary[];
  signedIn: boolean;
  onRemove: (item: WatchlistItem) => void;
  onSelect: (item: WatchlistItem) => void;
  onNextEpisodeWatched: (item: WatchlistItem, progress: ShowProgressSummary) => void;
  onStatusChange: (item: WatchlistItem, status: WatchlistStatus) => void;
}

const nextEpisodeLabelFor = (progress: ShowProgressSummary) => {
  if (!progress.nextEpisode) {
    return "Next episode";
  }

  return `Next up S${progress.nextEpisode.seasonNumber} E${progress.nextEpisode.episodeNumber}`;
};

export const WatchlistPage = ({
  error,
  items,
  loading,
  progressItems,
  signedIn,
  onRemove,
  onSelect,
  onNextEpisodeWatched,
  onStatusChange,
}: WatchlistPageProps) => {
  const progressByShowId = new Map(progressItems.map((progress) => [progress.showId, progress]));
  const continueWatchingItems = items
    .filter((item) => item.mediaType === "tv" && item.status === "watching")
    .map((item) => ({item, progress: progressByShowId.get(String(item.tmdbId)) ?? null}))
    .filter(({progress}) => progress && progress.watchedEpisodeCount > 0 && progress.nextEpisode);

  if (!signedIn) {
    return (
      <main className="page-shell">
        <div className="state-panel">Sign in to manage your watchlist.</div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="watchlist-header">
        <div>
          <span className="media-kind">Library</span>
          <h2>Watchlist</h2>
        </div>
        <span>{items.length} saved</span>
      </section>

      {loading && (
        <div className="state-panel inline-state">
          <Loader2 size={18} aria-hidden="true" />
          Loading watchlist...
        </div>
      )}
      {error && <div className="state-panel error">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="state-panel empty-watchlist">
          <Bookmark size={24} aria-hidden="true" />
          Your watchlist is empty.
        </div>
      )}

      {continueWatchingItems.length > 0 && (
        <section className="continue-panel">
          <div className="section-header">
            <h2>Continue watching</h2>
            <span>{continueWatchingItems.length} active</span>
          </div>
          <div className="continue-grid">
            {continueWatchingItems.map(({item, progress}) => (
              <article className="continue-card" key={item.itemId}>
                <button className="watchlist-poster" type="button" onClick={() => onSelect(item)}>
                  {item.poster ? <img src={item.poster} alt="" loading="lazy" /> : <Film size={28} aria-hidden="true" />}
                </button>
                <div className="continue-copy">
                  <strong>{item.title}</strong>
                  <span>
                    <ListChecks size={16} aria-hidden="true" />
                    {progress!.watchedEpisodeCount} of {progress!.totalEpisodes} watched
                  </span>
                  {progress!.nextEpisode && (
                    <span className="next-episode">{nextEpisodeLabelFor(progress!)}</span>
                  )}
                  <div className="progress-bar" aria-label={`${item.title} progress ${progress!.progressPercent}%`}>
                    <span style={{width: `${Math.min(progress!.progressPercent, 100)}%`}} />
                  </div>
                </div>
                <button
                  className="continue-button"
                  type="button"
                  onClick={() => onNextEpisodeWatched(item, progress!)}
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Watched
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="watchlist-grid">
        {items.map((item) => {
          const statusOptions = item.mediaType === "movie" ? movieWatchlistStatuses : tvWatchlistStatuses;

          return (
            <article className="watchlist-item" key={item.itemId}>
              <button className="watchlist-poster" type="button" onClick={() => onSelect(item)}>
                {item.poster ? <img src={item.poster} alt="" loading="lazy" /> : <Film size={28} aria-hidden="true" />}
              </button>
              <div className="watchlist-copy">
                <button type="button" onClick={() => onSelect(item)}>
                  {item.title}
                </button>
                <span className="media-kind">{item.mediaType === "movie" ? "Movie" : "TV"}</span>
                <select
                  aria-label={`Watchlist status for ${item.title}`}
                  value={item.status}
                  onChange={(event) => onStatusChange(item, event.target.value as WatchlistStatus)}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => onRemove(item)}
                title={`Remove ${item.title}`}
                aria-label={`Remove ${item.title}`}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </div>
    </main>
  );
};
