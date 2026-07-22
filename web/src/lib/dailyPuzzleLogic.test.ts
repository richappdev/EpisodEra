import {describe, expect, it} from "vitest";
import {
  applyLocalGuess,
  computeStreakUpdate,
  formatShareResult,
  hintForAttempt,
  nextUtcMidnightIso,
  utcPuzzleDate,
} from "./dailyPuzzleLogic";
import {getSamplePuzzleForToday} from "./sampleDailyPuzzles";

describe("dailyPuzzleLogic", () => {
  const puzzle = getSamplePuzzleForToday();

  it("formats UTC puzzle dates and next midnight", () => {
    expect(utcPuzzleDate(new Date("2026-07-21T23:30:00.000Z"))).toBe("2026-07-21");
    expect(nextUtcMidnightIso("2026-07-21")).toBe("2026-07-22T00:00:00.000Z");
  });

  it("returns hints after the matching attempt", () => {
    expect(hintForAttempt(puzzle.hints, 1)?.type).toBe("year");
    expect(hintForAttempt(puzzle.hints, 2)?.type).toBe("genre");
    expect(hintForAttempt(puzzle.hints, 3)).toBeNull();
  });

  it("applies wrong then correct guesses", () => {
    const wrong = applyLocalGuess({puzzle, selectedChoiceIds: [], choiceId: "a"});
    expect(wrong.correct).toBe(false);
    expect(wrong.completed).toBe(false);
    expect(wrong.hint?.value).toBe("2008");

    const right = applyLocalGuess({
      puzzle,
      selectedChoiceIds: wrong.selectedChoiceIds,
      choiceId: "b",
    });
    expect(right.correct).toBe(true);
    expect(right.won).toBe(true);
    expect(right.completed).toBe(true);
    expect(right.showPath).toBe("/tv/1396");
  });

  it("completes as a loss after max attempts", () => {
    const first = applyLocalGuess({puzzle, selectedChoiceIds: [], choiceId: "a"});
    const second = applyLocalGuess({
      puzzle,
      selectedChoiceIds: first.selectedChoiceIds,
      choiceId: "c",
    });
    const third = applyLocalGuess({
      puzzle,
      selectedChoiceIds: second.selectedChoiceIds,
      choiceId: "d",
    });
    expect(third.completed).toBe(true);
    expect(third.won).toBe(false);
    expect(third.answer?.showId).toBe(1396);
  });

  it("rejects duplicate choices", () => {
    expect(() => applyLocalGuess({puzzle, selectedChoiceIds: ["a"], choiceId: "a"})).toThrow(
      /already selected/i,
    );
  });

  it("formats share results and streak updates", () => {
    expect(formatShareResult({puzzleDate: "2026-07-21", won: true, attemptCount: 2, maxAttempts: 3})).toContain(
      "🟩",
    );

    const stats = computeStreakUpdate({
      stats: {
        gamesPlayed: 1,
        gamesWon: 1,
        currentStreak: 1,
        longestStreak: 1,
        winsByAttempt: {1: 1, 2: 0, 3: 0},
        lastPlayedPuzzleDate: "2026-07-20",
      },
      puzzleDate: "2026-07-21",
      won: true,
      attemptCount: 2,
    });
    expect(stats.currentStreak).toBe(2);
    expect(stats.winsByAttempt[2]).toBe(1);
  });
});
