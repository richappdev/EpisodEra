import {render, screen, waitFor} from "@testing-library/react";
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

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    user: {email: "admin@example.com", uid: "admin-1"} as never,
    loading: false,
    configError: null,
    getIdToken: async () => "token",
    signOutUser: async () => undefined,
  }),
}));

const listedPuzzle = {
  puzzleId: "2026-07-22",
  puzzleDate: "2026-07-22",
  status: "published",
  difficulty: "medium",
  imageUrl: "https://example.com/desktop.webp",
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
  mobileImageUrl: "https://example.com/mobile.webp",
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

    expect(screen.getByRole("button", {name: /^edit$/i})).toBeInTheDocument();

    screen.getByRole("button", {name: /^edit$/i}).click();

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
});
