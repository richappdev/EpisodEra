import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {SocialPage} from "../SocialPage";

vi.mock("../../api/client", () => ({
  api: {
    meFriends: vi.fn(),
    meFeed: vi.fn(),
    meChallenges: vi.fn(),
    meCompatibility: vi.fn(),
    requestFriend: vi.fn(),
    updateFriendStatus: vi.fn(),
  },
}));

describe("SocialPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.meFriends).mockResolvedValue({
      friendCode: "ABC123",
      allowFriendRequests: true,
      shareActivityWithFriends: true,
      items: [
        {
          userId: "friend-1",
          displayName: "Bea",
          status: "accepted",
          friendCode: "BEA001",
          updatedAt: null,
        },
      ],
    });
    vi.mocked(api.meFeed).mockResolvedValue({
      items: [
        {
          feedId: "feed-1",
          friendUserId: "friend-1",
          friendDisplayName: "Bea",
          mediaType: "movie",
          tmdbId: 550,
          title: "Fight Club",
          seasonNumber: null,
          episodeNumber: null,
          episodeTitle: null,
          watchedAt: "2026-07-10T07:00:00.000Z",
          spoilerHidden: false,
        },
      ],
    });
    vi.mocked(api.meChallenges).mockResolvedValue({
      items: [
        {
          id: "binge-buddy",
          title: "Binge together",
          description: "Watch 10 episodes",
          current: 4,
          friendCurrent: 3,
          target: 10,
          unit: "episodes",
          progressPercent: 40,
          completed: false,
        },
      ],
    });
  });

  it("prompts signed-out users to sign in", () => {
    render(<SocialPage signedIn={false} />);
    expect(screen.getByText(/Sign in to manage friends/)).toBeVisible();
  });

  it("loads friend code, friends, challenges, and feed", async () => {
    render(<SocialPage signedIn />);

    await waitFor(() => expect(screen.getByTestId("friend-code-value")).toHaveTextContent("ABC123"));
    expect(screen.getByTestId("friends-list")).toHaveTextContent("Bea");
    expect(screen.getByTestId("challenges-list")).toHaveTextContent("Binge together");
    expect(screen.getByTestId("friends-feed")).toHaveTextContent("Fight Club");
  });

  it("submits a friend code", async () => {
    const user = userEvent.setup();
    vi.mocked(api.requestFriend).mockResolvedValue({
      friendCode: "ABC123",
      allowFriendRequests: true,
      shareActivityWithFriends: true,
      items: [
        {
          userId: "friend-2",
          displayName: "Pending Pal",
          status: "pending_outgoing",
          friendCode: "XYZ999",
          updatedAt: null,
        },
      ],
    });

    render(<SocialPage signedIn />);
    await waitFor(() => expect(screen.getByTestId("friend-code-input")).toBeVisible());

    await user.type(screen.getByTestId("friend-code-input"), "xyz999");
    await user.click(screen.getByTestId("friend-code-submit"));

    await waitFor(() => expect(api.requestFriend).toHaveBeenCalledWith("XYZ999"));
    expect(screen.getByTestId("friends-list")).toHaveTextContent("Pending Pal");
  });

  it("loads compatibility when comparing a friend", async () => {
    const user = userEvent.setup();
    vi.mocked(api.meCompatibility).mockResolvedValue({
      friendUserId: "friend-1",
      friendDisplayName: "Bea",
      score: 88,
      sharedGenres: ["Drama", "Sci-Fi"],
      yourTopGenres: ["Drama"],
      theirTopGenres: ["Sci-Fi"],
    });
    vi.mocked(api.meChallenges).mockResolvedValue({
      items: [
        {
          id: "binge-buddy",
          title: "Binge together",
          description: "Watch 10 episodes",
          current: 4,
          friendCurrent: 6,
          target: 10,
          unit: "episodes",
          progressPercent: 40,
          completed: false,
        },
      ],
    });

    render(<SocialPage signedIn />);
    await waitFor(() => expect(screen.getByRole("button", {name: "Compare"})).toBeVisible());
    await user.click(screen.getByRole("button", {name: "Compare"}));

    await waitFor(() => expect(screen.getByTestId("compatibility-card")).toHaveTextContent("88%"));
    expect(api.meCompatibility).toHaveBeenCalledWith("friend-1");
  });
});
