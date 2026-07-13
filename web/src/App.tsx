import {useAuth} from "./auth/AuthContext";
import {AppProvider} from "./AppContext";
import {TopBar} from "./components/TopBar";
import {AppRoutes} from "./routes/AppRoutes";
import {isDetailPath, navFromPath, type NavView} from "./routes/paths";
import {useLocation} from "react-router-dom";

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
      <footer className="tmdb-attribution">
        This product uses the TMDb API and TMDb images/data but is not endorsed or certified by{" "}
        <a href="https://www.themoviedb.org/about/logos-attribution" rel="noreferrer" target="_blank">
          TMDb
        </a>
        .
      </footer>
    </>
  );
};

export const App = () => (
  <AppProvider>
    <AppShell />
  </AppProvider>
);
