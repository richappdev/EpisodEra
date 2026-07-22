import {FormEvent, useCallback, useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {Clapperboard} from "lucide-react";
import {api} from "../api/client";
import {useAuth} from "../auth/AuthContext";
import {SectionError} from "../components/SectionError";
import {paths} from "../routes/paths";
import {AdminPuzzleDetail, AdminPuzzleDraft, PuzzleHint} from "../types/dailyPuzzle";
import {utcPuzzleDate} from "../lib/dailyPuzzleLogic";

interface SearchHit {
  id: number;
  title: string;
  overview: string;
  releaseDate: string | null;
  popularity: number;
  poster: string | null;
}

interface StillItem {
  filePath: string;
  desktopUrl: string;
  mobileUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  voteAverage: number;
}

const defaultHints = (): PuzzleHint[] => [
  {revealAfterAttempt: 1, type: "year", value: ""},
  {revealAfterAttempt: 2, type: "genre", value: ""},
];

const stillFromSavedUrls = (imageUrl: string, mobileImageUrl: string | null): StillItem => ({
  filePath: "saved-image",
  desktopUrl: imageUrl,
  mobileUrl: mobileImageUrl || imageUrl,
  width: 0,
  height: 0,
  aspectRatio: 16 / 9,
  voteAverage: 0,
});

export const AdminPuzzleStudioPage = () => {
  const {user} = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [selectedShow, setSelectedShow] = useState<SearchHit | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [stills, setStills] = useState<StillItem[]>([]);
  const [selectedStill, setSelectedStill] = useState<StillItem | null>(null);
  const [distractors, setDistractors] = useState<Array<{id: number; title: string}>>([]);
  const [hints, setHints] = useState<PuzzleHint[]>(defaultHints());
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [status, setStatus] = useState<"draft" | "scheduled" | "published">("scheduled");
  const [puzzleDate, setPuzzleDate] = useState(utcPuzzleDate());
  const [editingPuzzleId, setEditingPuzzleId] = useState<string | null>(null);
  const [existing, setExisting] = useState<Array<{id: string; puzzleDate: string; status: string; difficulty: string}>>([]);

  const refreshList = useCallback(async () => {
    try {
      const response = await api.adminListPuzzles();
      setExisting(
        response.items.map((item) => ({
          id: item.puzzleId,
          puzzleDate: item.puzzleDate,
          status: item.status,
          difficulty: item.difficulty,
        })),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load puzzles.");
    }
  }, []);

  useEffect(() => {
    if (user) {
      void refreshList();
    }
  }, [user?.uid, refreshList]);

  if (!user) {
    return (
      <main className="page-shell admin-puzzle-studio">
        <div className="state-panel">Sign in with an allowlisted admin account to use Puzzle Studio.</div>
        <Link className="text-button" to={paths.login}>
          Sign in
        </Link>
      </main>
    );
  }

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await api.adminSearchTv(query);
      setSearchHits(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const selectShow = async (show: SearchHit) => {
    setSelectedShow(show);
    setEditingPuzzleId(null);
    setMessage(null);
    try {
      const suggestion = await api.adminSuggestDistractors(show.id);
      setDistractors(suggestion.distractors);
      const year = show.releaseDate?.slice(0, 4) ?? "";
      setHints([
        {revealAfterAttempt: 1, type: "year", value: year},
        {revealAfterAttempt: 2, type: "genre", value: "Drama"},
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not suggest distractors.");
    }
  };

  const applyPuzzleToForm = (puzzle: AdminPuzzleDetail) => {
    const correctChoice = puzzle.choices.find((choice) => choice.choiceId === puzzle.correctChoiceId);
    const distractorChoices = puzzle.choices.filter((choice) => choice.choiceId !== puzzle.correctChoiceId);
    const savedStill = stillFromSavedUrls(puzzle.imageUrl, puzzle.mobileImageUrl);

    setEditingPuzzleId(puzzle.puzzleId);
    setPuzzleDate(puzzle.puzzleDate);
    setSelectedShow({
      id: puzzle.correctShowId,
      title: puzzle.correctTitle || correctChoice?.title || "Unknown show",
      overview: "",
      releaseDate: null,
      popularity: 0,
      poster: null,
    });
    setSeasonNumber(puzzle.seasonNumber ?? 1);
    setEpisodeNumber(puzzle.episodeNumber ?? 1);
    setStills([savedStill]);
    setSelectedStill(savedStill);
    setDistractors(
      distractorChoices.map((choice, index) => ({
        id: -(index + 1),
        title: choice.title,
      })),
    );
    setHints(puzzle.hints.length > 0 ? puzzle.hints : defaultHints());
    setDifficulty(puzzle.difficulty);
    setStatus(puzzle.status);
    setSearchHits([]);
    setQuery("");
  };

  const loadPuzzleForEdit = async (puzzleId: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const puzzle = await api.adminGetPuzzle(puzzleId);
      applyPuzzleToForm(puzzle);
      setMessage(`Editing puzzle ${puzzle.puzzleDate}.`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load puzzle.");
    } finally {
      setLoading(false);
    }
  };

  const loadStills = async () => {
    if (!selectedShow) {
      return;
    }
    setLoading(true);
    try {
      const response = await api.adminEpisodeStills(selectedShow.id, seasonNumber, episodeNumber);
      setStills(response.items);
      setSelectedStill(response.items[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load stills.");
    } finally {
      setLoading(false);
    }
  };

  const savePuzzle = async () => {
    if (!selectedShow || !selectedStill) {
      setError("Select a show and still image first.");
      return;
    }
    const choiceIds = ["a", "b", "c", "d"];
    const titles = [selectedShow.title, ...distractors.slice(0, 3).map((item) => item.title)];
    while (titles.length < 4) {
      titles.push(`Option ${titles.length + 1}`);
    }
    const choices = choiceIds.map((choiceId, index) => ({choiceId, title: titles[index]!}));
    const draft: AdminPuzzleDraft = {
      puzzleDate,
      correctShowId: selectedShow.id,
      correctTitle: selectedShow.title,
      seasonNumber,
      episodeNumber,
      imageUrl: selectedStill.desktopUrl,
      mobileImageUrl: selectedStill.mobileUrl,
      choices,
      correctChoiceId: "a",
      hints: hints.filter((hint) => hint.value.trim().length > 0),
      difficulty,
      status,
      locale: "en-US",
    };

    setLoading(true);
    setMessage(null);
    try {
      const result = await api.adminUpsertPuzzle(draft);
      setEditingPuzzleId(result.puzzleId);
      setMessage(`Saved puzzle ${result.puzzleId}.`);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save puzzle.");
    } finally {
      setLoading(false);
    }
  };

  const publishScheduled = async () => {
    setLoading(true);
    try {
      const result = await api.adminPublishScheduledPuzzles();
      setMessage(`Published: ${result.published.join(", ") || "none"}`);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell admin-puzzle-studio">
      <section className="profile-header">
        <div>
          <span className="media-kind">Admin</span>
          <h2>Puzzle studio</h2>
          <p>Search TMDB, pick an episode still, approve distractors and hints, then schedule.</p>
        </div>
        <Clapperboard aria-hidden="true" size={36} />
      </section>

      {error && <SectionError message={error} onRetry={() => void refreshList()} />}
      {message && <p role="status">{message}</p>}

      <form className="admin-puzzle-form" onSubmit={(event) => void handleSearch(event)}>
        <label>
          Search TV shows
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Breaking Bad" />
        </label>
        <button className="continue-button" disabled={loading} type="submit">
          Search
        </button>
      </form>

      <div className="admin-puzzle-grid">
        {searchHits.map((hit) => (
          <button key={hit.id} className="text-button" type="button" onClick={() => void selectShow(hit)}>
            {hit.title}
          </button>
        ))}
      </div>

      {selectedShow && (
        <section className="admin-puzzle-form">
          <h3>{selectedShow.title}</h3>
          {editingPuzzleId && <p className="muted-copy">Editing saved puzzle {editingPuzzleId}</p>}
          <label>
            Puzzle date (UTC)
            <input type="date" value={puzzleDate} onChange={(event) => setPuzzleDate(event.target.value)} />
          </label>
          <label>
            Season
            <input
              type="number"
              min={1}
              value={seasonNumber}
              onChange={(event) => setSeasonNumber(Number(event.target.value))}
            />
          </label>
          <label>
            Episode
            <input
              type="number"
              min={1}
              value={episodeNumber}
              onChange={(event) => setEpisodeNumber(Number(event.target.value))}
            />
          </label>
          <button className="text-button" type="button" disabled={loading} onClick={() => void loadStills()}>
            Load episode stills
          </button>

          <div className="admin-stills">
            {stills.map((still) => (
              <button
                key={still.filePath}
                type="button"
                className={selectedStill?.filePath === still.filePath ? "admin-still-button selected" : "admin-still-button"}
                onClick={() => setSelectedStill(still)}
              >
                <img alt="" src={still.mobileUrl || still.desktopUrl} />
              </button>
            ))}
          </div>

          <h4>Distractors</h4>
          <ul>
            {distractors.map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>

          {hints.map((hint, index) => (
            <label key={hint.revealAfterAttempt}>
              Hint after attempt {hint.revealAfterAttempt} ({hint.type})
              <input
                value={hint.value}
                onChange={(event) => {
                  const next = [...hints];
                  next[index] = {...hint, value: event.target.value};
                  setHints(next);
                }}
              />
            </label>
          ))}

          <label>
            Difficulty
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
            </select>
          </label>

          <div className="daily-puzzle-actions">
            <button className="continue-button" type="button" disabled={loading} onClick={() => void savePuzzle()}>
              {editingPuzzleId ? "Update puzzle" : "Save puzzle"}
            </button>
            <button className="text-button" type="button" disabled={loading} onClick={() => void publishScheduled()}>
              Publish due scheduled
            </button>
            <Link className="text-button" to={paths.dailyPuzzle}>
              Open daily puzzle
            </Link>
          </div>
        </section>
      )}

      <section>
        <h3>Recent puzzles</h3>
        {existing.length === 0 ? (
          <p className="muted-copy">No puzzles yet.</p>
        ) : (
          <ul className="admin-puzzle-list">
            {existing.map((item) => (
              <li key={item.id} className="admin-puzzle-list-item">
                <span>
                  {item.puzzleDate} — {item.status} / {item.difficulty}
                </span>
                <button
                  className="text-button"
                  type="button"
                  disabled={loading}
                  onClick={() => void loadPuzzleForEdit(item.id)}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="daily-puzzle-attribution">
        This product uses the TMDB API but is not endorsed or certified by TMDB. Configure `PUZZLE_ADMIN_EMAILS` for
        access.
      </p>
    </main>
  );
};
