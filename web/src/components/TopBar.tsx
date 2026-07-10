import {Search, TrendingUp} from "lucide-react";

interface TopBarProps {
  activeView: "trending" | "search";
  onViewChange: (view: "trending" | "search") => void;
}

export const TopBar = ({activeView, onViewChange}: TopBarProps) => (
  <header className="top-bar">
    <div>
      <h1>TV Show Time</h1>
      <p>Movies and shows from TMDb</p>
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
