import {Film, Heart, Loader2} from "lucide-react";
import {SectionError} from "../components/SectionError";
import {LikedItem} from "../types/likes";

interface LikesPageProps {
  error: string | null;
  items: LikedItem[];
  loading: boolean;
  signedIn: boolean;
  totalCount: number;
  onRemove: (item: LikedItem) => void;
  onRetry: () => void;
  onSelect: (item: LikedItem) => void;
}

export const LikesPage = ({
  error,
  items,
  loading,
  signedIn,
  totalCount,
  onRemove,
  onRetry,
  onSelect,
}: LikesPageProps) => {
  if (!signedIn) {
    return (
      <main className="page-shell">
        <div className="state-panel">Sign in to see titles you liked.</div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="watchlist-header" data-testid="likes-header">
        <div>
          <span className="media-kind">Library</span>
          <h2>Liked</h2>
        </div>
        <span>{totalCount || items.length} liked</span>
      </section>

      {loading && (
        <div className="state-panel inline-state">
          <Loader2 size={18} aria-hidden="true" />
          Loading likes...
        </div>
      )}
      {error && !loading && <SectionError message={error} onRetry={onRetry} />}
      {!loading && !error && items.length === 0 && (
        <div className="state-panel empty-watchlist" data-testid="likes-empty">
          <Heart size={24} aria-hidden="true" />
          You have not liked any titles yet.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="watchlist-grid" data-testid="likes-grid">
          {items.map((item) => (
            <article className="watchlist-item" data-testid={`liked-item-${item.tmdbId}`} key={item.itemId}>
              <button className="watchlist-poster" type="button" onClick={() => onSelect(item)}>
                {item.poster ? <img src={item.poster} alt="" loading="lazy" /> : <Film size={28} aria-hidden="true" />}
              </button>
              <div className="watchlist-copy">
                <button type="button" onClick={() => onSelect(item)}>
                  {item.title}
                </button>
                <span className="media-kind">{item.mediaType === "movie" ? "Movie" : "TV"}</span>
              </div>
              <button
                className="icon-button"
                type="button"
                data-testid={`unlike-${item.tmdbId}`}
                onClick={() => onRemove(item)}
                title={`Unlike ${item.title}`}
                aria-label={`Unlike ${item.title}`}
              >
                <Heart size={18} aria-hidden="true" fill="currentColor" />
              </button>
            </article>
          ))}
        </div>
      )}
    </main>
  );
};
