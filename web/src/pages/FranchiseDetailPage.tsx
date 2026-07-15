import {Link} from "react-router-dom";
import {CheckCircle2, Circle, Loader2, PlayCircle} from "lucide-react";
import {SectionError} from "../components/SectionError";
import {paths} from "../routes/paths";
import {FranchiseOrder, FranchiseProgress} from "../types/franchise";
import {MediaSummary} from "../types/media";

interface FranchiseDetailPageProps {
  error: string | null;
  loading: boolean;
  order: FranchiseOrder;
  progress: FranchiseProgress | null;
  signedIn: boolean;
  onOrderChange: (order: FranchiseOrder) => void;
  onRetry: () => void;
  onSelectTitle: (item: Pick<MediaSummary, "id" | "mediaType" | "title">) => void;
}

const statusIcon = (status: string) => {
  if (status === "watched") {
    return <CheckCircle2 size={16} aria-hidden="true" />;
  }
  if (status === "in_progress") {
    return <PlayCircle size={16} aria-hidden="true" />;
  }
  return <Circle size={16} aria-hidden="true" />;
};

export const FranchiseDetailPage = ({
  error,
  loading,
  order,
  progress,
  signedIn,
  onOrderChange,
  onRetry,
  onSelectTitle,
}: FranchiseDetailPageProps) => (
  <main className="page-shell">
    <div className="section-header">
      <div>
        <Link className="text-button" data-testid="franchise-back" to={paths.franchises}>
          All franchises
        </Link>
        <span className="media-kind">Franchise</span>
        <h2>{progress?.name ?? "Franchise"}</h2>
        {progress && <p>{progress.description}</p>}
      </div>
      <div className="tab-bar" role="tablist" aria-label="Franchise viewing order">
        <button
          className={order === "release" ? "active" : ""}
          data-testid="order-release"
          role="tab"
          type="button"
          aria-selected={order === "release"}
          onClick={() => onOrderChange("release")}
        >
          Release order
        </button>
        <button
          className={order === "chronological" ? "active" : ""}
          data-testid="order-chronological"
          role="tab"
          type="button"
          aria-selected={order === "chronological"}
          onClick={() => onOrderChange("chronological")}
        >
          Chronological
        </button>
      </div>
    </div>

    {loading && (
      <div className="state-panel inline-state">
        <Loader2 size={18} aria-hidden="true" />
        Loading franchise progress...
      </div>
    )}
    {error && !loading && <SectionError message={error} onRetry={onRetry} />}

    {!signedIn && !loading && !error && (
      <div className="state-panel">Sign in to sync franchise completion with your watch history.</div>
    )}

    {!loading && !error && progress && (
      <>
        <section className="stats-grid" aria-label="Franchise completion">
          <article className="stat-card">
            <span>Overall</span>
            <strong data-testid="franchise-progress-percent">{progress.progressPercent}%</strong>
          </article>
          <article className="stat-card">
            <span>Watched</span>
            <strong data-testid="franchise-watched-count">
              {progress.watchedTitles}/{progress.totalTitles}
            </strong>
          </article>
          <article className="stat-card">
            <span>In progress</span>
            <strong>{progress.inProgressTitles}</strong>
          </article>
        </section>

        {progress.recommendedNext && (
          <section className="franchise-next" data-testid="franchise-recommended-next">
            <div>
              <span className="media-kind">Recommended next</span>
              <h3>{progress.recommendedNext.title}</h3>
              <p>
                {progress.recommendedNext.phaseName} ·{" "}
                {progress.recommendedNext.status === "in_progress" ? "Continue" : "Unwatched"}
              </p>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() =>
                onSelectTitle({
                  id: progress.recommendedNext!.tmdbId,
                  mediaType: progress.recommendedNext!.mediaType,
                  title: progress.recommendedNext!.title,
                })
              }
            >
              Open title
            </button>
          </section>
        )}

        <section className="stats-breakdown" data-testid="franchise-phases">
          {progress.phases.map((phase) => (
            <div key={phase.id}>
              <h3>{phase.name}</h3>
              <p className="muted-copy">
                {phase.watchedTitles}/{phase.totalTitles} · {phase.progressPercent}%
              </p>
              <div className="progress-track" aria-hidden="true">
                <div className="progress-fill" style={{width: `${phase.progressPercent}%`}} />
              </div>
            </div>
          ))}
        </section>

        <section className="franchise-title-list" data-testid="franchise-title-list">
          {progress.titles.map((title) => (
            <button
              className="franchise-title-row"
              data-testid={`franchise-title-${title.tmdbId}`}
              key={`${title.mediaType}-${title.tmdbId}`}
              type="button"
              onClick={() =>
                onSelectTitle({
                  id: title.tmdbId,
                  mediaType: title.mediaType,
                  title: title.title,
                })
              }
            >
              {statusIcon(title.status)}
              <div>
                <strong>{title.title}</strong>
                <span>
                  {title.phaseName} · {title.status.replace("_", " ")}
                </span>
              </div>
              <span>{title.progressPercent}%</span>
            </button>
          ))}
        </section>
      </>
    )}
  </main>
);
