import {ArrowLeft, Bookmark, Check, Clock, ExternalLink, Star, Trash2} from "lucide-react";
import {MediaDetail} from "../types/media";
import {WatchlistItem, WatchlistStatus, watchlistStatuses} from "../types/watchlist";

const statusLabels: Record<WatchlistStatus, string> = {
  planned: "Planned",
  watching: "Watching",
  completed: "Completed",
  dropped: "Dropped",
};

interface DetailPageProps {
  detail: MediaDetail;
  onAddToWatchlist: (detail: MediaDetail) => void;
  onBack: () => void;
  onRemoveFromWatchlist: (item: WatchlistItem) => void;
  onWatchlistStatusChange: (item: WatchlistItem, status: WatchlistStatus) => void;
  signedIn: boolean;
  watchlistItem: WatchlistItem | null;
}

export const DetailPage = ({
  detail,
  onAddToWatchlist,
  onBack,
  onRemoveFromWatchlist,
  onWatchlistStatusChange,
  signedIn,
  watchlistItem,
}: DetailPageProps) => (
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
  </main>
);
