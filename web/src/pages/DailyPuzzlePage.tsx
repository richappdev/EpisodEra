import {useCallback, useEffect, useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {Clapperboard, Gamepad2, Share2} from "lucide-react";
import {api} from "../api/client";
import {useAppContext} from "../AppContext";
import {useAuth} from "../auth/AuthContext";
import {trackEvent} from "../firebase";
import {applyLocalGuess, formatShareResult} from "../lib/dailyPuzzleLogic";
import {getOrCreatePlayerId} from "../lib/playerId";
import {getSamplePuzzleForToday} from "../lib/sampleDailyPuzzles";
import {paths} from "../routes/paths";
import {
  DailyPuzzlePayload,
  GuessFinalResponse,
  PuzzleHint,
  SamplePuzzle,
  UserGameStats,
} from "../types/dailyPuzzle";
import {SectionError} from "../components/SectionError";

type PlayMode = "api" | "sample";

const hintLabel = (hint: PuzzleHint) => {
  switch (hint.type) {
    case "year":
      return `First aired in ${hint.value}.`;
    case "genre":
      return `Genre: ${hint.value}.`;
    case "network":
      return `Network / streamer: ${hint.value}.`;
    case "country":
      return `Country: ${hint.value}.`;
    case "cast":
      return `Lead / cast: ${hint.value}.`;
    case "image":
      return "A second scene is available.";
    default:
      return hint.value;
  }
};

export const DailyPuzzlePage = () => {
  const navigate = useNavigate();
  const {user} = useAuth();
  const {addToWatchlist, openAuth} = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<PlayMode>("api");
  const [puzzle, setPuzzle] = useState<DailyPuzzlePayload | SamplePuzzle | null>(null);
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [won, setWon] = useState(false);
  const [hint, setHint] = useState<PuzzleHint | null>(null);
  const [answer, setAnswer] = useState<GuessFinalResponse["answer"] | null>(null);
  const [showPath, setShowPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [stats, setStats] = useState<UserGameStats | null>(null);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);
  const [isPuzzleAdmin, setIsPuzzleAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setImageFailed(false);
    try {
      const payload = await api.getDailyPuzzle(getOrCreatePlayerId());
      setMode("api");
      setPuzzle(payload);
      setSelectedChoiceIds(payload.attempt?.selectedChoiceIds ?? []);
      setCompleted(Boolean(payload.attempt?.completed));
      setWon(Boolean(payload.attempt?.won));
      setHint(payload.attempt?.hints?.[payload.attempt.hints.length - 1] ?? null);
      setAnswer(payload.attempt?.answer ?? null);
      setShowPath(payload.attempt?.answer ? paths.tv(payload.attempt.answer.showId) : null);
      trackEvent("daily_game_viewed", {puzzle_id: payload.puzzleId, mode: "api"});
      if (user) {
        try {
          setStats(await api.getPuzzleStats());
        } catch {
          setStats(null);
        }
      }
    } catch {
      const sample = getSamplePuzzleForToday();
      setMode("sample");
      setPuzzle(sample);
      setSelectedChoiceIds([]);
      setCompleted(false);
      setWon(false);
      setHint(null);
      setAnswer(null);
      setShowPath(null);
      trackEvent("daily_game_viewed", {puzzle_id: sample.puzzleId, mode: "sample"});
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) {
      setIsPuzzleAdmin(false);
      return;
    }

    let cancelled = false;
    void api
      .getPuzzleAdminAccess()
      .then((response) => {
        if (!cancelled) {
          setIsPuzzleAdmin(response.isPuzzleAdmin);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsPuzzleAdmin(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.email]);

  const attemptCount = selectedChoiceIds.length;
  const maxAttempts = puzzle?.maxAttempts ?? 3;

  const handleGuess = async (choiceId: string) => {
    if (!puzzle || completed || submitting || selectedChoiceIds.includes(choiceId)) {
      return;
    }

    setSubmitting(true);
    setError(null);
    trackEvent("choice_selected", {puzzle_id: puzzle.puzzleId, choice_id: choiceId, attempt: attemptCount + 1});

    try {
      if (mode === "sample") {
        const result = applyLocalGuess({
          puzzle: puzzle as SamplePuzzle,
          selectedChoiceIds,
          choiceId,
        });
        setSelectedChoiceIds(result.selectedChoiceIds);
        setHint(result.hint);
        if (result.hint) {
          trackEvent("hint_revealed", {puzzle_id: puzzle.puzzleId, hint_type: result.hint.type});
        }
        if (result.completed) {
          setCompleted(true);
          setWon(result.won);
          setAnswer(result.answer);
          setShowPath(result.showPath);
          trackEvent(result.won ? "puzzle_won" : "puzzle_lost", {
            puzzle_id: puzzle.puzzleId,
            attempt: result.attemptCount,
          });
        }
        return;
      }

      if (attemptCount === 0) {
        trackEvent("puzzle_started", {puzzle_id: puzzle.puzzleId});
      }

      const result = await api.submitPuzzleGuess(puzzle.puzzleId, {choiceId}, getOrCreatePlayerId());
      setSelectedChoiceIds(result.selectedChoiceIds);
      if (!result.correct && "hint" in result && result.hint) {
        setHint(result.hint);
        trackEvent("hint_revealed", {puzzle_id: puzzle.puzzleId, hint_type: result.hint.type});
      }
      if (result.completed) {
        setCompleted(true);
        setWon(result.won);
        setAnswer(result.answer);
        setShowPath(result.showPath);
        trackEvent(result.won ? "puzzle_won" : "puzzle_lost", {
          puzzle_id: puzzle.puzzleId,
          attempt: result.attempt,
        });
        if (user) {
          try {
            setStats(await api.getPuzzleStats());
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit guess.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    if (!puzzle) {
      return;
    }
    const text = formatShareResult({
      puzzleDate: puzzle.puzzleDate,
      won,
      attemptCount: selectedChoiceIds.length,
      maxAttempts,
    });
    try {
      if (navigator.share) {
        await navigator.share({title: "Episodera Daily Puzzle", text});
      } else {
        await navigator.clipboard.writeText(text);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 2000);
      }
      trackEvent("result_shared", {puzzle_id: puzzle.puzzleId, won});
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setShareCopied(true);
      } catch {
        setError("Could not share result.");
      }
    }
  };

  const handleViewShow = () => {
    if (!answer) {
      return;
    }
    trackEvent("answer_show_opened", {show_id: answer.showId});
    navigate(paths.tv(answer.showId), {state: {nav: "play"}});
  };

  const handleAddToWatchlist = async () => {
    if (!answer) {
      return;
    }
    if (!user) {
      openAuth();
      return;
    }
    setWatchlistBusy(true);
    setWatchlistMessage(null);
    try {
      const detail = await api.detail("tv", answer.showId, "en-US");
      addToWatchlist(detail);
      setWatchlistMessage("Added to watchlist.");
      trackEvent("answer_added_to_watchlist", {show_id: answer.showId});
    } catch (err) {
      setWatchlistMessage(err instanceof Error ? err.message : "Could not add to watchlist.");
    } finally {
      setWatchlistBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="page-shell daily-puzzle-page">
        <div className="state-panel inline-state">Loading today&apos;s puzzle...</div>
      </main>
    );
  }

  if (!puzzle) {
    return (
      <main className="page-shell daily-puzzle-page">
        <SectionError message={error ?? "Puzzle unavailable."} onRetry={() => void load()} />
      </main>
    );
  }

  return (
    <main className="page-shell daily-puzzle-page">
      <section className="profile-header">
        <div>
          <span className="media-kind">Daily puzzle</span>
          <h2>Which show is this?</h2>
          <p>One scene, four titles, three attempts. Progressive hints after each miss.</p>
          {isPuzzleAdmin && (
            <p className="daily-puzzle-admin-link">
              <Link className="text-button" data-testid="open-puzzle-studio" to={paths.adminPuzzles}>
                <Clapperboard size={16} aria-hidden="true" /> Manage puzzles
              </Link>
            </p>
          )}
        </div>
        <Gamepad2 aria-hidden="true" size={36} />
      </section>

      {mode === "sample" && (
        <p className="daily-puzzle-banner" role="status">
          Playing sample puzzle (API unavailable). Answers stay local for this mode only.
        </p>
      )}

      {error && <SectionError message={error} onRetry={() => void load()} />}

      <div className="daily-puzzle-attempts" aria-label="Attempts">
        {Array.from({length: maxAttempts}, (_, index) => (
          <span
            key={index}
            className={index < attemptCount ? "daily-puzzle-dot filled" : "daily-puzzle-dot"}
            aria-hidden="true"
          />
        ))}
        <span className="sr-only">
          {attemptCount} of {maxAttempts} attempts used
        </span>
      </div>

      <figure className="daily-puzzle-still">
        {imageFailed ? (
          <div className="daily-puzzle-image-error" role="alert">
            Scene image failed to load. You can still play from the titles below.
          </div>
        ) : (
          <img
            alt="Episode still for today's daily puzzle"
            src={puzzle.mobileImageUrl || puzzle.imageUrl}
            onError={() => {
              setImageFailed(true);
              trackEvent("puzzle_image_failed", {puzzle_id: puzzle.puzzleId});
            }}
          />
        )}
      </figure>

      <div className="daily-puzzle-live" aria-live="polite">
        {!completed && hint && <p className="daily-puzzle-hint">Not this one. Hint: {hintLabel(hint)}</p>}
        {completed && answer && (
          <div className="daily-puzzle-result">
            <h3>{won ? `Correct in ${attemptCount} ${attemptCount === 1 ? "guess" : "guesses"}` : "Out of guesses"}</h3>
            <p className="daily-puzzle-answer-title">{answer.title}</p>
            {(answer.seasonNumber || answer.episodeNumber) && (
              <p>
                {answer.seasonNumber ? `Season ${answer.seasonNumber}` : null}
                {answer.seasonNumber && answer.episodeNumber ? ", " : null}
                {answer.episodeNumber ? `Episode ${answer.episodeNumber}` : null}
              </p>
            )}
            <p className="daily-puzzle-share-marks" aria-hidden="true">
              {(() => {
                const lines = formatShareResult({
                  puzzleDate: puzzle.puzzleDate,
                  won,
                  attemptCount,
                  maxAttempts,
                }).split("\n");
                return lines[lines.length - 1];
              })()}
            </p>
          </div>
        )}
      </div>

      {!completed && (
        <div className="daily-puzzle-choices" role="group" aria-label="Show choices">
          {puzzle.choices.map((choice) => {
            const disabled = selectedChoiceIds.includes(choice.choiceId) || submitting;
            const wrong = selectedChoiceIds.includes(choice.choiceId);
            return (
              <button
                key={choice.choiceId}
                type="button"
                className={wrong ? "daily-puzzle-choice wrong" : "daily-puzzle-choice"}
                disabled={disabled}
                aria-disabled={disabled}
                onClick={() => void handleGuess(choice.choiceId)}
              >
                {choice.title}
                {wrong ? " — eliminated" : ""}
              </button>
            );
          })}
        </div>
      )}

      {completed && (
        <div className="daily-puzzle-actions">
          <button type="button" className="continue-button" disabled={watchlistBusy} onClick={() => void handleAddToWatchlist()}>
            {user ? "Add to watchlist" : "Sign in to add watchlist"}
          </button>
          <button type="button" className="text-button" onClick={handleViewShow}>
            View show
          </button>
          {showPath && (
            <Link className="text-button" to={showPath} onClick={() => answer && trackEvent("answer_show_opened", {show_id: answer.showId})}>
              Open show page
            </Link>
          )}
          <button type="button" className="text-button" onClick={() => void handleShare()}>
            <Share2 size={16} aria-hidden="true" /> {shareCopied ? "Copied" : "Share result"}
          </button>
          {watchlistMessage && <p role="status">{watchlistMessage}</p>}
        </div>
      )}

      {stats && (
        <section className="daily-puzzle-stats" aria-label="Your puzzle stats">
          <h3>Your streak</h3>
          <div className="stats-grid stats-figures">
            <article>
              <span>Current streak</span>
              <strong>{stats.currentStreak}</strong>
            </article>
            <article>
              <span>Longest streak</span>
              <strong>{stats.longestStreak}</strong>
            </article>
            <article>
              <span>Won</span>
              <strong>
                {stats.gamesWon}/{stats.gamesPlayed}
              </strong>
            </article>
          </div>
        </section>
      )}

      <p className="daily-puzzle-attribution">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </main>
  );
};
