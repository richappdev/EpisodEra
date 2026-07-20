import {useEffect, useId, useRef, useState} from "react";
import {CheckCircle2, Film, Loader2, MoreHorizontal, Play} from "lucide-react";
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
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onSelect: (entry: ContinuationEntry) => void;
  onNextEpisodeWatched: (entry: ContinuationEntry) => void;
  onRemove?: (entry: ContinuationEntry) => void;
}

const ContinueCard = ({
  entry,
  testIdPrefix,
  pending,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onSelect,
  onNextEpisodeWatched,
  onRemove,
}: ContinueCardProps) => {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const {progress} = entry;
  const episodeLine = nextEpisodeDetailLineFor(progress);
  const progressCaption = continueProgressCaptionFor(progress, DEFAULT_EPISODE_RUNTIME_MINUTES);
  const canRemove = Boolean(onRemove && entry.watchlistItem);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onCloseMenu();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseMenu();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, onCloseMenu]);

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
            className="continue-button continue-button--resume"
            data-testid={`${testIdPrefix}-resume-${entry.tmdbId}`}
            type="button"
            onClick={() => onSelect(entry)}
          >
            <Play size={16} aria-hidden="true" />
            Resume
          </button>
          <button
            className="continue-button continue-button--watched"
            data-testid={`${testIdPrefix}-watched-${entry.tmdbId}`}
            type="button"
            disabled={pending || !progress.nextEpisode}
            aria-busy={pending}
            aria-label={pending ? "Saving..." : "Mark watched"}
            title={pending ? "Saving..." : "Mark watched"}
            onClick={() => onNextEpisodeWatched(entry)}
          >
            {pending ? (
              <Loader2 size={16} aria-hidden="true" className="spin" />
            ) : (
              <CheckCircle2 size={16} aria-hidden="true" />
            )}
            <span className="continue-watched-label">{pending ? "Saving..." : "Watched"}</span>
          </button>

          <div className="continue-menu" ref={menuRef}>
            <button
              className="continue-button continue-button--menu"
              type="button"
              aria-label={`More actions for ${entry.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              data-testid={`${testIdPrefix}-menu-${entry.tmdbId}`}
              onClick={onToggleMenu}
            >
              <MoreHorizontal size={18} aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div className="continue-menu-panel" id={menuId} role="menu">
                {canRemove ? (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid={`${testIdPrefix}-remove-${entry.tmdbId}`}
                    onClick={() => {
                      onCloseMenu();
                      onRemove?.(entry);
                    }}
                  >
                    Remove from Continue watching
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  data-testid={`${testIdPrefix}-restart-${entry.tmdbId}`}
                  onClick={() => {
                    onCloseMenu();
                    onSelect(entry);
                  }}
                >
                  Restart episode
                </button>
                <button
                  type="button"
                  role="menuitem"
                  data-testid={`${testIdPrefix}-details-${entry.tmdbId}`}
                  onClick={() => {
                    onCloseMenu();
                    onSelect(entry);
                  }}
                >
                  Open series details
                </button>
              </div>
            ) : null}
          </div>
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
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

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
            menuOpen={openMenuId === entry.tmdbId}
            onToggleMenu={() =>
              setOpenMenuId((current) => (current === entry.tmdbId ? null : entry.tmdbId))
            }
            onCloseMenu={() => setOpenMenuId(null)}
            onSelect={onSelect}
            onNextEpisodeWatched={onNextEpisodeWatched}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
};
