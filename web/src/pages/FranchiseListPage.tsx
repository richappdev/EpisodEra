import {Link} from "react-router-dom";
import {Clapperboard, Loader2} from "lucide-react";
import {SectionError} from "../components/SectionError";
import {paths} from "../routes/paths";
import {FranchiseSummary} from "../types/franchise";

interface FranchiseListPageProps {
  error: string | null;
  items: FranchiseSummary[];
  loading: boolean;
  onRetry: () => void;
}

export const FranchiseListPage = ({error, items, loading, onRetry}: FranchiseListPageProps) => (
  <main className="page-shell">
    <section className="profile-header">
      <div>
        <span className="media-kind">Franchises</span>
        <h2>Universe progress</h2>
        <p>Track curated franchises in release or chronological order.</p>
      </div>
      <Clapperboard size={28} aria-hidden="true" />
    </section>

    {loading && (
      <div className="state-panel inline-state">
        <Loader2 size={18} aria-hidden="true" />
        Loading franchises...
      </div>
    )}
    {error && !loading && <SectionError message={error} onRetry={onRetry} />}

    {!loading && !error && items.length === 0 && (
      <div className="state-panel">No franchises are available yet.</div>
    )}

    {!loading && !error && items.length > 0 && (
      <section className="franchise-grid" data-testid="franchise-list">
        {items.map((franchise) => (
          <Link
            className="franchise-card"
            data-testid={`franchise-card-${franchise.slug}`}
            key={franchise.slug}
            to={paths.franchise(franchise.slug)}
          >
            <h3>{franchise.name}</h3>
            <p>{franchise.description}</p>
            <span>
              {franchise.titleCount} titles · {franchise.phaseCount} phases
            </span>
          </Link>
        ))}
      </section>
    )}
  </main>
);
