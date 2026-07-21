import {Eye, Film, Loader2, Trash2} from "lucide-react";
import {Link} from "react-router-dom";
import {
  ContinuationEntry,
  continueProgressCaptionFor,
  nextEpisodeDetailLineFor,
} from "../lib/continuation";
import {DEFAULT_EPISODE_RUNTIME_MINUTES} from "../lib/seasonProgress";
import {paths} from "../routes/paths";

interface ContinueWatchingSectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  testIdPrefix?: string;
  variant?: "grid" | "featured";
  seeAllHref?: string;
  entries: ContinuationEntry[];
  pendingShowIds?: ReadonlySet<number>;
  onSelect: (entry: ContinuationEntry) => void;
  onNextEpisodeWatched: (entry: ContinuationEntry) => void;
  onRemove?: (entry: ContinuationEntry) => void;
}

const FEATURED_LIMIT = 8;

interface ContinueCardProps {
  entry: ContinuationEntry;
  testIdPrefix: string;
  pending: boolean;
  onSelect: (entry: ContinuationEntry) => void;
  onNextEpisodeWatched: (entry: ContinuationEntry) => void;
  onRemove?: (entry: ContinuationEntry) => void;
}

const ContinueCard = ({
  entry,
  testIdPrefix,
  pending,
  onSelect,
  onNextEpisodeWatched,
  onRemove,
}: ContinueCardProps) => {
  const {progress} = entry;
  const episodeLine = nextEpisodeDetailLineFor(progress);
  const progressCaption = continueProgressCaptionFor(progress, DEFAULT_EPISODE_RUNTIME_MINUTES);
  const canRemove = Boolean(onRemove && entry.watchlistItem);

  return (
    <article
      className="continue-card"
      data-testid={`${testIdPrefix}-card-${entry.tmdbId}`}
      role="listitem"
    >
      <button
        className="watchlist-poster continue-poster"
        type="button"
        aria-label={`Open ${entry.title}`}
        onClick={() => onSelect(entry)}
      >
        {entry.poster ? (
          <img src={entry.poster} alt="" loading="lazy" />
        ) : (
          <Film size={28} aria-hidden="true" />
        )}
      </button>

      <div className="continue-copy">
        <div className="continue-copy-top">
          <strong>{entry.title}</strong>
          <span
            className="continue-episode-line"
            data-testid={`${testIdPrefix}-next-${entry.tmdbId}`}
            title={episodeLine}
          >
            {episodeLine}
          </span>
        </div>

        <div className="continue-progress">
          <div
            className="progress-bar continue-progress-bar"
            aria-label={`${entry.title} progress ${progress.progressPercent}%`}
          >
            <span style={{width: `${Math.min(progress.progressPercent, 100)}%`}} />
          </div>
          <span className="continue-progress-caption">{progressCaption}</span>
        </div>

        <div className="continue-actions">
          <button
            className="continue-button continue-button--icon"
            data-testid={`${testIdPrefix}-watched-${entry.tmdbId}`}
            type="button"
            disabled={pending || !progress.nextEpisode}
            aria-busy={pending}
            aria-label={pending ? "Saving..." : "Mark watched"}
            title={pending ? "Saving..." : "Mark watched"}
            onClick={() => onNextEpisodeWatched(entry)}
          >
            {pending ? (
              <Loader2 size={18} aria-hidden="true" className="spin" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>

          {canRemove ? (
            <button
              className="continue-button continue-button--icon"
              data-testid={`${testIdPrefix}-remove-${entry.tmdbId}`}
              type="button"
              aria-label={`Remove ${entry.title} from Continue watching`}
              title="Remove from Continue watching"
              onClick={() => onRemove?.(entry)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
};

export const ContinueWatchingSection = ({
  id,
  title,
  subtitle,
  testIdPrefix = "continue",
  variant = "grid",
  seeAllHref = paths.watchlist + "#continue-watching",
  entries,
  pendingShowIds,
  onSelect,
  onNextEpisodeWatched,
  onRemove,
}: ContinueWatchingSectionProps) => {
  if (entries.length === 0) {
    return null;
  }

  const visibleEntries = variant === "featured" ? entries.slice(0, FEATURED_LIMIT) : entries;
  const showSeeAll = variant === "featured" || entries.length > visibleEntries.length;

  return (
    <section
      className={`continue-panel${variant === "featured" ? " continue-panel--featured" : ""}`}
      id={id}
      data-testid={`${testIdPrefix}-panel`}
    >
      <div className="section-header continue-header">
        <div>
          <span className="media-kind">Up next</span>
          <h2>{title}</h2>
        </div>
        {showSeeAll ? (
          <Link className="text-button" data-testid={`${testIdPrefix}-see-all`} to={seeAllHref}>
            See all
          </Link>
        ) : (
          <span>{subtitle ?? `${entries.length} active`}</span>
        )}
      </div>

      <div
        className={variant === "featured" ? "continue-rail" : "continue-stack"}
        role="list"
      >
        {visibleEntries.map((entry) => (
          <ContinueCard
            key={entry.key}
            entry={entry}
            testIdPrefix={testIdPrefix}
            pending={pendingShowIds?.has(entry.tmdbId) ?? false}
            onSelect={onSelect}
            onNextEpisodeWatched={onNextEpisodeWatched}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
};
