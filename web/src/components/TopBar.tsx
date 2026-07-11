import {User} from "firebase/auth";
import {BarChart3, Bookmark, LogIn, LogOut, Search, Settings, TrendingUp} from "lucide-react";
import {SupportedLanguage, uiCopy} from "../types/settings";

interface TopBarProps {
  activeView: "trending" | "search" | "watchlist" | "profile" | "settings";
  language: SupportedLanguage;
  user: User | null;
  onAuthOpen: () => void;
  onSignOut: () => void;
  onViewChange: (view: "trending" | "search" | "watchlist" | "profile" | "settings") => void;
}

export const TopBar = ({activeView, language, user, onAuthOpen, onSignOut, onViewChange}: TopBarProps) => {
  const copy = uiCopy[language].topBar;

  return (
    <header className="top-bar">
      <div className="brand-lockup">
        <h1>Episodera</h1>
        <p>{copy.tagline}</p>
      </div>
      <div className="top-actions">
        {user && <span className="user-chip">{user.email}</span>}
        <nav aria-label="Primary">
          <button
            className={activeView === "trending" ? "active" : ""}
            type="button"
            onClick={() => onViewChange("trending")}
            title={copy.trending}
          >
            <TrendingUp size={18} aria-hidden="true" />
            <span>{copy.trending}</span>
          </button>
          <button
            className={activeView === "search" ? "active" : ""}
            type="button"
            onClick={() => onViewChange("search")}
            title={copy.search}
          >
            <Search size={18} aria-hidden="true" />
            <span>{copy.search}</span>
          </button>
          <button
            className={activeView === "watchlist" ? "active" : ""}
            type="button"
            onClick={() => onViewChange("watchlist")}
            title={copy.watchlist}
          >
            <Bookmark size={18} aria-hidden="true" />
            <span>{copy.watchlist}</span>
          </button>
          <button
            className={activeView === "profile" ? "active" : ""}
            type="button"
            onClick={() => onViewChange("profile")}
            title={copy.profile}
          >
            <BarChart3 size={18} aria-hidden="true" />
            <span>{copy.profile}</span>
          </button>
          <button
            className={activeView === "settings" ? "active" : ""}
            type="button"
            onClick={() => onViewChange("settings")}
            title={copy.settings}
          >
            <Settings size={18} aria-hidden="true" />
            <span>{copy.settings}</span>
          </button>
        </nav>
        <button className="account-button" type="button" onClick={user ? onSignOut : onAuthOpen}>
          {user ? <LogOut size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
          {user ? copy.signOut : copy.signIn}
        </button>
      </div>
    </header>
  );
};
