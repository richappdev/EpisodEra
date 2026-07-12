import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";
import {ProfilePage} from "../ProfilePage";
import {now, stats, tvDetail} from "../../test/fixtures";

describe("ProfilePage", () => {
  it("renders stats and recent history for a signed-in user", () => {
    render(
      <ProfilePage
        error={null}
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
        loading={false}
        signedIn
        stats={stats}
        userEmail="viewer@example.com"
      />,
    );

    expect(screen.getByRole("heading", {name: "viewer@example.com"})).toBeVisible();
    expect(screen.getByTestId("stat-watched-episodes")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-currently-watching")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-watchlist-count")).toHaveTextContent("1");
    expect(screen.getByTestId("history-row-tv_1001_s01e01")).toHaveTextContent("Critical Flow Show");
    expect(screen.getByTestId("history-row-tv_1001_s01e01")).toHaveTextContent("S1 E1");
  });

  it("renders signed-out, loading, error, and empty-history states", () => {
    const {rerender} = render(
      <ProfilePage error={null} history={[]} loading={false} signedIn={false} stats={null} userEmail={null} />,
    );
    expect(screen.getByText("Sign in to view your stats.")).toBeVisible();

    rerender(<ProfilePage error={null} history={[]} loading signedIn stats={null} userEmail="viewer@example.com" />);
    expect(screen.getByText("Loading stats...")).toBeVisible();

    rerender(
      <ProfilePage
        error="Could not load profile stats."
        history={[]}
        loading={false}
        signedIn
        stats={null}
        userEmail="viewer@example.com"
      />,
    );
    expect(screen.getByText("Could not load profile stats.")).toBeVisible();

    rerender(
      <ProfilePage error={null} history={[]} loading={false} signedIn stats={stats} userEmail="viewer@example.com" />,
    );
    expect(screen.getByText("Watched movies and episodes will appear here.")).toBeVisible();
  });
});
