import assert from "node:assert/strict";
import test from "node:test";
import {emptyUserGameStats} from "../models/puzzle";
import {
  buildOpaqueImageUrls,
  calendarDateInTimeZone,
  computeStreakUpdate,
  hintForAttempt,
  nextUtcMidnightIso,
  rankDistractors,
  utcPuzzleDate,
} from "./puzzleLogic";

test("utcPuzzleDate and nextUtcMidnightIso", () => {
  assert.equal(utcPuzzleDate(new Date("2026-07-21T23:59:00.000Z")), "2026-07-21");
  assert.equal(nextUtcMidnightIso("2026-07-21"), "2026-07-22T00:00:00.000Z");
});

test("calendarDateInTimeZone uses Asia/Taipei calendar day", () => {
  // 06:00 Taipei on Jul 23 == 22:00 UTC on Jul 22
  assert.equal(calendarDateInTimeZone(new Date("2026-07-22T22:00:00.000Z"), "Asia/Taipei"), "2026-07-23");
  // Still Jul 22 in Taipei just before midnight
  assert.equal(calendarDateInTimeZone(new Date("2026-07-22T15:59:00.000Z"), "Asia/Taipei"), "2026-07-22");
});

test("hintForAttempt returns matching hint", () => {
  const hints = [
    {revealAfterAttempt: 1, type: "year" as const, value: "2008"},
    {revealAfterAttempt: 2, type: "genre" as const, value: "Crime"},
  ];
  assert.equal(hintForAttempt(hints, 1)?.value, "2008");
  assert.equal(hintForAttempt(hints, 3), null);
});

test("computeStreakUpdate increments consecutive wins", () => {
  const updated = computeStreakUpdate({
    stats: {
      ...emptyUserGameStats(),
      gamesPlayed: 1,
      gamesWon: 1,
      currentStreak: 1,
      longestStreak: 1,
      lastPlayedPuzzleDate: "2026-07-20",
    },
    puzzleDate: "2026-07-21",
    won: true,
    attemptCount: 2,
  });
  assert.equal(updated.currentStreak, 2);
  assert.equal(updated.winsByAttempt[2], 1);
});

test("rankDistractors prefers similar shows", () => {
  const answer = {
    id: 1,
    title: "Breaking Bad",
    genreIds: [18, 80],
    releaseYear: 2008,
    popularity: 100,
    originCountry: "US",
    networkOrProvider: "AMC",
  };
  const ranked = rankDistractors(answer, [
    {
      id: 2,
      title: "Better Call Saul",
      genreIds: [18, 80],
      releaseYear: 2015,
      popularity: 90,
      originCountry: "US",
      networkOrProvider: "AMC",
    },
    {
      id: 3,
      title: "Friends",
      genreIds: [35],
      releaseYear: 1994,
      popularity: 200,
      originCountry: "US",
    },
  ]);
  assert.equal(ranked[0]?.title, "Better Call Saul");
});

test("buildOpaqueImageUrls keeps TMDB path opaque", () => {
  const urls = buildOpaqueImageUrls("/abc123.jpg");
  assert.equal(urls.desktopUrl.includes("abc123.jpg"), true);
  assert.equal(urls.desktopUrl.includes("breaking"), false);
});
