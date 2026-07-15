import {CheckCircle2, Film, ListChecks, Loader2} from "lucide-react";
import {ContinuationEntry, nextEpisodeLabelFor} from "../lib/continuation";

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
      <div className="section-header">
        <h2>{title}</h2>
        <span>{subtitle ?? `${entries.length} active`}</span>
      </div>
      <div className="continue-grid">
        {entries.map((entry) => {
          const pending = pendingShowIds?.has(entry.tmdbId) ?? false;
          const {progress} = entry;

          return (
            <article
              className="continue-card"
              data-testid={`${testIdPrefix}-card-${entry.tmdbId}`}
              key={entry.key}
            >
              <button className="watchlist-poster" type="button" onClick={() => onSelect(entry)}>
                {entry.poster ? <img src={entry.poster} alt="" loading="lazy" /> : <Film size={28} aria-hidden="true" />}
              </button>
              <div className="continue-copy">
                <strong>{entry.title}</strong>
                <span>
                  <ListChecks size={16} aria-hidden="true" />
                  {progress.watchedEpisodeCount} of {progress.totalEpisodes} watched
                </span>
                {progress.nextEpisode && (
                  <span className="next-episode" data-testid={`${testIdPrefix}-next-${entry.tmdbId}`}>
                    {nextEpisodeLabelFor(progress)}
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
