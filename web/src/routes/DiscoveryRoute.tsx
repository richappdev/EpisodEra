import {useNavigate, useSearchParams} from "react-router-dom";
import {useAuth} from "../auth/AuthContext";
import {useAppContext} from "../AppContext";
import {DiscoveryPage} from "../pages/DiscoveryPage";
import {navFromPath, paths, type NavView} from "./paths";

interface DiscoveryRouteProps {
  view: "trending" | "search";
}

export const DiscoveryRoute = ({view}: DiscoveryRouteProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {user} = useAuth();
  const {
    language,
    markContinuationEpisodeWatched,
    openContinuationDetail,
    openMediaDetail,
    pendingShowIds,
    preferredProviderIds,
    progressItems,
    watchlistItems,
    watchRegion,
  } = useAppContext();
  const initialSearchQuery = view === "search" ? searchParams.get("q") : null;
  const nav: NavView = navFromPath(view === "search" ? paths.search : paths.home);

  return (
    <DiscoveryPage
      initialSearchQuery={initialSearchQuery}
      language={language}
      pendingShowIds={pendingShowIds}
      preferredProviderIds={preferredProviderIds}
      progressItems={progressItems}
      signedIn={Boolean(user)}
      view={view}
      watchlistItems={watchlistItems}
      watchRegion={watchRegion}
      onSearchQueryChange={(query) => navigate(paths.searchQuery(query), {replace: true})}
      onSelect={(item) => openMediaDetail(item, nav)}
      onSelectContinuation={(entry) => openContinuationDetail(entry, nav)}
      onNextEpisodeWatched={(entry) => {
        void markContinuationEpisodeWatched(entry);
      }}
    />
  );
};
