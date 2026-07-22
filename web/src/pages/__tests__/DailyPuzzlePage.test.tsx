import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {useAppContext} from "../../AppContext";
import {DailyPuzzlePage} from "../DailyPuzzlePage";
import {SamplePuzzle} from "../../types/dailyPuzzle";

const blankImage = "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

const mockAuth = vi.hoisted(() => ({
  user: {email: "viewer@example.com", uid: "user-1"} as never,
  loading: false,
  configError: null as string | null,
  getIdToken: async () => "token",
  signOutUser: async () => undefined,
}));

vi.mock("../../api/client", () => ({
  api: {
    getDailyPuzzle: vi.fn(),
    submitPuzzleGuess: vi.fn(),
    getPuzzleStats: vi.fn(),
    detail: vi.fn(),
  },
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("../../AppContext", () => ({
  useAppContext: vi.fn(),
}));

vi.mock("../../firebase", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("../../lib/playerId", () => ({
  getOrCreatePlayerId: () => "player-test",
}));

vi.mock("../../lib/sampleDailyPuzzles", () => ({
  getSamplePuzzleForToday: (): SamplePuzzle => ({
    puzzleId: "2026-07-22",
    puzzleDate: "2026-07-22",
    imageUrl: blankImage,
    mobileImageUrl: blankImage,
    choices: [
      {choiceId: "a", title: "Ozark"},
      {choiceId: "b", title: "Breaking Bad"},
      {choiceId: "c", title: "Narcos"},
      {choiceId: "d", title: "Better Call Saul"},
    ],
    maxAttempts: 3,
    nextPuzzleAt: "2026-07-23T00:00:00.000Z",
    locale: "en-US",
    correctChoiceId: "b",
    correctShowId: 1396,
    seasonNumber: 3,
    episodeNumber: 7,
    hints: [
      {revealAfterAttempt: 1, type: "year", value: "2008"},
      {revealAfterAttempt: 2, type: "genre", value: "Crime drama"},
    ],
  }),
}));

const basePuzzle = {
  puzzleId: "2026-07-22",
  puzzleDate: "2026-07-22",
  imageUrl: blankImage,
  mobileImageUrl: blankImage,
  choices: [
    {choiceId: "a", title: "Ozark"},
    {choiceId: "b", title: "Breaking Bad"},
    {choiceId: "c", title: "Narcos"},
    {choiceId: "d", title: "Better Call Saul"},
  ],
  maxAttempts: 3,
  nextPuzzleAt: "2026-07-23T00:00:00.000Z",
  locale: "en-US",
  attempt: null,
};

const stats = {
  gamesPlayed: 2,
  gamesWon: 1,
  currentStreak: 1,
  longestStreak: 1,
  winsByAttempt: {1: 0, 2: 1, 3: 0},
  lastPlayedPuzzleDate: "2026-07-21",
};

describe("DailyPuzzlePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = {email: "viewer@example.com", uid: "user-1"} as never;
    vi.mocked(useAppContext).mockReturnValue({
      addToWatchlist: vi.fn(),
      openAuth: vi.fn(),
    } as never);
    vi.mocked(api.getPuzzleStats).mockResolvedValue(stats);
    Object.assign(navigator, {
      clipboard: {writeText: vi.fn().mockResolvedValue(undefined)},
      share: undefined,
    });
  });

  it("loads the daily puzzle from the API and shows streak stats", async () => {
    vi.mocked(api.getDailyPuzzle).mockResolvedValue(basePuzzle);

    render(
      <MemoryRouter>
        <DailyPuzzlePage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Loading today's puzzle/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", {name: "Breaking Bad"})).toBeInTheDocument());
    expect(api.getDailyPuzzle).toHaveBeenCalledWith("player-test");
    await waitFor(() => expect(screen.getByLabelText("Your puzzle stats")).toHaveTextContent("1"));
  });

  it("falls back to the sample puzzle when the API fails", async () => {
    vi.mocked(api.getDailyPuzzle).mockRejectedValue(new Error("offline"));

    render(
      <MemoryRouter>
        <DailyPuzzlePage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText(/Playing sample puzzle \(API unavailable\)/i)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", {name: "Ozark"}));
    await waitFor(() => expect(screen.getByText(/Hint: First aired in 2008/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", {name: "Breaking Bad"}));
    await waitFor(() => expect(screen.getByText(/Correct in 2 guesses/i)).toBeInTheDocument());
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
  });

  it("submits API guesses, reveals hints, and wins", async () => {
    vi.mocked(api.getDailyPuzzle).mockResolvedValue(basePuzzle);
    vi.mocked(api.submitPuzzleGuess)
      .mockResolvedValueOnce({
        correct: false,
        completed: false,
        won: false,
        attempt: 1,
        attemptsRemaining: 2,
        selectedChoiceIds: ["a"],
        hint: {revealAfterAttempt: 1, type: "year", value: "2008"},
      })
      .mockResolvedValueOnce({
        correct: true,
        completed: true,
        won: true,
        attempt: 2,
        attemptsRemaining: 1,
        selectedChoiceIds: ["a", "b"],
        answer: {
          showId: 1396,
          title: "Breaking Bad",
          seasonNumber: 3,
          episodeNumber: 7,
        },
        showPath: "/tv/1396",
      });

    render(
      <MemoryRouter>
        <DailyPuzzlePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("button", {name: "Ozark"})).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", {name: "Ozark"}));
    await waitFor(() => expect(screen.getByText(/Hint: First aired in 2008/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", {name: "Breaking Bad"}));
    await waitFor(() => expect(screen.getByText(/Correct in 2 guesses/i)).toBeInTheDocument());
    expect(screen.getByRole("button", {name: "Add to watchlist"})).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Share result"})).toBeInTheDocument();
  });

  it("adds the answered show to the watchlist when signed in", async () => {
    const addToWatchlist = vi.fn();
    vi.mocked(useAppContext).mockReturnValue({addToWatchlist, openAuth: vi.fn()} as never);
    vi.mocked(api.getDailyPuzzle).mockResolvedValue({
      ...basePuzzle,
      attempt: {
        puzzleId: "2026-07-22",
        selectedChoiceIds: ["b"],
        attemptCount: 1,
        completed: true,
        won: true,
        hints: [],
        answer: {
          showId: 1396,
          title: "Breaking Bad",
          seasonNumber: 3,
          episodeNumber: 7,
        },
      },
    });
    vi.mocked(api.detail).mockResolvedValue({
      id: 1396,
      mediaType: "tv",
      title: "Breaking Bad",
      overview: "",
      releaseDate: "2008-01-20",
      voteAverage: 9,
      popularity: 1,
      images: {poster: null, backdrop: null},
      genres: [],
      runtimeMinutes: null,
      status: null,
      originalLanguage: null,
      homepage: null,
    });

    render(
      <MemoryRouter>
        <DailyPuzzlePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("button", {name: "Add to watchlist"})).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", {name: "Add to watchlist"}));
    await waitFor(() => expect(addToWatchlist).toHaveBeenCalled());
    expect(screen.getByText("Added to watchlist.")).toBeInTheDocument();
  });

  it("copies the share result when Web Share is unavailable", async () => {
    vi.mocked(api.getDailyPuzzle).mockResolvedValue({
      ...basePuzzle,
      attempt: {
        puzzleId: "2026-07-22",
        selectedChoiceIds: ["b"],
        attemptCount: 1,
        completed: true,
        won: true,
        hints: [],
        answer: {
          showId: 1396,
          title: "Breaking Bad",
          seasonNumber: 3,
          episodeNumber: 7,
        },
      },
    });

    render(
      <MemoryRouter>
        <DailyPuzzlePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("button", {name: "Share result"})).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", {name: "Share result"}));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(screen.getByRole("button", {name: "Copied"})).toBeInTheDocument();
  });
});
