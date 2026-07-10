import {FormEvent, useEffect, useState} from "react";
import {Search} from "lucide-react";
import {api} from "../api/client";
import {MediaSection} from "../components/MediaSection";
import {DiscoveryResponse, MediaSummary} from "../types/media";

interface DiscoveryPageProps {
  view: "trending" | "search";
  onSelect: (item: MediaSummary) => void;
}

export const DiscoveryPage = ({view, onSelect}: DiscoveryPageProps) => {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (view !== "trending") {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    api.trending()
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [view]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) {
      return;
    }

    setLoading(true);
    setError(null);
    api.search(nextQuery)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <main className="page-shell">
      {view === "search" && (
        <form className="search-form" onSubmit={submitSearch}>
          <Search size={20} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search movies and TV"
            aria-label="Search movies and TV"
          />
          <button type="submit">Search</button>
        </form>
      )}

      {loading && <div className="state-panel">Loading...</div>}
      {error && <div className="state-panel error">{error}</div>}

      {data && !loading && (
        <>
          <MediaSection title="Movies" items={data.movies.results} onSelect={onSelect} />
          <MediaSection title="TV Shows" items={data.tv.results} onSelect={onSelect} />
        </>
      )}

      {!data && !loading && !error && view === "search" && (
        <div className="state-panel">Enter a title to search.</div>
      )}
    </main>
  );
};
