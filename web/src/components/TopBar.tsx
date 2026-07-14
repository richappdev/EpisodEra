import {NavLink} from "react-router-dom";
import {BarChart3, Bookmark, LogIn, LogOut, Search, Settings, TrendingUp} from "lucide-react";
import {useAuth} from "../auth/AuthContext";
import {useAppContext} from "../AppContext";
import {paths, type NavView} from "../routes/paths";
import {uiCopy} from "../types/settings";

interface TopBarProps {
  activeView: NavView;
}

const navClassName =
  (view: NavView, activeView: NavView) =>
  ({isActive}: {isActive: boolean}) =>
    activeView === view || isActive ? "active" : "";

export const TopBar = ({activeView}: TopBarProps) => {
  const {user} = useAuth();
  const {openAuth, profile, signOutAndReset, language} = useAppContext();
  const copy = uiCopy[language].topBar;
  const accountLabel = profile?.firstName || user?.displayName || user?.email;

  const handleAccountClick = async () => {
    if (user) {
      await signOutAndReset();
      return;
    }

    openAuth();
  };

  return (
    <header className="top-bar">
      <div className="brand-lockup">
        <h1>Episodera</h1>
        <p>{copy.tagline}</p>
      </div>
      <div className="top-actions">
        {user && accountLabel && <span className="user-chip">Welcome, {accountLabel}</span>}
        <nav aria-label="Primary">
          <NavLink
            className={navClassName("trending", activeView)}
            data-testid="nav-trending"
            title={copy.trending}
            to={paths.home}
          >
            <TrendingUp size={18} aria-hidden="true" />
            <span>{copy.trending}</span>
          </NavLink>
          <NavLink className={navClassName("search", activeView)} data-testid="nav-search" title={copy.search} to={paths.search}>
            <Search size={18} aria-hidden="true" />
            <span>{copy.search}</span>
          </NavLink>
          <NavLink className={navClassName("watchlist", activeView)} data-testid="nav-watchlist" title={copy.watchlist} to={paths.watchlist}>
            <Bookmark size={18} aria-hidden="true" />
            <span>{copy.watchlist}</span>
          </NavLink>
          <NavLink className={navClassName("profile", activeView)} data-testid="nav-profile" title={copy.profile} to={paths.profile}>
            <BarChart3 size={18} aria-hidden="true" />
            <span>{copy.profile}</span>
          </NavLink>
          <NavLink className={navClassName("settings", activeView)} data-testid="nav-settings" title={copy.settings} to={paths.settings}>
            <Settings size={18} aria-hidden="true" />
            <span>{copy.settings}</span>
          </NavLink>
        </nav>
        <button className="account-button" data-testid="account-button" type="button" onClick={handleAccountClick}>
          {user ? <LogOut size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
          {user ? copy.signOut : copy.signIn}
        </button>
      </div>
    </header>
  );
};
