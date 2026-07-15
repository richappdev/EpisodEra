import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {User} from "firebase/auth";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it, vi} from "vitest";
import {useAppContext} from "../../AppContext";
import {useAuth} from "../../auth/AuthContext";
import {TopBar} from "../TopBar";
import {UserProfile} from "../../types/profile";

vi.mock("../../AppContext", () => ({
  useAppContext: vi.fn(),
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const user = {email: "viewer@example.com"} as User;
const profile = {
  firstName: "Ada",
  lastName: "Viewer",
  email: "viewer@example.com",
  displayName: "Ada Viewer",
  photoURL: null,
  bio: null,
  country: null,
  timezone: null,
  createdAt: null,
  updatedAt: null,
} satisfies UserProfile;

const baseContext = {
  autoMarkPreviousEpisodesWatched: false,
  historyItems: [],
  language: "en-US" as const,
  profile,
  progressItems: [],
  settingsError: null,
  settingsLoading: false,
  stats: null,
  statsError: null,
  statsLoading: false,
  watchlistError: null,
  watchlistItems: [],
  watchlistLoading: false,
  addToWatchlist: vi.fn(),
  changeAutoMarkPreviousEpisodesWatched: vi.fn(),
  changeLanguage: vi.fn(),
  markContinuationEpisodeWatched: vi.fn(),
  openAuth: vi.fn(),
  openContinuationDetail: vi.fn(),
  openMediaDetail: vi.fn(),
  pendingShowIds: new Set<number>(),
  refreshStats: vi.fn(),
  removeWatchlistItem: vi.fn(),
  removeProgressItem: vi.fn(),
  setProfile: vi.fn(),
  signOutAndReset: vi.fn(),
  syncWatchlistStatusFromProgress: vi.fn(),
  updateWatchlistStatus: vi.fn(),
  upsertWatchlistItem: vi.fn(),
  upsertProgressItem: vi.fn(),
};

describe("TopBar", () => {
  it("renders signed-in state and navigates via route links", async () => {
    const userEventApi = userEvent.setup();
    const signOutAndReset = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useAuth).mockReturnValue({user} as ReturnType<typeof useAuth>);
    vi.mocked(useAppContext).mockReturnValue({
      ...baseContext,
      signOutAndReset,
    });

    render(
      <MemoryRouter>
        <TopBar activeView="trending" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Welcome, Ada")).toBeVisible();
    expect(screen.getByTestId("nav-search")).toHaveAttribute("href", "/search");

    await userEventApi.click(screen.getByTestId("account-button"));
    expect(signOutAndReset).toHaveBeenCalled();
  });

  it("renders signed-out auth entry and localized nav copy", async () => {
    const userEventApi = userEvent.setup();
    const openAuth = vi.fn();

    vi.mocked(useAuth).mockReturnValue({user: null} as ReturnType<typeof useAuth>);
    vi.mocked(useAppContext).mockReturnValue({
      ...baseContext,
      profile: null,
      language: "zh-TW",
      openAuth,
    });

    render(
      <MemoryRouter>
        <TopBar activeView="settings" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("nav-search")).toHaveTextContent("搜尋");
    expect(screen.getByTestId("nav-settings")).toHaveClass("active");

    await userEventApi.click(screen.getByTestId("account-button"));
    expect(openAuth).toHaveBeenCalled();
  });
});
