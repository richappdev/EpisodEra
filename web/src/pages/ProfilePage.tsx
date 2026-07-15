import {Link} from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Clapperboard,
  Clock,
  Film,
  Flame,
  ListChecks,
  Loader2,
  PlayCircle,
  Tv,
} from "lucide-react";
import {SectionError} from "../components/SectionError";
import {YearRecapCard} from "../components/YearRecapCard";
import {formatWatchTime} from "../lib/seasonProgress";
import {paths} from "../routes/paths";
import {HistoryEntry} from "../types/history";
import {UserProfile} from "../types/profile";
import {UserStats, YearRecap} from "../types/stats";

interface ProfilePageProps {
  history: HistoryEntry[];
  historyError: string | null;
  historyHasMore: boolean;
  historyLoading: boolean;
  historyLoadingMore: boolean;
  historyTotalCount: number;
  profile: UserProfile | null;
  recap: YearRecap | null;
  recapError: string | null;
  recapLoading: boolean;
  signedIn: boolean;
  stats: UserStats | null;
  statsError: string | null;
  statsLoading: boolean;
  userEmail: string | null;
  onLoadMoreHistory: () => void;
  onRecapYearChange: (year: number) => void;
  onRetryHistory: () => void;
  onRetryRecap: () => void;
  onRetryStats: () => void;
}

const formatWatchedAt = (value: string | null) => {
  if (!value) {
    return "Recently";
  }

  return new Intl.DateTimeFormat(undefined, {dateStyle: "medium"}).format(new Date(value));
};

const monthLabel = (value: string | null) => {
  if (!value) {
    return "—";
  }

  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {month: "long", year: "numeric", timeZone: "UTC"}).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
};

export const ProfilePage = ({
  history,
  historyError,
  historyHasMore,
  historyLoading,
  historyLoadingMore,
  historyTotalCount,
  profile,
  recap,
  recapError,
  recapLoading,
  signedIn,
  stats,
  statsError,
  statsLoading,
  userEmail,
  onLoadMoreHistory,
  onRecapYearChange,
  onRetryHistory,
  onRetryRecap,
  onRetryStats,
}: ProfilePageProps) => {
  if (!signedIn) {
    return (
      <main className="page-shell">
        <div className="state-panel">Sign in to view your stats.</div>
      </main>
    );
  }

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  const heading = fullName || userEmail || "Your stats";
  const profileEmail = profile?.email ?? userEmail;

  return (
    <main className="page-shell">
      <section className="profile-header">
        <div>
          <span className="media-kind">Profile</span>
          <h2>{heading}</h2>
          {profileEmail && <p>{profileEmail}</p>}
        </div>
        <BarChart3 size={28} aria-hidden="true" />
      </section>

      {statsLoading && (
        <div className="state-panel inline-state">
          <Loader2 size={18} aria-hidden="true" />
          Loading stats...
        </div>
      )}
      {statsError && !statsLoading && <SectionError message={statsError} onRetry={onRetryStats} />}

      {!statsLoading && !statsError && stats && (
        <>
          <section className="stats-grid" aria-label="Viewing stats">
            <article className="stat-card">
              <Clapperboard size={22} aria-hidden="true" />
              <span>Watched movies</span>
              <strong data-testid="stat-watched-movies">{stats.totalWatchedMovies}</strong>
            </article>
            <article className="stat-card">
              <ListChecks size={22} aria-hidden="true" />
              <span>Watched episodes</span>
              <strong data-testid="stat-watched-episodes">{stats.totalWatchedEpisodes}</strong>
            </article>
            <article className="stat-card">
              <Clock size={22} aria-hidden="true" />
              <span>Watch time</span>
              <strong data-testid="stat-watch-time">{formatWatchTime(stats.totalWatchTimeMinutes)}</strong>
            </article>
            <article className="stat-card">
              <Flame size={22} aria-hidden="true" />
              <span>Longest streak</span>
              <strong data-testid="stat-longest-streak">{stats.longestStreakDays}</strong>
            </article>
            <article className="stat-card">
              <PlayCircle size={22} aria-hidden="true" />
              <span>Currently watching</span>
              <strong data-testid="stat-currently-watching">{stats.currentlyWatchingCount}</strong>
            </article>
            <article className="stat-card">
              <CheckCircle2 size={22} aria-hidden="true" />
              <span>Completed shows</span>
              <strong data-testid="stat-completed-shows">{stats.completedShowsCount}</strong>
            </article>
          </section>

          <section className="profile-summary">
            <div>
              <span className="media-kind">Library</span>
              <strong data-testid="stat-watchlist-count">{stats.watchlistCount}</strong>
              <span>saved titles</span>
            </div>
            <div>
              <span className="media-kind">Progress</span>
              <strong data-testid="stat-progress-show-count">{stats.progressShowCount}</strong>
              <span>tracked shows</span>
            </div>
            <div>
              <span className="media-kind">Current streak</span>
              <strong data-testid="stat-current-streak">{stats.currentStreakDays}</strong>
              <span>days</span>
            </div>
            <div>
              <span className="media-kind">Most active</span>
              <strong data-testid="stat-most-active-month">{monthLabel(stats.mostActiveMonth)}</strong>
              <span>month</span>
            </div>
          </section>

          <section className="stats-breakdown" data-testid="stats-breakdown">
            <div>
              <h3>Top shows</h3>
              {stats.topShows.length === 0 ? (
                <p className="muted-copy">Watch episodes to build this list.</p>
              ) : (
                <ol data-testid="top-shows-list">
                  {stats.topShows.map((item) => (
                    <li key={`show-${item.tmdbId}`}>
                      <span>{item.title}</span>
                      <strong>{item.count}</strong>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div>
              <h3>Top movies</h3>
              {stats.topMovies.length === 0 ? (
                <p className="muted-copy">Mark movies watched to rank them.</p>
              ) : (
                <ol data-testid="top-movies-list">
                  {stats.topMovies.map((item) => (
                    <li key={`movie-${item.tmdbId}`}>
                      <span>{item.title}</span>
                      <strong>{item.count}</strong>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div>
              <h3>Top genres</h3>
              {stats.topGenres.length === 0 ? (
                <p className="muted-copy">Genre insights appear as you watch titles with metadata.</p>
              ) : (
                <ol data-testid="top-genres-list">
                  {stats.topGenres.map((item) => (
                    <li key={`genre-${item.name}`}>
                      <span>{item.name}</span>
                      <strong>{item.count}</strong>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </>
      )}

      {recapLoading && (
        <div className="state-panel inline-state">
          <Loader2 size={18} aria-hidden="true" />
          Loading year recap...
        </div>
      )}
      {recapError && !recapLoading && <SectionError message={recapError} onRetry={onRetryRecap} />}
      {!recapLoading && !recapError && recap && (
        <YearRecapCard recap={recap} onYearChange={onRecapYearChange} />
      )}

      <section className="history-panel">
        <div className="section-header">
          <div>
            <h2>Recent history</h2>
            <Link className="text-button timeline-link" data-testid="profile-open-timeline" to={paths.timeline}>
              Open timeline
            </Link>
          </div>
          <span>{historyTotalCount || history.length} items</span>
        </div>

        {historyLoading && (
          <div className="state-panel inline-state">
            <Loader2 size={18} aria-hidden="true" />
            Loading history...
          </div>
        )}
        {historyError && !historyLoading && <SectionError message={historyError} onRetry={onRetryHistory} />}

        {!historyLoading && !historyError && history.length === 0 && (
          <div className="state-panel">Watched movies and episodes will appear here.</div>
        )}

        {!historyLoading && !historyError && history.length > 0 && (
          <div className="history-list">
            {history.map((entry) => (
              <article className="history-row" data-testid={`history-row-${entry.historyId}`} key={entry.historyId}>
                {entry.mediaType === "movie" ? <Film size={18} aria-hidden="true" /> : <Tv size={18} aria-hidden="true" />}
                <div>
                  <strong>{entry.title}</strong>
                  <span>
                    {entry.mediaType === "movie"
                      ? "Movie watched"
                      : `S${entry.seasonNumber} E${entry.episodeNumber} · ${entry.episodeTitle ?? "Episode watched"}`}
                  </span>
                </div>
                <time dateTime={entry.watchedAt ?? undefined}>{formatWatchedAt(entry.watchedAt)}</time>
              </article>
            ))}
          </div>
        )}

        {historyHasMore && !historyLoading && !historyError && (
          <div className="section-actions">
            <button className="text-button" disabled={historyLoadingMore} type="button" onClick={onLoadMoreHistory}>
              {historyLoadingMore ? "Loading more..." : "Load more history"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
};
