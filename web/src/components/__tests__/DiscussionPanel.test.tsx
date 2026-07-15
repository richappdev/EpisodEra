import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {DiscussionPanel} from "../DiscussionPanel";

vi.mock("../../api/client", () => ({
  api: {
    listDiscussions: vi.fn(),
    createDiscussion: vi.fn(),
  },
}));

describe("DiscussionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listDiscussions).mockResolvedValue({
      items: [
        {
          commentId: "c1",
          userId: "u1",
          displayName: "Ada",
          body: "Great ending",
          mediaType: "tv",
          tmdbId: 1001,
          seasonNumber: 1,
          episodeNumber: null,
          createdAt: "2026-07-10T07:00:00.000Z",
          spoilerHidden: false,
        },
        {
          commentId: "c2",
          userId: "u2",
          displayName: "Bea",
          body: null,
          mediaType: "tv",
          tmdbId: 1001,
          seasonNumber: 1,
          episodeNumber: null,
          createdAt: "2026-07-10T08:00:00.000Z",
          spoilerHidden: true,
        },
      ],
    });
  });

  it("loads comments and hides spoilers", async () => {
    render(<DiscussionPanel mediaType="tv" signedIn tmdbId={1001} seasonNumber={1} />);

    await waitFor(() => expect(screen.getByTestId("discussion-c1")).toHaveTextContent("Great ending"));
    expect(screen.getByTestId("discussion-c2")).toHaveTextContent("Hidden until you watch this title");
  });

  it("posts a comment when signed in", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createDiscussion).mockResolvedValue({
      commentId: "c3",
      userId: "me",
      displayName: "Me",
      body: "No spoilers here",
      mediaType: "tv",
      tmdbId: 1001,
      seasonNumber: 1,
      episodeNumber: null,
      createdAt: "2026-07-11T07:00:00.000Z",
      spoilerHidden: false,
    });

    render(<DiscussionPanel mediaType="tv" signedIn tmdbId={1001} seasonNumber={1} />);
    await waitFor(() => expect(screen.getByTestId("discussion-input")).toBeVisible());

    await user.type(screen.getByTestId("discussion-input"), "No spoilers here");
    await user.click(screen.getByTestId("discussion-submit"));

    await waitFor(() =>
      expect(api.createDiscussion).toHaveBeenCalledWith("tv", 1001, {
        body: "No spoilers here",
        seasonNumber: 1,
        episodeNumber: null,
      }),
    );
    expect(screen.getByTestId("discussion-c3")).toHaveTextContent("No spoilers here");
  });

  it("requires sign-in to post", async () => {
    render(<DiscussionPanel mediaType="movie" signedIn={false} tmdbId={550} />);
    await waitFor(() => expect(screen.getByText("Sign in to join the discussion.")).toBeVisible());
    expect(screen.queryByTestId("discussion-input")).not.toBeInTheDocument();
  });
});
