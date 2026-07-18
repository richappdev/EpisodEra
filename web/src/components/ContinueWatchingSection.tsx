import {CheckCircle2, Film, Loader2} from "lucide-react";
import {ContinuationEntry, nextEpisodeCodeFor, nextEpisodeLabelFor} from "../lib/continuation";

interface ContinueWatchingSectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  testIdPrefix?: string;
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
  entries,
  pendingShowIds,
  onSelect,
  onNextEpisodeWatched,
}: ContinueWatchingSectionProps) => {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="continue-panel" id={id} data-testid={`${testIdPrefix}-panel`}>
      <div className="section-header continue-header">
        <div>
          <span className="media-kind">Up next</span>
          <h2>{title}</h2>
        </div>
        <span>{subtitle ?? `${entries.length} active`}</span>
      </div>
      <div className="continue-grid" role="list">
        {entries.map((entry) => {
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
    </section>
  );
};
