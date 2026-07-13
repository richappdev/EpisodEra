import {Link, useLocation} from "react-router-dom";
import {useAuth} from "./auth/AuthContext";
import {AppProvider, useAppContext} from "./AppContext";
import {TopBar} from "./components/TopBar";
import {AppRoutes} from "./routes/AppRoutes";
import {isDetailPath, navFromPath, paths, type NavView} from "./routes/paths";
import {legalCopy} from "./types/legal";

const resolveActiveView = (pathname: string, state: unknown): NavView => {
  if (isDetailPath(pathname)) {
    if (typeof state === "object" && state && "nav" in state) {
      const nav = (state as {nav?: NavView}).nav;
      if (nav) {
        return nav;
      }
    }
    return "trending";
  }

  return navFromPath(pathname);
};

const SiteFooter = () => {
  const {language} = useAppContext();
  const footer = legalCopy[language].footer;

  return (
    <footer className="site-footer">
      <p className="site-footer-links">
        <Link to={paths.privacy}>{footer.privacy}</Link>
      </p>
      <p className="tmdb-attribution">
        {footer.tmdbPrefix}{" "}
        <a href="https://www.themoviedb.org/about/logos-attribution" rel="noreferrer" target="_blank">
          {footer.tmdbLinkLabel}
        </a>
        {footer.tmdbSuffix}
      </p>
    </footer>
  );
};

const AppShell = () => {
  const {loading, user} = useAuth();
  const location = useLocation();
  const activeView = resolveActiveView(location.pathname, location.state);

  if (loading) {
    return (
      <>
        <TopBar activeView="trending" />
        <main className="page-shell">
          <div className="state-panel">Loading account...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar activeView={activeView} />
      <AppRoutes />
      <SiteFooter />
    </>
  );
};

export const App = () => (
  <AppProvider>
    <AppShell />
  </AppProvider>
);
