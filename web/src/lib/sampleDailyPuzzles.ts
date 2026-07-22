import {SamplePuzzle} from "../types/dailyPuzzle";
import {nextUtcMidnightIso, utcPuzzleDate} from "./dailyPuzzleLogic";

const today = utcPuzzleDate();

/** Phase 1 sample set — answers stay client-side only in sample mode. */
export const sampleDailyPuzzles: SamplePuzzle[] = [
  {
    puzzleId: today,
    puzzleDate: today,
    imageUrl: "https://image.tmdb.org/t/p/w1280/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    mobileImageUrl: "https://image.tmdb.org/t/p/w780/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    choices: [
      {choiceId: "a", title: "Ozark"},
      {choiceId: "b", title: "Breaking Bad"},
      {choiceId: "c", title: "Narcos"},
      {choiceId: "d", title: "Better Call Saul"},
    ],
    maxAttempts: 3,
    nextPuzzleAt: nextUtcMidnightIso(today),
    locale: "en-US",
    correctChoiceId: "b",
    correctShowId: 1396,
    seasonNumber: 3,
    episodeNumber: 7,
    hints: [
      {revealAfterAttempt: 1, type: "year", value: "2008"},
      {revealAfterAttempt: 2, type: "genre", value: "Crime drama"},
    ],
  },
  {
    puzzleId: "sample-2",
    puzzleDate: "sample-2",
    imageUrl: "https://image.tmdb.org/t/p/w1280/9EnfMH0nQiJpXW7NBsb116zLyZc.jpg",
    choices: [
      {choiceId: "a", title: "The Office"},
      {choiceId: "b", title: "Parks and Recreation"},
      {choiceId: "c", title: "Brooklyn Nine-Nine"},
      {choiceId: "d", title: "Superstore"},
    ],
    maxAttempts: 3,
    nextPuzzleAt: nextUtcMidnightIso(today),
    locale: "en-US",
    correctChoiceId: "a",
    correctShowId: 2316,
    seasonNumber: 2,
    episodeNumber: 1,
    hints: [
      {revealAfterAttempt: 1, type: "country", value: "United States"},
      {revealAfterAttempt: 2, type: "cast", value: "Steve Carell"},
    ],
  },
  {
    puzzleId: "sample-3",
    puzzleDate: "sample-3",
    imageUrl: "https://image.tmdb.org/t/p/w1280/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg",
    choices: [
      {choiceId: "a", title: "Stranger Things"},
      {choiceId: "b", title: "Dark"},
      {choiceId: "c", title: "The OA"},
      {choiceId: "d", title: "Locke & Key"},
    ],
    maxAttempts: 3,
    nextPuzzleAt: nextUtcMidnightIso(today),
    locale: "en-US",
    correctChoiceId: "a",
    correctShowId: 66732,
    seasonNumber: 1,
    episodeNumber: 1,
    hints: [
      {revealAfterAttempt: 1, type: "year", value: "2016"},
      {revealAfterAttempt: 2, type: "network", value: "Netflix"},
    ],
  },
];

export const getSamplePuzzleForToday = (): SamplePuzzle => sampleDailyPuzzles[0];
