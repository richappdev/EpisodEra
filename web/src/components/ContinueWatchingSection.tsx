import {CheckCircle2, Film, Loader2, Play} from "lucide-react";
import {Link} from "react-router-dom";
import {ContinuationEntry, nextEpisodeCodeFor, nextEpisodeLabelFor} from "../lib/continuation";
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
}

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
}: ContinueWatchingSectionProps) => {
  if (entries.length === 0) {
    return null;
  }

  const visibleEntries = variant === "featured" ? entries.slice(0, 1) : entries;
  const featuredEntry = variant === "featured" ? visibleEntries[0] : null;

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
        {variant === "featured" ? (
          <Link className="text-button" data-testid={`${testIdPrefix}-see-all`} to={seeAllHref}>
            See all
          </Link>
        ) : (
          <span>{subtitle ?? `${entries.length} active`}</span>
        )}
      </div>

      {variant === "featured" && featuredEntry ? (
        <article
          className="continue-card continue-card--featured"
          data-testid={`${testIdPrefix}-card-${featuredEntry.tmdbId}`}
        >
          <button
            className="watchlist-poster continue-poster"
            type="button"
            aria-label={`Open ${featuredEntry.title}`}
            onClick={() => onSelect(featuredEntry)}
          >
            {featuredEntry.poster ? (
              <img src={featuredEntry.poster} alt="" loading="lazy" />
            ) : (
              <Film size={28} aria-hidden="true" />
            )}
          </button>
          <div className="continue-copy">
            <strong>{featuredEntry.title}</strong>
            {(() => {
              const episodeCode = nextEpisodeCodeFor(featuredEntry.progress);
              const episodeLabel = nextEpisodeLabelFor(featuredEntry.progress);
              return episodeCode ? (
                <span
                  className="continue-episode-code"
                  data-testid={`${testIdPrefix}-next-${featuredEntry.tmdbId}`}
                  title={episodeLabel}
                >
                  {episodeCode}
                </span>
              ) : (
                <span className="continue-episode-code" data-testid={`${testIdPrefix}-next-${featuredEntry.tmdbId}`}>
                  {episodeLabel}
                </span>
              );
            })()}
            <div
              className="progress-bar"
              aria-label={`${featuredEntry.title} progress ${featuredEntry.progress.progressPercent}%`}
            >
              <span style={{width: `${Math.min(featuredEntry.progress.progressPercent, 100)}%`}} />
            </div>
            <div className="continue-featured-actions">
              <button
                className="continue-button continue-button--resume"
                data-testid={`${testIdPrefix}-resume-${featuredEntry.tmdbId}`}
                type="button"
                onClick={() => onSelect(featuredEntry)}
              >
                <Play size={16} aria-hidden="true" />
                Resume
              </button>
              <button
                className="continue-button continue-button--watched"
                data-testid={`${testIdPrefix}-watched-${featuredEntry.tmdbId}`}
                type="button"
                disabled={
                  (pendingShowIds?.has(featuredEntry.tmdbId) ?? false) || !featuredEntry.progress.nextEpisode
                }
                aria-busy={pendingShowIds?.has(featuredEntry.tmdbId) ?? false}
                aria-label={
                  pendingShowIds?.has(featuredEntry.tmdbId) ? "Saving..." : "Watched"
                }
                onClick={() => onNextEpisodeWatched(featuredEntry)}
              >
                {pendingShowIds?.has(featuredEntry.tmdbId) ? (
                  <Loader2 size={16} aria-hidden="true" className="spin" />
                ) : (
                  <CheckCircle2 size={16} aria-hidden="true" />
                )}
                {pendingShowIds?.has(featuredEntry.tmdbId) ? "Saving..." : "Watched"}
              </button>
            </div>
          </div>
        </article>
      ) : (
        <div className="continue-grid" role="list">
          {visibleEntries.map((entry) => {
            const pending = pendingShowIds?.has(entry.tmdbId) ?? false;
            const {progress} = entry;
            const episodeCode = nextEpisodeCodeFor(progress);
            const episodeLabel = nextEpisodeLabelFor(progress);

            return (
              <article
                className="continue-card"
                data-testid={`${testIdPrefix}-card-${entry.tmdbId}`}
                key={entry.key}
                role="listitem"
              >
                <button
                  className="watchlist-poster continue-poster"
                  type="button"
                  aria-label={`Open ${entry.title}`}
                  onClick={() => onSelect(entry)}
                >
                  {entry.poster ? <img src={entry.poster} alt="" loading="lazy" /> : <Film size={28} aria-hidden="true" />}
                </button>
                <div className="continue-copy">
                  <strong>{entry.title}</strong>
                  {episodeCode ? (
                    <span
                      className="continue-episode-code"
                      data-testid={`${testIdPrefix}-next-${entry.tmdbId}`}
                      title={episodeLabel}
                    >
                      {episodeCode}
                    </span>
                  ) : (
                    <span className="continue-episode-code" data-testid={`${testIdPrefix}-next-${entry.tmdbId}`}>
                      {episodeLabel}
                    </span>
                  )}
                  <div className="progress-bar" aria-label={`${entry.title} progress ${progress.progressPercent}%`}>
                    <span style={{width: `${Math.min(progress.progressPercent, 100)}%`}} />
                  </div>
                </div>
                <button
                  className="continue-button"
                  data-testid={`${testIdPrefix}-watched-${entry.tmdbId}`}
                  type="button"
                  disabled={pending || !progress.nextEpisode}
                  aria-busy={pending}
                  aria-label={pending ? "Saving..." : "Watched"}
                  onClick={() => onNextEpisodeWatched(entry)}
                >
                  {pending ? <Loader2 size={16} aria-hidden="true" className="spin" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                  {pending ? "Saving..." : "Watched"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
