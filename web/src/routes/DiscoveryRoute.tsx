import {useNavigate, useSearchParams} from "react-router-dom";
import {useMemo} from "react";
import {useAppContext} from "../AppContext";
import {buildContinuationGroups} from "../lib/continuation";
import {DiscoveryPage} from "../pages/DiscoveryPage";
import {navFromPath, paths, type NavView} from "./paths";

interface DiscoveryRouteProps {
  view: "trending" | "search";
}

export const DiscoveryRoute = ({view}: DiscoveryRouteProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    language,
    markContinuationEpisodeWatched,
    openContinuationDetail,
    openMediaDetail,
    pendingShowIds,
    preferredProviderIds,
    progressItems,
    updateWatchlistStatus,
    watchlistItems,
    watchRegion,
  } = useAppContext();
  const initialSearchQuery = view === "search" ? searchParams.get("q") : null;
  const nav: NavView = navFromPath(view === "search" ? paths.search : paths.home);

  const continueWatching = useMemo(
    () => buildContinuationGroups(watchlistItems, progressItems).continueWatching,
    [progressItems, watchlistItems],
  );

  return (
    <DiscoveryPage
      continueWatching={view === "trending" ? continueWatching : []}
      initialSearchQuery={initialSearchQuery}
      language={language}
      pendingShowIds={pendingShowIds}
      preferredProviderIds={preferredProviderIds}
      view={view}
      watchRegion={watchRegion}
      onNextEpisodeWatched={(entry) => {
        void markContinuationEpisodeWatched(entry);
      }}
      onSearchQueryChange={(query) => navigate(paths.searchQuery(query), {replace: true})}
      onSelect={(item) => openMediaDetail(item, nav)}
      onSelectContinuation={(entry) => openContinuationDetail(entry, "trending")}
      onRemoveContinuation={(entry) => {
        if (entry.watchlistItem) {
          updateWatchlistStatus(entry.watchlistItem, "dropped");
        }
      }}
    />
  );
};
