import {FormEvent, useEffect, useState} from "react";
import {Search} from "lucide-react";
import {api} from "../api/client";
import {MediaSection} from "../components/MediaSection";
import {DiscoveryResponse, MediaSummary, MediaType, PagedResult} from "../types/media";
import {SupportedLanguage, uiCopy} from "../types/settings";

interface DiscoveryPageProps {
  view: "trending" | "search";
  language: SupportedLanguage;
  onSelect: (item: MediaSummary) => void;
}

type TrendingTab = Extract<MediaType, "movie" | "tv">;

export const DiscoveryPage = ({view, language, onSelect}: DiscoveryPageProps) => {
  const copy = uiCopy[language].search;
  const [query, setQuery] = useState("");
  const [searchData, setSearchData] = useState<DiscoveryResponse | null>(null);
  const [trendingData, setTrendingData] = useState<PagedResult<MediaSummary> | null>(null);
  const [trendingTab, setTrendingTab] = useState<TrendingTab>("tv");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (view !== "trending") {
      setTrendingData(null);
      return;
    }

    setLoading(true);
    setError(null);
    const request = trendingTab === "tv" ? api.trendingShows(language) : api.trendingMovies(language);
    request
      .then(setTrendingData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [language, trendingTab, view]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) {
      return;
    }

    setLoading(true);
    setError(null);
    setSearchData(null);
    api.search(nextQuery, language)
      .then(setSearchData)
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

      {view === "trending" && (
        <div className="tab-bar" role="tablist" aria-label="Trending media type">
          <button
            className={trendingTab === "tv" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={trendingTab === "tv"}
            onClick={() => setTrendingTab("tv")}
          >
            TV Shows
          </button>
          <button
            className={trendingTab === "movie" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={trendingTab === "movie"}
            onClick={() => setTrendingTab("movie")}
          >
            Movies
          </button>
        </div>
      )}

      {loading && <div className="state-panel">Loading...</div>}
      {error && <div className="state-panel error">{error}</div>}

      {view === "trending" && trendingData && !loading && (
        <MediaSection
          title={trendingTab === "tv" ? "Trending TV Shows" : "Trending Movies"}
          items={trendingData.results}
          onSelect={onSelect}
        />
      )}

      {view === "search" && searchData && !loading && (
        <>
          <MediaSection title="Movies" items={searchData.movies.results} onSelect={onSelect} />
          <MediaSection title="TV Shows" items={searchData.tv.results} onSelect={onSelect} />
          {searchData.movies.results.length === 0 && searchData.tv.results.length === 0 && (
            <div className="state-panel">{copy.noResults}</div>
          )}
        </>
      )}

      {!searchData && !loading && !error && view === "search" && (
        <div className="state-panel">Enter a title to search.</div>
      )}
    </main>
  );
};
