import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {ReactElement} from "react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {ProfilePage} from "../ProfilePage";
import {now, stats, tvDetail, yearRecap} from "../../test/fixtures";
import {UserProfile} from "../../types/profile";

vi.mock("../../api/client", () => ({
  api: {
    meAchievements: vi.fn(),
  },
}));

const renderProfile = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const profile = {
  firstName: "Ada",
  lastName: "Viewer",
  email: "viewer@example.com",
  displayName: "Ada Viewer",
  photoURL: null,
  bio: null,
  country: null,
  timezone: null,
  friendCode: null,
  createdAt: null,
  updatedAt: null,
} satisfies UserProfile;

const baseProps = {
  history: [] as const,
  historyError: null,
  historyHasMore: false,
  historyLoading: false,
  historyLoadingMore: false,
  historyTotalCount: 0,
  profile,
  recap: yearRecap,
  recapError: null,
  recapLoading: false,
  signedIn: true,
  stats,
  statsError: null,
  statsLoading: false,
  userEmail: "viewer@example.com",
  onLoadMoreHistory: vi.fn(),
  onRecapYearChange: vi.fn(),
  onRetryHistory: vi.fn(),
  onRetryRecap: vi.fn(),
  onRetryStats: vi.fn(),
};

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.meAchievements).mockResolvedValue({
      enabled: true,
      showOnProfile: true,
      unlockedCount: 1,
      items: [
        {
          id: "detective",
          title: "Detective",
          description: "Watch mystery titles",
          category: "viewing",
          unlocked: true,
          unlockedAt: now,
          current: 5,
          target: 5,
          progressPercent: 100,
        },
      ],
    });
  });

  it("renders stats and recent history for a signed-in user", async () => {
    renderProfile(
      <ProfilePage
        {...baseProps}
        history={[
          {
            historyId: "tv_1001_s01e01",
            tmdbId: tvDetail.id,
            mediaType: "tv",
            title: tvDetail.title,
            seasonNumber: 1,
            episodeNumber: 1,
            episodeTitle: "Pilot",
            watchedAt: now,
            updatedAt: now,
          },
        ]}
        historyTotalCount={1}
      />,
    );

    expect(screen.getByRole("heading", {name: "Ada Viewer"})).toBeVisible();
    expect(screen.getByText("viewer@example.com")).toBeVisible();
    expect(screen.getByTestId("stat-watched-episodes")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-watch-time")).toHaveTextContent("42 min");
    expect(screen.getByTestId("stat-longest-streak")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-currently-watching")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-watchlist-count")).toHaveTextContent("1");
    expect(screen.getByTestId("top-shows-list")).toHaveTextContent("Critical Flow Show");
    expect(screen.getByTestId("top-genres-list")).toHaveTextContent("Drama");
    expect(screen.getByTestId("year-recap-card")).toHaveTextContent("2026 Recap");
    expect(screen.getByTestId("history-row-tv_1001_s01e01")).toHaveTextContent("Critical Flow Show");
    expect(screen.getByTestId("history-row-tv_1001_s01e01")).toHaveTextContent("S1 E1");
    expect(screen.getByTestId("profile-open-timeline")).toHaveAttribute("href", "/timeline");
    await waitFor(() => expect(screen.getByTestId("achievements-panel")).toHaveTextContent("Detective"));
    expect(screen.getByTestId("profile-open-social")).toHaveAttribute("href", "/social");
  });

  it("surfaces recap loading and retry errors", async () => {
    const user = userEvent.setup();
    const onRetryRecap = vi.fn();
    const {rerender} = renderProfile(<ProfilePage {...baseProps} recap={null} recapLoading />);
    expect(screen.getByText("Loading year recap...")).toBeVisible();

    rerender(
      <MemoryRouter>
        <ProfilePage
          {...baseProps}
          recap={null}
          recapError="Could not load year recap."
          onRetryRecap={onRetryRecap}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Could not load year recap.")).toBeVisible();
    await user.click(screen.getByRole("button", {name: "Retry"}));
    expect(onRetryRecap).toHaveBeenCalled();
  });

  it("keeps stats visible when only history fails", () => {
    renderProfile(
      <ProfilePage
        {...baseProps}
        historyError="Could not load history."
        stats={stats}
      />,
    );

    expect(screen.getByTestId("stat-watched-episodes")).toHaveTextContent("1");
    expect(screen.getByText("Could not load history.")).toBeVisible();
  });

  it("renders signed-out, loading, error, and empty-history states", async () => {
    const user = userEvent.setup();
    const onRetryStats = vi.fn();
    const {rerender} = renderProfile(
      <ProfilePage {...baseProps} profile={null} signedIn={false} stats={null} onRetryStats={onRetryStats} />,
    );
    expect(screen.getByText("Sign in to view your stats.")).toBeVisible();

    rerender(
      <MemoryRouter>
        <ProfilePage {...baseProps} profile={null} statsLoading stats={null} onRetryStats={onRetryStats} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Loading stats...")).toBeVisible();

    rerender(
      <MemoryRouter>
        <ProfilePage
          {...baseProps}
          profile={null}
          stats={null}
          statsError="Could not load profile stats."
          onRetryStats={onRetryStats}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Could not load profile stats.")).toBeVisible();
    await user.click(screen.getByRole("button", {name: "Retry"}));
    expect(onRetryStats).toHaveBeenCalled();

    rerender(
      <MemoryRouter>
        <ProfilePage {...baseProps} historyTotalCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Watched movies and episodes will appear here.")).toBeVisible();
  });
});
