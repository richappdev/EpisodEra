import {BarChart3, CheckCircle2, Clapperboard, Film, ListChecks, Loader2, PlayCircle, Tv} from "lucide-react";
import {HistoryEntry} from "../types/history";
import {UserStats} from "../types/stats";

interface ProfilePageProps {
  error: string | null;
  history: HistoryEntry[];
  loading: boolean;
  signedIn: boolean;
  stats: UserStats | null;
  userEmail: string | null;
}

const formatWatchedAt = (value: string | null) => {
  if (!value) {
    return "Recently";
  }

  return new Intl.DateTimeFormat(undefined, {dateStyle: "medium"}).format(new Date(value));
};

export const ProfilePage = ({error, history, loading, signedIn, stats, userEmail}: ProfilePageProps) => {
  if (!signedIn) {
    return (
      <main className="page-shell">
        <div className="state-panel">Sign in to view your stats.</div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="profile-header">
        <div>
          <span className="media-kind">Profile</span>
          <h2>{userEmail ?? "Your stats"}</h2>
        </div>
        <BarChart3 size={28} aria-hidden="true" />
      </section>

      {loading && (
        <div className="state-panel inline-state">
          <Loader2 size={18} aria-hidden="true" />
          Loading stats...
        </div>
      )}
      {error && <div className="state-panel error">{error}</div>}
      {!loading && !error && stats && (
        <>
          <section className="stats-grid" aria-label="Viewing stats">
            <article className="stat-card">
              <Clapperboard size={22} aria-hidden="true" />
              <span>Watched movies</span>
              <strong>{stats.totalWatchedMovies}</strong>
            </article>
            <article className="stat-card">
              <ListChecks size={22} aria-hidden="true" />
              <span>Watched episodes</span>
              <strong>{stats.totalWatchedEpisodes}</strong>
            </article>
            <article className="stat-card">
              <PlayCircle size={22} aria-hidden="true" />
              <span>Currently watching</span>
              <strong>{stats.currentlyWatchingCount}</strong>
            </article>
            <article className="stat-card">
              <CheckCircle2 size={22} aria-hidden="true" />
              <span>Completed shows</span>
              <strong>{stats.completedShowsCount}</strong>
            </article>
          </section>

          <section className="profile-summary">
            <div>
              <span className="media-kind">Library</span>
              <strong>{stats.watchlistCount}</strong>
              <span>saved titles</span>
            </div>
            <div>
              <span className="media-kind">Progress</span>
              <strong>{stats.progressShowCount}</strong>
              <span>tracked shows</span>
            </div>
          </section>

          <section className="history-panel">
            <div className="section-header">
              <h2>Recent history</h2>
              <span>{history.length} items</span>
            </div>
            {history.length === 0 ? (
              <div className="state-panel">Watched movies and episodes will appear here.</div>
            ) : (
              <div className="history-list">
                {history.map((entry) => (
                  <article className="history-row" key={entry.historyId}>
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
          </section>
        </>
      )}
    </main>
  );
};
