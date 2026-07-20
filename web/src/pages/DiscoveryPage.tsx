import {FormEvent, useCallback, useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {Brain, Clock3, Heart, Search, Sparkles, Zap} from "lucide-react";
import type {ReactNode} from "react";
import {api} from "../api/client";
import {ContinueWatchingSection} from "../components/ContinueWatchingSection";
import {SectionError} from "../components/SectionError";
import {MediaSection} from "../components/MediaSection";
import {ContinuationEntry} from "../lib/continuation";
import {paths} from "../routes/paths";
import {discoveryMoodShortLabels, discoveryMoods} from "../lib/discoveryMoods";
import {DiscoveryMood, DiscoverySuggestionsResponse} from "../types/discovery";
import {DiscoveryResponse, MediaSummary, MediaType, PagedResult} from "../types/media";
import {SupportedLanguage, uiCopy} from "../types/settings";

interface DiscoveryPageProps {
  view: "trending" | "search";
  language: SupportedLanguage;
  initialSearchQuery?: string | null;
  preferredProviderIds?: number[];
  watchRegion?: string;
  continueWatching?: ContinuationEntry[];
  pendingShowIds?: ReadonlySet<number>;
  onSearchQueryChange?: (query: string) => void;
  onSelect: (item: MediaSummary) => void;
  onSelectContinuation?: (entry: ContinuationEntry) => void;
  onNextEpisodeWatched?: (entry: ContinuationEntry) => void;
}

type TrendingTab = Extract<MediaType, "movie" | "tv">;

const moodIcons: Record<DiscoveryMood, ReactNode> = {
  relaxing: <Sparkles size={18} aria-hidden="true" />,
  "mind-bending": <Brain size={18} aria-hidden="true" />,
  emotional: <Heart size={18} aria-hidden="true" />,
  epic: <Zap size={18} aria-hidden="true" />,
  "quick-watch": <Clock3 size={18} aria-hidden="true" />,
};

const hasMorePages = (result: PagedResult<MediaSummary> | null) =>
  Boolean(result && result.page < result.totalPages);

export const DiscoveryPage = ({
  view,
  language,
  initialSearchQuery = null,
  preferredProviderIds = [],
  watchRegion = "US",
  continueWatching = [],
  pendingShowIds,
  onSearchQueryChange,
  onSelect,
  onSelectContinuation,
  onNextEpisodeWatched,
}: DiscoveryPageProps) => {
  const copy = uiCopy[language].search;
  const [query, setQuery] = useState("");
  const [searchData, setSearchData] = useState<DiscoveryResponse | null>(null);
  const [searchPage, setSearchPage] = useState(1);
  const [trendingData, setTrendingData] = useState<PagedResult<MediaSummary> | null>(null);
  const [trendingPage, setTrendingPage] = useState(1);
  const [trendingTab, setTrendingTab] = useState<TrendingTab>("tv");
  const [mood, setMood] = useState<DiscoveryMood | null>(null);
  const [suggestions, setSuggestions] = useState<DiscoverySuggestionsResponse | null>(null);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadTrending = useCallback(
    async (page: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const request =
          trendingTab === "tv" ? api.trendingShows(language, {page}) : api.trendingMovies(language, {page});
        const nextPage = await request;
        setTrendingData((current) =>
          append && current
            ? {...nextPage, results: [...current.results, ...nextPage.results]}
            : nextPage,
        );
        setTrendingPage(nextPage.page);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load trending titles.");
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [language, trendingTab],
  );

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      setSuggestions(
        await api.discoverSuggestions(language, {
          mood: mood ?? undefined,
          maxMinutes: mood === "quick-watch" ? 30 : undefined,
          providers: preferredProviderIds,
          region: watchRegion,
        }),
      );
    } catch (err) {
      setSuggestionsError(err instanceof Error ? err.message : "Could not load suggestions.");
    } finally {
      setSuggestionsLoading(false);
    }
  }, [language, mood, preferredProviderIds, watchRegion]);

  const loadSearch = useCallback(
    async (searchQuery: string, page: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const nextPage = await api.search(searchQuery, language, {page});
        setSearchData((current) => {
          if (!append || !current) {
            return nextPage;
          }

          return {
            movies: {
              ...nextPage.movies,
              results: [...current.movies.results, ...nextPage.movies.results],
            },
            tv: {
              ...nextPage.tv,
              results: [...current.tv.results, ...nextPage.tv.results],
            },
          };
        });
        setSearchPage(nextPage.movies.page);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed.");
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [language],
  );

  useEffect(() => {
    if (view !== "trending") {
      setTrendingData(null);
      return;
    }

    void loadTrending(1, false);
  }, [loadTrending, view]);

  useEffect(() => {
    if (view !== "trending") {
      return;
    }

    void loadSuggestions();
  }, [loadSuggestions, view]);

  useEffect(() => {
    if (view !== "search") {
      return;
    }

    const nextQuery = initialSearchQuery?.trim() ?? "";
    setQuery(nextQuery);
    if (!nextQuery) {
      setSearchData(null);
      setError(null);
      setLoading(false);
      return;
    }

    void loadSearch(nextQuery, 1, false);
  }, [initialSearchQuery, loadSearch, view]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) {
      return;
    }

    setSearchData(null);
    onSearchQueryChange?.(nextQuery);
    void loadSearch(nextQuery, 1, false);
  };

  const retry = () => {
    if (view === "trending") {
      void loadTrending(trendingPage, false);
      void loadSuggestions();
      return;
    }

    const nextQuery = (initialSearchQuery ?? query).trim();
    if (nextQuery) {
      void loadSearch(nextQuery, searchPage, false);
    }
  };

  const loadMore = () => {
    if (view === "trending") {
      void loadTrending(trendingPage + 1, true);
      return;
    }

    const nextQuery = (initialSearchQuery ?? query).trim();
    if (nextQuery) {
      void loadSearch(nextQuery, searchPage + 1, true);
    }
  };

  const trendingHasMore = hasMorePages(trendingData);
  const searchHasMore = Boolean(
    searchData && (searchData.movies.page < searchData.movies.totalPages || searchData.tv.page < searchData.tv.totalPages),
  );

  const moodDefinitions = suggestions?.moods?.length ? suggestions.moods : discoveryMoods;
  const suggestionRails = suggestions?.rails ?? [];
  const firstRail = suggestionRails[0];
  const remainingRails = suggestionRails.slice(1);

  return (
    <main className={`page-shell${view === "trending" ? " home-page" : ""}`}>
      {view === "search" && (
        <form className="search-form" onSubmit={submitSearch}>
          <Search size={20} aria-hidden="true" />
          <input
            data-testid="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search movies and TV"
            aria-label="Search movies and TV"
          />
          <button data-testid="search-submit" type="submit">
            Search
          </button>
        </form>
      )}

      {view === "trending" && (
        <div className="home-discovery">
          {onSelectContinuation &&
            onNextEpisodeWatched &&
            continueWatching.length > 0 && (
              <section className="home-hero" aria-label="Continue watching">
                <ContinueWatchingSection
                  id="continue-watching"
                  title="Continue watching"
                  variant="featured"
                  entries={continueWatching}
                  pendingShowIds={pendingShowIds}
                  onSelect={onSelectContinuation}
                  onNextEpisodeWatched={onNextEpisodeWatched}
                />
              </section>
            )}

          <section className="discovery-smart" data-testid="discovery-smart">
            <div className="section-header">
              <div>
                <span className="media-kind">Discover by mood</span>
                <h2>Match a mood or time budget</h2>
              </div>
              <Link className="text-button" data-testid="home-franchises-link" to={paths.franchises}>
                Browse franchises
              </Link>
            </div>
            <div className="mood-chip-row" role="group" aria-label="Discovery moods">
              {moodDefinitions.map((definition) => (
                <button
                  className={mood === definition.id ? "active" : ""}
                  data-testid={`mood-${definition.id}`}
                  key={definition.id}
                  type="button"
                  aria-label={definition.label}
                  onClick={() => setMood((current) => (current === definition.id ? null : definition.id))}
                >
                  {moodIcons[definition.id]}
                  <span>{discoveryMoodShortLabels[definition.id] ?? definition.label}</span>
                </button>
              ))}
            </div>
            {suggestionsLoading && <div className="state-panel inline-state">Loading suggestions...</div>}
            {suggestionsError && !suggestionsLoading && (
              <SectionError message={suggestionsError} onRetry={() => void loadSuggestions()} />
            )}
            {!suggestionsLoading && !suggestionsError && firstRail && (
              <MediaSection
                key={firstRail.id}
                title={firstRail.title}
                items={firstRail.items}
                layout="rail"
                listId={firstRail.id}
                onSelect={onSelect}
              />
            )}
          </section>

          {!suggestionsLoading &&
            !suggestionsError &&
            remainingRails.map((rail) => (
              <MediaSection
                key={rail.id}
                title={rail.title}
                items={rail.items}
                layout="rail"
                listId={rail.id}
                onSelect={onSelect}
              />
            ))}

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

          {loading && <div className="state-panel">Loading...</div>}
          {error && !loading && <SectionError message={error} onRetry={retry} />}

          {trendingData && !loading && (
            <MediaSection
              title={trendingTab === "tv" ? "Trending TV Shows" : "Trending Movies"}
              items={trendingData.results}
              onSelect={onSelect}
            />
          )}

          {trendingHasMore && !loading && !error && (
            <div className="section-actions">
              <button className="text-button" disabled={loadingMore} type="button" onClick={loadMore}>
                {loadingMore ? "Loading more..." : "Load more results"}
              </button>
            </div>
          )}
        </div>
      )}

      {view === "search" && (
        <>
          {loading && <div className="state-panel">Loading...</div>}
          {error && !loading && <SectionError message={error} onRetry={retry} />}

          {searchData && !loading && (
            <>
              <MediaSection title="Movies" items={searchData.movies.results} onSelect={onSelect} />
              <MediaSection title="TV Shows" items={searchData.tv.results} onSelect={onSelect} />
              {searchData.movies.results.length === 0 && searchData.tv.results.length === 0 && (
                <div className="state-panel">{copy.noResults}</div>
              )}
            </>
          )}

          {!searchData && !loading && !error && (
            <div className="state-panel">Enter a title to search.</div>
          )}

          {searchHasMore && !loading && !error && (
            <div className="section-actions">
              <button className="text-button" disabled={loadingMore} type="button" onClick={loadMore}>
                {loadingMore ? "Loading more..." : "Load more results"}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
};
