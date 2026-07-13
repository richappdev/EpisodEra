import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it, vi} from "vitest";
import {ProfilePage} from "../ProfilePage";
import {now, stats, tvDetail} from "../../test/fixtures";
import {UserProfile} from "../../types/profile";

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

const baseProps = {
  history: [] as const,
  historyError: null,
  historyHasMore: false,
  historyLoading: false,
  historyLoadingMore: false,
  historyTotalCount: 0,
  profile,
  signedIn: true,
  stats,
  statsError: null,
  statsLoading: false,
  userEmail: "viewer@example.com",
  onLoadMoreHistory: vi.fn(),
  onRetryHistory: vi.fn(),
  onRetryStats: vi.fn(),
};

describe("ProfilePage", () => {
  it("renders stats and recent history for a signed-in user", () => {
    render(
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
    expect(screen.getByTestId("stat-currently-watching")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-watchlist-count")).toHaveTextContent("1");
    expect(screen.getByTestId("history-row-tv_1001_s01e01")).toHaveTextContent("Critical Flow Show");
    expect(screen.getByTestId("history-row-tv_1001_s01e01")).toHaveTextContent("S1 E1");
  });

  it("keeps stats visible when only history fails", () => {
    render(
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
    const {rerender} = render(
      <ProfilePage {...baseProps} profile={null} signedIn={false} stats={null} onRetryStats={onRetryStats} />,
    );
    expect(screen.getByText("Sign in to view your stats.")).toBeVisible();

    rerender(<ProfilePage {...baseProps} profile={null} statsLoading stats={null} onRetryStats={onRetryStats} />);
    expect(screen.getByText("Loading stats...")).toBeVisible();

    rerender(
      <ProfilePage
        {...baseProps}
        profile={null}
        stats={null}
        statsError="Could not load profile stats."
        onRetryStats={onRetryStats}
      />,
    );
    expect(screen.getByText("Could not load profile stats.")).toBeVisible();
    await user.click(screen.getByRole("button", {name: "Retry"}));
    expect(onRetryStats).toHaveBeenCalled();

    rerender(<ProfilePage {...baseProps} historyTotalCount={0} />);
    expect(screen.getByText("Watched movies and episodes will appear here.")).toBeVisible();
  });
});
