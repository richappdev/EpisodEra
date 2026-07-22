import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {AdminPuzzleStudioPage} from "../AdminPuzzleStudioPage";

vi.mock("../../api/client", () => ({
  api: {
    adminListPuzzles: vi.fn(),
    adminGetPuzzle: vi.fn(),
    adminUpsertPuzzle: vi.fn(),
    adminPublishScheduledPuzzles: vi.fn(),
    adminSearchTv: vi.fn(),
    adminEpisodeStills: vi.fn(),
    adminSuggestDistractors: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => ({
  user: {email: "admin@example.com", uid: "admin-1"} as never,
  loading: false,
  configError: null as string | null,
  getIdToken: async () => "token",
  signOutUser: async () => undefined,
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

const blankImage = "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

const listedPuzzle = {
  puzzleId: "2026-07-22",
  puzzleDate: "2026-07-22",
  status: "published",
  difficulty: "medium",
  imageUrl: blankImage,
  choices: [
    {choiceId: "a", title: "Breaking Bad"},
    {choiceId: "b", title: "Ozark"},
    {choiceId: "c", title: "Better Call Saul"},
    {choiceId: "d", title: "Narcos"},
  ],
  maxAttempts: 3,
  nextPuzzleAt: "2026-07-23T00:00:00.000Z",
  locale: "en-US",
};

const puzzleDetail = {
  ...listedPuzzle,
  mobileImageUrl: blankImage,
  correctChoiceId: "a",
  correctShowId: 1396,
  correctTitle: "Breaking Bad",
  hints: [
    {revealAfterAttempt: 1, type: "year" as const, value: "2008"},
    {revealAfterAttempt: 2, type: "genre" as const, value: "Crime"},
  ],
  status: "published" as const,
  difficulty: "medium" as const,
  seasonNumber: 1,
  episodeNumber: 1,
};

describe("AdminPuzzleStudioPage edit flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.adminListPuzzles).mockResolvedValue({items: [listedPuzzle]});
  });

  it("shows Edit next to each saved puzzle and loads it into the form", async () => {
    vi.mocked(api.adminGetPuzzle).mockResolvedValue(puzzleDetail);

    render(
      <MemoryRouter>
        <AdminPuzzleStudioPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/2026-07-22 — published \/ medium/i)).toBeInTheDocument();
    });

    const editButton = screen.getByRole("button", {name: /^edit$/i});
    editButton.click();

    await waitFor(() => {
      expect(api.adminGetPuzzle).toHaveBeenCalledWith("2026-07-22");
      expect(screen.getByText(/Editing saved puzzle 2026-07-22/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", {name: /Breaking Bad/i})).toBeInTheDocument();
    expect(screen.getByDisplayValue("2008")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Crime")).toBeInTheDocument();
    expect(screen.getByRole("button", {name: /Update puzzle/i})).toBeInTheDocument();
    expect(screen.getByText("Ozark")).toBeInTheDocument();
  });

  it("searches shows, loads stills, and saves a scheduled puzzle", async () => {
    vi.mocked(api.adminSearchTv).mockResolvedValue({
      items: [
        {
          id: 1396,
          title: "Breaking Bad",
          overview: "A chemistry teacher",
          releaseDate: "2008-01-20",
          popularity: 100,
          poster: null,
        },
      ],
    });
    vi.mocked(api.adminSuggestDistractors).mockResolvedValue({
      distractors: [
        {id: 2, title: "Ozark"},
        {id: 3, title: "Narcos"},
        {id: 4, title: "Better Call Saul"},
      ],
    });
    vi.mocked(api.adminEpisodeStills).mockResolvedValue({
      items: [
        {
          filePath: "/still.jpg",
          desktopUrl: blankImage,
          mobileUrl: blankImage,
          width: 1280,
          height: 720,
          aspectRatio: 16 / 9,
          voteAverage: 5,
        },
      ],
    });
    vi.mocked(api.adminUpsertPuzzle).mockResolvedValue({
      puzzleId: "2026-07-23",
      status: "scheduled",
    });

    render(
      <MemoryRouter>
        <AdminPuzzleStudioPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/Recent puzzles/i)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Breaking Bad"), {target: {value: "Breaking"}});
    fireEvent.click(screen.getByRole("button", {name: /^search$/i}));

    await waitFor(() => expect(screen.getByRole("button", {name: "Breaking Bad"})).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", {name: "Breaking Bad"}));

    await waitFor(() => expect(screen.getByText("Ozark")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", {name: /Load episode stills/i}));
    await waitFor(() => expect(api.adminEpisodeStills).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", {name: /Save puzzle/i}));
    await waitFor(() => expect(api.adminUpsertPuzzle).toHaveBeenCalled());
    expect(screen.getAllByText(/Saved puzzle 2026-07-23/i).length).toBeGreaterThan(0);
  });

  it("publishes scheduled puzzles from the studio", async () => {
    vi.mocked(api.adminSearchTv).mockResolvedValue({
      items: [
        {
          id: 1396,
          title: "Breaking Bad",
          overview: "",
          releaseDate: "2008-01-20",
          popularity: 1,
          poster: null,
        },
      ],
    });
    vi.mocked(api.adminSuggestDistractors).mockResolvedValue({
      distractors: [
        {id: 2, title: "Ozark"},
        {id: 3, title: "Narcos"},
        {id: 4, title: "Better Call Saul"},
      ],
    });
    vi.mocked(api.adminPublishScheduledPuzzles).mockResolvedValue({
      published: ["2026-07-22"],
      skipped: [],
    });

    render(
      <MemoryRouter>
        <AdminPuzzleStudioPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByPlaceholderText("Breaking Bad")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("Breaking Bad"), {target: {value: "Breaking"}});
    fireEvent.click(screen.getByRole("button", {name: /^search$/i}));
    await waitFor(() => expect(screen.getByRole("button", {name: "Breaking Bad"})).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", {name: "Breaking Bad"}));

    await waitFor(() => expect(screen.getByRole("button", {name: /Publish due scheduled/i})).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", {name: /Publish due scheduled/i}));
    await waitFor(() => expect(api.adminPublishScheduledPuzzles).toHaveBeenCalled());
    expect(screen.getByText(/Published: 2026-07-22/i)).toBeInTheDocument();
  });
});
