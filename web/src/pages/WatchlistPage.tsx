import {Bookmark, Film, Loader2, Trash2} from "lucide-react";
import {WatchlistItem, WatchlistStatus, watchlistStatuses} from "../types/watchlist";

const statusLabels: Record<WatchlistStatus, string> = {
  planned: "Planned",
  watching: "Watching",
  completed: "Completed",
  dropped: "Dropped",
};

interface WatchlistPageProps {
  error: string | null;
  items: WatchlistItem[];
  loading: boolean;
  signedIn: boolean;
  onRemove: (item: WatchlistItem) => void;
  onSelect: (item: WatchlistItem) => void;
  onStatusChange: (item: WatchlistItem, status: WatchlistStatus) => void;
}

export const WatchlistPage = ({
  error,
  items,
  loading,
  signedIn,
  onRemove,
  onSelect,
  onStatusChange,
}: WatchlistPageProps) => {
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

      <div className="watchlist-grid">
        {items.map((item) => (
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
                {watchlistStatuses.map((status) => (
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
        ))}
      </div>
    </main>
  );
};
