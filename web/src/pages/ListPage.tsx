import {ArrowLeft, Loader2} from "lucide-react";
import {Link} from "react-router-dom";
import {MediaCard} from "../components/MediaCard";
import {SectionError} from "../components/SectionError";
import {paths} from "../routes/paths";
import {MediaSummary} from "../types/media";

interface ListPageProps {
  title: string;
  reason: string | null;
  items: MediaSummary[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onSelect: (item: MediaSummary) => void;
}

export const ListPage = ({
  title,
  reason,
  items,
  loading,
  loadingMore,
  error,
  hasMore,
  onLoadMore,
  onRetry,
  onSelect,
}: ListPageProps) => (
  <main className="page-shell">
    <section className="profile-header">
      <div>
        <Link className="text-button list-back-link" data-testid="list-back" to={paths.home}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Home
        </Link>
        <span className="media-kind">List</span>
        <h2>{title}</h2>
        {reason && <p>{reason}</p>}
      </div>
    </section>

    {loading && (
      <div className="state-panel inline-state">
        <Loader2 size={18} aria-hidden="true" />
        Loading list...
      </div>
    )}
    {error && !loading && <SectionError message={error} onRetry={onRetry} />}

    {!loading && !error && items.length === 0 && <div className="state-panel">No titles in this list.</div>}

    {items.length > 0 && !loading && (
      <section className="media-section" data-testid="list-grid">
        <div className="media-grid">
          {items.map((item) => (
            <MediaCard key={`${item.mediaType}-${item.id}`} item={item} onSelect={onSelect} />
          ))}
        </div>
      </section>
    )}

    {hasMore && !loading && !error && (
      <div className="section-actions">
        <button className="text-button" data-testid="list-load-more" disabled={loadingMore} type="button" onClick={onLoadMore}>
          {loadingMore ? "Loading more..." : "Load more results"}
        </button>
      </div>
    )}
  </main>
);
