import {FormEvent, useMemo, useState} from "react";
import {Check, Film, History, Loader2, Pencil, Trash2, Tv} from "lucide-react";
import {SectionError} from "../components/SectionError";
import {
  buildTimeline,
  fromWatchedAtInputValue,
  isRewatchEntry,
  toWatchedAtInputValue,
  type TimelineFilters,
  type TimelineGroupMode,
} from "../lib/timeline";
import {HistoryEntry} from "../types/history";

interface TimelinePageProps {
  error: string | null;
  hasMore: boolean;
  items: HistoryEntry[];
  loading: boolean;
  loadingMore: boolean;
  signedIn: boolean;
  totalCount: number;
  onDeleteEntry: (entry: HistoryEntry) => Promise<void> | void;
  onLoadMore: () => void;
  onRetry: () => void;
  onSelectEntry: (entry: HistoryEntry) => void;
  onUpdateWatchedAt: (entry: HistoryEntry, watchedAt: string) => Promise<void> | void;
}

const formatWatchedAt = (value: string | null) => {
  if (!value) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {dateStyle: "medium", timeStyle: "short"}).format(new Date(value));
};

export const TimelinePage = ({
  error,
  hasMore,
  items,
  loading,
  loadingMore,
  signedIn,
  totalCount,
  onDeleteEntry,
  onLoadMore,
  onRetry,
  onSelectEntry,
  onUpdateWatchedAt,
}: TimelinePageProps) => {
  const [groupMode, setGroupMode] = useState<TimelineGroupMode>("day");
  const [filters, setFilters] = useState<TimelineFilters>({
    mediaType: "all",
    query: "",
    rewatchesOnly: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftWatchedAt, setDraftWatchedAt] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const groups = useMemo(() => buildTimeline(items, filters, groupMode), [filters, groupMode, items]);
  const visibleCount = groups.reduce((sum, group) => sum + group.entries.length, 0);

  if (!signedIn) {
    return (
      <main className="page-shell">
        <div className="state-panel">Sign in to view your personal timeline.</div>
      </main>
    );
  }

  const beginEdit = (entry: HistoryEntry) => {
    setEditingId(entry.historyId);
    setDraftWatchedAt(toWatchedAtInputValue(entry.watchedAt));
  };

  const saveEdit = async (entry: HistoryEntry, event: FormEvent) => {
    event.preventDefault();
    const nextWatchedAt = fromWatchedAtInputValue(draftWatchedAt);
    if (!nextWatchedAt) {
      return;
    }

    setSavingId(entry.historyId);
    try {
      await onUpdateWatchedAt(entry, nextWatchedAt);
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const removeEntry = async (entry: HistoryEntry) => {
    const label =
      entry.mediaType === "movie"
        ? entry.title
        : `${entry.title} S${entry.seasonNumber} E${entry.episodeNumber}`;
    if (!window.confirm(`Remove ${label} from your timeline? This also clears related watch progress.`)) {
      return;
    }

    setSavingId(entry.historyId);
    try {
      await onDeleteEntry(entry);
      if (editingId === entry.historyId) {
        setEditingId(null);
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="page-shell">
      <section className="timeline-header" data-testid="timeline-header">
        <div>
          <span className="media-kind">Memory</span>
          <h2>Timeline</h2>
          <p>Your personal viewing diary, grouped and searchable.</p>
        </div>
        <History size={28} aria-hidden="true" />
      </section>

      <section className="timeline-controls" data-testid="timeline-controls">
        <label>
          <span className="sr-only">Search timeline</span>
          <input
            data-testid="timeline-search"
            type="search"
            value={filters.query}
            placeholder="Search titles or episodes"
            onChange={(event) => setFilters((current) => ({...current, query: event.target.value}))}
          />
        </label>
        <select
          aria-label="Filter by media type"
          data-testid="timeline-media-filter"
          value={filters.mediaType}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              mediaType: event.target.value as TimelineFilters["mediaType"],
            }))
          }
        >
          <option value="all">All titles</option>
          <option value="tv">TV</option>
          <option value="movie">Movies</option>
        </select>
        <select
          aria-label="Group timeline by"
          data-testid="timeline-group-mode"
          value={groupMode}
          onChange={(event) => setGroupMode(event.target.value as TimelineGroupMode)}
        >
          <option value="day">By day</option>
          <option value="month">By month</option>
          <option value="year">By year</option>
        </select>
        <label className="timeline-rewatch-filter">
          <input
            data-testid="timeline-rewatch-filter"
            type="checkbox"
            checked={filters.rewatchesOnly}
            onChange={(event) => setFilters((current) => ({...current, rewatchesOnly: event.target.checked}))}
          />
          Rewatches only
        </label>
      </section>

      <div className="section-header">
        <h3>History</h3>
        <span>
          {visibleCount} shown · {totalCount || items.length} loaded
        </span>
      </div>

      {loading && (
        <div className="state-panel inline-state">
          <Loader2 size={18} aria-hidden="true" />
          Loading timeline...
        </div>
      )}
      {error && !loading && <SectionError message={error} onRetry={onRetry} />}

      {!loading && !error && groups.length === 0 && (
        <div className="state-panel">No timeline entries match these filters.</div>
      )}

      {!loading && !error &&
        groups.map((group) => (
          <section className="timeline-group" data-testid={`timeline-group-${group.key}`} key={group.key}>
            <h3>{group.label}</h3>
            <div className="timeline-list">
              {group.entries.map((entry) => {
                const editing = editingId === entry.historyId;
                const busy = savingId === entry.historyId;

                return (
                  <article
                    className="timeline-row"
                    data-testid={`timeline-row-${entry.historyId}`}
                    key={entry.historyId}
                  >
                    {entry.mediaType === "movie" ? (
                      <Film size={18} aria-hidden="true" />
                    ) : (
                      <Tv size={18} aria-hidden="true" />
                    )}
                    <div className="timeline-copy">
                      <button type="button" onClick={() => onSelectEntry(entry)}>
                        <strong>{entry.title}</strong>
                      </button>
                      <span>
                        {entry.mediaType === "movie"
                          ? "Movie watched"
                          : `S${entry.seasonNumber} E${entry.episodeNumber} · ${entry.episodeTitle ?? "Episode watched"}`}
                      </span>
                      {isRewatchEntry(entry) && (
                        <span className="rewatch-badge" data-testid={`timeline-rewatch-${entry.historyId}`}>
                          Rewatch ×{entry.rewatchCount}
                        </span>
                      )}
                      {editing ? (
                        <form className="timeline-edit-form" onSubmit={(event) => void saveEdit(entry, event)}>
                          <input
                            data-testid={`timeline-edit-input-${entry.historyId}`}
                            type="datetime-local"
                            value={draftWatchedAt}
                            onChange={(event) => setDraftWatchedAt(event.target.value)}
                            required
                          />
                          <button
                            className="icon-button"
                            data-testid={`timeline-edit-save-${entry.historyId}`}
                            disabled={busy}
                            type="submit"
                            aria-label={`Save date for ${entry.title}`}
                          >
                            <Check size={16} aria-hidden="true" />
                          </button>
                        </form>
                      ) : (
                        <time dateTime={entry.watchedAt ?? undefined}>{formatWatchedAt(entry.watchedAt)}</time>
                      )}
                    </div>
                    <div className="timeline-row-actions">
                      <button
                        className="icon-button"
                        data-testid={`timeline-edit-${entry.historyId}`}
                        type="button"
                        disabled={busy}
                        aria-label={`Edit date for ${entry.title}`}
                        onClick={() => beginEdit(entry)}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button"
                        data-testid={`timeline-delete-${entry.historyId}`}
                        type="button"
                        disabled={busy}
                        aria-label={`Remove ${entry.title} from timeline`}
                        onClick={() => void removeEntry(entry)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

      {hasMore && !loading && !error && (
        <div className="section-actions">
          <button className="text-button" disabled={loadingMore} type="button" onClick={onLoadMore}>
            {loadingMore ? "Loading more..." : "Load more history"}
          </button>
        </div>
      )}
    </main>
  );
};
