import {useMemo, useState} from "react";
import {Bookmark, Film, Loader2, Trash2} from "lucide-react";
import {ContinueWatchingSection} from "../components/ContinueWatchingSection";
import {SectionError} from "../components/SectionError";
import {useDormantAfterDays} from "../hooks/useDormantAfterDays";
import {
  buildContinuationGroups,
  buildLibraryEntries,
  selectActiveWatchlistItems,
  type ContinuationEntry,
  type LibraryEntry,
  type LibraryReason,
} from "../lib/continuation";
import {ShowProgressSummary} from "../types/progress";
import {
  WatchlistItem,
  WatchlistStatus,
  movieWatchlistStatuses,
  tvWatchlistStatuses,
} from "../types/watchlist";

const statusLabels: Record<WatchlistStatus, string> = {
  planned: "Planned",
  watching: "Watching",
  completed: "Completed",
  dropped: "Dropped",
  unwatched: "Not watched",
  watched: "Watched",
};

const libraryReasonLabels: Record<LibraryReason, string> = {
  planned: "Planned",
  stale: "Stale",
  completed: "Completed",
};

type WatchlistTab = "active" | "library";

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
  onNextEpisodeWatched?: (entry: ContinuationEntry) => void;
  onRemove: (item: WatchlistItem) => void;
  onRetry: () => void;
  onSelect: (item: WatchlistItem) => void;
  onSelectContinuation?: (entry: ContinuationEntry) => void;
  onSelectLibrary: (entry: LibraryEntry) => void;
  onStatusChange: (item: WatchlistItem, status: WatchlistStatus) => void;
}

const initialTab = (): WatchlistTab =>
  typeof window !== "undefined" && window.location.hash === "#library" ? "library" : "active";

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
  onNextEpisodeWatched,
  onRemove,
  onRetry,
  onSelect,
  onSelectContinuation,
  onSelectLibrary,
  onStatusChange,
}: WatchlistPageProps) => {
  const [tab, setTab] = useState<WatchlistTab>(initialTab);
  const dormantAfterDays = useDormantAfterDays();

  const {continueWatching} = useMemo(
    () => buildContinuationGroups(items, progressItems, new Date(), dormantAfterDays),
    [dormantAfterDays, items, progressItems],
  );
  const activeItems = useMemo(
    () => selectActiveWatchlistItems(items, progressItems, new Date(), dormantAfterDays),
    [dormantAfterDays, items, progressItems],
  );
  const libraryEntries = useMemo(
    () => buildLibraryEntries(items, progressItems, new Date(), undefined, dormantAfterDays),
    [dormantAfterDays, items, progressItems],
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

      {onSelectContinuation &&
        onNextEpisodeWatched &&
        continueWatching.length > 0 && (
          <section className="home-hero" aria-label="Continue watching">
            <ContinueWatchingSection
              id="continue-watching"
              title="Continue watching"
              subtitle={`${continueWatching.length} active`}
              entries={continueWatching}
              pendingShowIds={pendingShowIds}
              onSelect={onSelectContinuation}
              onNextEpisodeWatched={onNextEpisodeWatched}
            />
          </section>
        )}

      <div className="tab-bar" role="tablist" aria-label="Watchlist sections">
        <button
          className={tab === "active" ? "active" : ""}
          data-testid="watchlist-tab-active"
          role="tab"
          type="button"
          aria-selected={tab === "active"}
          onClick={() => setTab("active")}
        >
          Active
          {activeItems.length > 0 ? ` (${activeItems.length})` : ""}
        </button>
        <button
          className={tab === "library" ? "active" : ""}
          data-testid="watchlist-tab-library"
          role="tab"
          type="button"
          aria-selected={tab === "library"}
          onClick={() => setTab("library")}
        >
          Library
          {libraryEntries.length > 0 ? ` (${libraryEntries.length})` : ""}
        </button>
      </div>

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

      {!loading && !error && items.length > 0 && tab === "active" && (
        <>
          {activeItems.length === 0 ? (
            <div className="state-panel empty-watchlist" data-testid="watchlist-active-empty">
              No active titles. Planned, stale, and completed shows are in Library.
            </div>
          ) : (
            <div className="watchlist-grid" data-testid="watchlist-active-grid">
              {activeItems.map((item) => {
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
          )}

          {hasMore && (
            <div className="section-actions">
              <button className="text-button" disabled={loadingMore} type="button" onClick={onLoadMore}>
                {loadingMore ? "Loading more..." : "Load more titles"}
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !error && tab === "library" && (
        <>
          {libraryEntries.length === 0 ? (
            <div className="state-panel empty-watchlist" data-testid="watchlist-library-empty">
              Library is empty. Planned, stale, and completed titles will appear here.
            </div>
          ) : (
            <div className="watchlist-grid" data-testid="watchlist-library-grid">
              {libraryEntries.map((entry) => {
                const item = entry.watchlistItem;
                const statusOptions = item
                  ? item.mediaType === "movie"
                    ? movieWatchlistStatuses
                    : tvWatchlistStatuses
                  : null;

                return (
                  <article
                    className="watchlist-item"
                    data-testid={`library-item-${entry.tmdbId}`}
                    key={entry.key}
                  >
                    <button className="watchlist-poster" type="button" onClick={() => onSelectLibrary(entry)}>
                      {entry.poster ? (
                        <img src={entry.poster} alt="" loading="lazy" />
                      ) : (
                        <Film size={28} aria-hidden="true" />
                      )}
                    </button>
                    <div className="watchlist-copy">
                      <button type="button" onClick={() => onSelectLibrary(entry)}>
                        {entry.title}
                      </button>
                      <span className="media-kind">{libraryReasonLabels[entry.reason]}</span>
                      {item && statusOptions ? (
                        <select
                          aria-label={`Watchlist status for ${entry.title}`}
                          data-testid={`library-status-${entry.tmdbId}`}
                          value={item.status}
                          onChange={(event) => onStatusChange(item, event.target.value as WatchlistStatus)}
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="media-kind">TV</span>
                      )}
                    </div>
                    {item && (
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => onRemove(item)}
                        title={`Remove ${entry.title}`}
                        aria-label={`Remove ${entry.title}`}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
};
