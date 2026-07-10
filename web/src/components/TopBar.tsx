import {User} from "firebase/auth";
import {LogIn, LogOut, Search, TrendingUp} from "lucide-react";

interface TopBarProps {
  activeView: "trending" | "search";
  user: User | null;
  onAuthOpen: () => void;
  onSignOut: () => void;
  onViewChange: (view: "trending" | "search") => void;
}

export const TopBar = ({activeView, user, onAuthOpen, onSignOut, onViewChange}: TopBarProps) => (
  <header className="top-bar">
    <div>
      <h1>Episodera</h1>
      <p>Track movies, shows, and next episodes</p>
    </div>
    <div className="top-actions">
      {user && <span className="user-chip">{user.email}</span>}
      <nav aria-label="Primary">
        <button
          className={activeView === "trending" ? "active" : ""}
          type="button"
          onClick={() => onViewChange("trending")}
          title="Trending"
        >
          <TrendingUp size={18} aria-hidden="true" />
          Trending
        </button>
        <button
          className={activeView === "search" ? "active" : ""}
          type="button"
          onClick={() => onViewChange("search")}
          title="Search"
        >
          <Search size={18} aria-hidden="true" />
          Search
        </button>
      </nav>
      <button className="account-button" type="button" onClick={user ? onSignOut : onAuthOpen}>
        {user ? <LogOut size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
        {user ? "Sign out" : "Sign in"}
      </button>
    </div>
  </header>
);
