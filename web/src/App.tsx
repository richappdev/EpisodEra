import {useEffect} from "react";
import {Link, useLocation} from "react-router-dom";
import {useAuth} from "./auth/AuthContext";
import {AppProvider, useAppContext} from "./AppContext";
import {TopBar} from "./components/TopBar";
import {AppRoutes} from "./routes/AppRoutes";
import {canvasFromPath, isDetailPath, navFromPath, paths, type NavView} from "./routes/paths";
import {legalCopy} from "./types/legal";
import tmdbLogo from "./assets/tmdb-logo.svg";

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
  const aboutLabel = language === "zh-TW" ? "介紹" : "About";

  return (
    <footer className="site-footer">
      <p className="site-footer-links">
        <Link to={paths.landing}>{aboutLabel}</Link>
        <span aria-hidden="true"> · </span>
        <Link to={paths.privacy}>{footer.privacy}</Link>
      </p>
      <div className="tmdb-attribution">
        <a
          className="tmdb-attribution-logo"
          href="https://www.themoviedb.org/"
          rel="noreferrer"
          target="_blank"
        >
          <img alt={footer.tmdbLogoAlt} height={14} src={tmdbLogo} width={108} />
        </a>
        <p className="tmdb-attribution-text">{footer.tmdbNotice}</p>
      </div>
    </footer>
  );
};

const AppShell = () => {
  const {loading} = useAuth();
  const location = useLocation();
  const activeView = resolveActiveView(location.pathname, location.state);
  const canvas = canvasFromPath(location.pathname);
  const isLanding = location.pathname === paths.landing || location.pathname.startsWith(`${paths.landing}/`);

  useEffect(() => {
    document.documentElement.dataset.canvas = canvas;
    document.documentElement.dataset.chrome = isLanding ? "landing" : "app";
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute("content", "#0B0E12");
    }
  }, [canvas, isLanding]);

  if (loading) {
    return (
      <>
        {!isLanding && <TopBar activeView="trending" />}
        <main className="page-shell">
          <div className="state-panel">Loading account...</div>
        </main>
      </>
    );
  }

  return (
    <>
      {!isLanding && <TopBar activeView={activeView} />}
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
