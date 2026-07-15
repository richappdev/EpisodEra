import {useMemo} from "react";
import {Bookmark, Film, Loader2, Trash2} from "lucide-react";
import {ContinueWatchingSection} from "../components/ContinueWatchingSection";
import {SectionError} from "../components/SectionError";
import {buildContinuationGroups, type ContinuationEntry} from "../lib/continuation";
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
  hasMore: boolean;
  items: WatchlistItem[];
  loading: boolean;
  loadingMore: boolean;
  pendingShowIds?: ReadonlySet<number>;
  progressItems: ShowProgressSummary[];
  signedIn: boolean;
  totalCount: number;
  onLoadMore: () => void;
  onRemove: (item: WatchlistItem) => void;
  onRetry: () => void;
  onSelect: (item: WatchlistItem) => void;
  onSelectContinuation: (entry: ContinuationEntry) => void;
  onNextEpisodeWatched: (entry: ContinuationEntry) => void;
  onStatusChange: (item: WatchlistItem, status: WatchlistStatus) => void;
}

export const WatchlistPage = ({
  error,
  hasMore,
  items,
  loading,
  loadingMore,
  pendingShowIds,
  progressItems,
  signedIn,
  totalCount,
  onLoadMore,
  onRemove,
  onRetry,
  onSelect,
  onSelectContinuation,
  onNextEpisodeWatched,
  onStatusChange,
}: WatchlistPageProps) => {
  const {continueWatching, dormant} = useMemo(
    () => buildContinuationGroups(items, progressItems),
    [items, progressItems],
  );

  if (!signedIn) {
    return (
      <main className="page-shell">
        <div className="state-panel">Sign in to manage your watchlist.</div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="watchlist-header" data-testid="watchlist-header">
        <div>
          <span className="media-kind">Library</span>
          <h2>Watchlist</h2>
        </div>
        <span>{totalCount || items.length} saved</span>
      </section>

      {loading && (
        <div className="state-panel inline-state">
          <Loader2 size={18} aria-hidden="true" />
          Loading watchlist...
        </div>
      )}
      {error && !loading && <SectionError message={error} onRetry={onRetry} />}
      {!loading && !error && items.length === 0 && (
        <div className="state-panel empty-watchlist">
          <Bookmark size={24} aria-hidden="true" />
          Your watchlist is empty.
        </div>
      )}

      <ContinueWatchingSection
        id="continue-watching"
        title="Continue watching"
        subtitle={`${continueWatching.length} active`}
        entries={continueWatching}
        pendingShowIds={pendingShowIds}
        onSelect={onSelectContinuation}
        onNextEpisodeWatched={onNextEpisodeWatched}
      />

      <ContinueWatchingSection
        id="dormant-watching"
        title="Haven't watched for a while"
        subtitle={`${dormant.length} dormant`}
        testIdPrefix="dormant"
        entries={dormant}
        pendingShowIds={pendingShowIds}
        onSelect={onSelectContinuation}
        onNextEpisodeWatched={onNextEpisodeWatched}
      />

      <div className="watchlist-grid">
        {items.map((item) => {
          const statusOptions = item.mediaType === "movie" ? movieWatchlistStatuses : tvWatchlistStatuses;

          return (
            <article className="watchlist-item" data-testid={`watchlist-item-${item.tmdbId}`} key={item.itemId}>
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
                  data-testid={`watchlist-status-${item.tmdbId}`}
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

      {hasMore && !loading && !error && (
        <div className="section-actions">
          <button className="text-button" disabled={loadingMore} type="button" onClick={onLoadMore}>
            {loadingMore ? "Loading more..." : "Load more titles"}
          </button>
        </div>
      )}
    </main>
  );
};
