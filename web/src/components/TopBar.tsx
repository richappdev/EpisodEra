import {NavLink} from "react-router-dom";
import {
  BarChart3,
  Bookmark,
  Clapperboard,
  Gamepad2,
  History,
  Home,
  LogIn,
  LogOut,
  Search,
  Settings,
  Users,
} from "lucide-react";
import type {ReactNode} from "react";
import {useAuth} from "../auth/AuthContext";
import {useAppContext} from "../AppContext";
import {paths, type NavView} from "../routes/paths";
import {uiCopy} from "../types/settings";

interface TopBarProps {
  activeView: NavView;
}

type NavItem = {
  view: NavView;
  to: string;
  testId: string;
  label: string;
  icon: ReactNode;
  secondary?: boolean;
};

const navClassName =
  (view: NavView, activeView: NavView, secondary?: boolean) =>
  ({isActive}: {isActive: boolean}) => {
    const active = activeView === view || isActive ? "active" : "";
    return secondary ? `nav-secondary ${active}`.trim() : active;
  };

export const TopBar = ({activeView}: TopBarProps) => {
  const {user} = useAuth();
  const {openAuth, profile, signOutAndReset, language} = useAppContext();
  const copy = uiCopy[language].topBar;
  const accountLabel = profile?.firstName || user?.displayName || user?.email;

  const navItems: NavItem[] = [
    {
      view: "trending",
      to: paths.home,
      testId: "nav-trending",
      label: copy.home,
      icon: <Home size={18} aria-hidden="true" />,
    },
    {
      view: "search",
      to: paths.search,
      testId: "nav-search",
      label: copy.search,
      icon: <Search size={18} aria-hidden="true" />,
    },
    {
      view: "timeline",
      to: paths.timeline,
      testId: "nav-timeline",
      label: copy.timeline,
      icon: <History size={18} aria-hidden="true" />,
    },
    {
      view: "watchlist",
      to: paths.watchlist,
      testId: "nav-watchlist",
      label: copy.watchlist,
      icon: <Bookmark size={18} aria-hidden="true" />,
    },
    {
      view: "profile",
      to: paths.profile,
      testId: "nav-profile",
      label: copy.profile,
      icon: <BarChart3 size={18} aria-hidden="true" />,
    },
    {
      view: "franchises",
      to: paths.franchises,
      testId: "nav-franchises",
      label: copy.franchises,
      icon: <Clapperboard size={18} aria-hidden="true" />,
      secondary: true,
    },
    {
      view: "play",
      to: paths.dailyPuzzle,
      testId: "nav-daily-puzzle",
      label: copy.play,
      icon: <Gamepad2 size={18} aria-hidden="true" />,
      secondary: true,
    },
    {
      view: "social",
      to: paths.social,
      testId: "nav-social",
      label: copy.social,
      icon: <Users size={18} aria-hidden="true" />,
      secondary: true,
    },
    {
      view: "settings",
      to: paths.settings,
      testId: "nav-settings",
      label: copy.settings,
      icon: <Settings size={18} aria-hidden="true" />,
      secondary: true,
    },
  ];

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
        <NavLink
          className={({isActive}) =>
            ["top-search", activeView === "search" || isActive ? "active" : ""].filter(Boolean).join(" ")
          }
          data-testid="top-search"
          title={copy.search}
          to={paths.search}
          aria-label={copy.search}
        >
          <Search size={18} aria-hidden="true" />
        </NavLink>
        <nav aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.testId}
              className={navClassName(item.view, activeView, item.secondary)}
              data-testid={item.testId}
              title={item.label}
              to={item.to}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          className="account-button"
          data-testid="account-button"
          type="button"
          aria-label={user ? copy.signOut : copy.signIn}
          onClick={handleAccountClick}
        >
          {user ? <LogOut size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
          <span className="account-button-label">{user ? copy.signOut : copy.signIn}</span>
        </button>
      </div>
    </header>
  );
};
