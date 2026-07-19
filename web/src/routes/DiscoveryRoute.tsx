import {useNavigate, useSearchParams} from "react-router-dom";
import {useAppContext} from "../AppContext";
import {DiscoveryPage} from "../pages/DiscoveryPage";
import {navFromPath, paths, type NavView} from "./paths";

interface DiscoveryRouteProps {
  view: "trending" | "search";
}

export const DiscoveryRoute = ({view}: DiscoveryRouteProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {language, openMediaDetail, preferredProviderIds, watchRegion} = useAppContext();
  const initialSearchQuery = view === "search" ? searchParams.get("q") : null;
  const nav: NavView = navFromPath(view === "search" ? paths.search : paths.home);

  return (
    <DiscoveryPage
      initialSearchQuery={initialSearchQuery}
      language={language}
      preferredProviderIds={preferredProviderIds}
      view={view}
      watchRegion={watchRegion}
      onSearchQueryChange={(query) => navigate(paths.searchQuery(query), {replace: true})}
      onSelect={(item) => openMediaDetail(item, nav)}
    />
  );
};
