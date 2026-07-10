import {Search, TrendingUp} from "lucide-react";

interface TopBarProps {
  activeView: "trending" | "search";
  onViewChange: (view: "trending" | "search") => void;
}

export const TopBar = ({activeView, onViewChange}: TopBarProps) => (
  <header className="top-bar">
    <div>
      <h1>Episodera</h1>
      <p>Track movies, shows, and next episodes</p>
    </div>
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
  </header>
);
