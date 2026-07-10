import {BarChart3, CheckCircle2, Clapperboard, ListChecks, Loader2, PlayCircle} from "lucide-react";
import {UserStats} from "../types/stats";

interface ProfilePageProps {
  error: string | null;
  loading: boolean;
  signedIn: boolean;
  stats: UserStats | null;
  userEmail: string | null;
}

export const ProfilePage = ({error, loading, signedIn, stats, userEmail}: ProfilePageProps) => {
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
        </>
      )}
    </main>
  );
};
