import assert from "node:assert/strict";
import test, {afterEach} from "node:test";
import * as firestoreAdmin from "firebase-admin/firestore";
import {MediaDetail, MediaSummary, TvSeasonDetail} from "../models/media";
import {
  autoPuzzleService,
  buildAutoPuzzleHints,
  buildChoicesFromTitles,
  suggestDistractorsForShow,
} from "./autoPuzzleService";
import {puzzleService} from "./puzzleService";
import {tmdbService} from "./tmdbService";

const sampleDetail = (overrides: Partial<MediaDetail> = {}): MediaDetail => ({
  id: 1,
  mediaType: "tv",
  title: "Severance",
  overview: "",
  releaseDate: "2022-02-18",
  voteAverage: 8,
  popularity: 100,
  images: {poster: null, backdrop: null},
  genres: [
    {id: 18, name: "Drama"},
    {id: 878, name: "Sci-Fi & Fantasy"},
  ],
  runtimeMinutes: null,
  status: "Returning Series",
  originalLanguage: "en",
  homepage: null,
  seasons: [
    {id: 10, seasonNumber: 0, title: "Specials", episodeCount: 1, airDate: null, poster: null},
    {id: 11, seasonNumber: 1, title: "Season 1", episodeCount: 9, airDate: "2022-02-18", poster: null},
  ],
  ...overrides,
});

const sampleSummary = (overrides: Partial<MediaSummary> = {}): MediaSummary => ({
  id: 1,
  mediaType: "tv",
  title: "Severance",
  overview: "",
  releaseDate: "2022-02-18",
  voteAverage: 8,
  popularity: 100,
  images: {poster: null, backdrop: null},
  ...overrides,
});

const sampleSeason = (): TvSeasonDetail => ({
  id: 11,
  tvId: 1,
  seasonNumber: 1,
  title: "Season 1",
  overview: "",
  airDate: "2022-02-18",
  poster: null,
  episodeCount: 2,
  episodes: [
    {
      id: 100,
      episodeKey: "s1e1",
      seasonNumber: 1,
      episodeNumber: 1,
      title: "Good News About Hell",
      overview: "",
      airDate: "2022-02-18",
      runtimeMinutes: 40,
      still: null,
      voteAverage: 8,
    },
    {
      id: 101,
      episodeKey: "s1e0",
      seasonNumber: 1,
      episodeNumber: 0,
      title: "Special",
      overview: "",
      airDate: null,
      runtimeMinutes: null,
      still: null,
      voteAverage: 0,
    },
  ],
});

const originalGetFirestore = firestoreAdmin.getFirestore;
const originalTvDetail = tmdbService.tvDetail;
const originalTvSeasonDetail = tmdbService.tvSeasonDetail;
const originalTvEpisodeImages = tmdbService.tvEpisodeImages;
const originalTrendingTv = tmdbService.trendingTv;
const originalSearch = tmdbService.search;
const originalUpsertPuzzle = puzzleService.upsertPuzzle;

afterEach(() => {
  (firestoreAdmin as {getFirestore: typeof originalGetFirestore}).getFirestore = originalGetFirestore;
  tmdbService.tvDetail = originalTvDetail;
  tmdbService.tvSeasonDetail = originalTvSeasonDetail;
  tmdbService.tvEpisodeImages = originalTvEpisodeImages;
  tmdbService.trendingTv = originalTrendingTv;
  tmdbService.search = originalSearch;
  puzzleService.upsertPuzzle = originalUpsertPuzzle;
});

const mockPrivateDoc = (exists: boolean) => {
  (firestoreAdmin as {getFirestore: typeof originalGetFirestore}).getFirestore = (() =>
    ({
      collection: () => ({
        doc: () => ({
          get: async () => ({exists}),
        }),
      }),
    }) as unknown) as typeof originalGetFirestore;
};

test("buildAutoPuzzleHints includes year and all genres", () => {
  const hints = buildAutoPuzzleHints(sampleDetail());
  assert.deepEqual(hints, [
    {revealAfterAttempt: 1, type: "year", value: "2022"},
    {revealAfterAttempt: 2, type: "genre", value: "Drama, Sci-Fi & Fantasy"},
  ]);
});

test("buildAutoPuzzleHints omits empty year or genres", () => {
  const hints = buildAutoPuzzleHints(
    sampleDetail({
      releaseDate: null,
      genres: [],
    }),
  );
  assert.deepEqual(hints, []);
});

test("buildChoicesFromTitles pads to four choices with correct first", () => {
  const choices = buildChoicesFromTitles("Severance", ["Silo", "FROM"]);
  assert.equal(choices.length, 4);
  assert.equal(choices[0]?.choiceId, "a");
  assert.equal(choices[0]?.title, "Severance");
  assert.equal(choices[1]?.title, "Silo");
  assert.equal(choices[2]?.title, "FROM");
  assert.equal(choices[3]?.title, "Option 4");
});

test("buildChoicesFromTitles keeps first four titles only", () => {
  const choices = buildChoicesFromTitles("A", ["B", "C", "D", "E"]);
  assert.deepEqual(
    choices.map((choice) => choice.title),
    ["A", "B", "C", "D"],
  );
});

test("suggestDistractorsForShow ranks unique search and trending candidates", async () => {
  tmdbService.tvDetail = async () => sampleDetail({id: 10, title: "The Bear: Kitchen"});
  tmdbService.search = async () => ({
    movies: {page: 1, totalPages: 1, totalResults: 0, results: []},
    tv: {
      page: 1,
      totalPages: 1,
      totalResults: 2,
      results: [
        sampleSummary({id: 10, title: "The Bear"}),
        sampleSummary({id: 20, title: "The Bearish", releaseDate: "2021-01-01", popularity: 50}),
      ],
    },
  });
  tmdbService.trendingTv = async () => ({
    page: 1,
    totalPages: 1,
    totalResults: 2,
    results: [
      sampleSummary({id: 20, title: "The Bearish", releaseDate: "2021-01-01", popularity: 50}),
      sampleSummary({id: 30, title: "Chef Show", releaseDate: null, popularity: 40}),
    ],
  });

  const result = await suggestDistractorsForShow(10);
  assert.equal(result.answer.id, 10);
  assert.equal(result.answer.title, "The Bear: Kitchen");
  assert.ok(result.distractors.length <= 3);
  assert.ok(result.distractors.every((item) => item.id !== 10));
});

test("ensureTodayPuzzle returns exists when a private puzzle doc is present", async () => {
  mockPrivateDoc(true);
  const result = await autoPuzzleService.ensureTodayPuzzle(new Date("2026-07-23T10:00:00+08:00"));
  assert.deepEqual(result, {created: false, puzzleDate: "2026-07-23", reason: "exists"});
});

test("ensureTodayPuzzle creates a published puzzle from trending stills", async () => {
  mockPrivateDoc(false);
  tmdbService.trendingTv = async (page = 1) => ({
    page,
    totalPages: 2,
    totalResults: 2,
    results: [sampleSummary({id: page === 1 ? 1 : 2, title: page === 1 ? "Severance" : "Silo"})],
  });
  tmdbService.tvDetail = async (id) =>
    sampleDetail({
      id,
      title: id === 1 ? "Severance" : "Silo",
      releaseDate: id === 1 ? "2022-02-18" : null,
      genres: id === 1 ? [{id: 18, name: "Drama"}] : [],
    });
  tmdbService.tvSeasonDetail = async () => sampleSeason();
  tmdbService.tvEpisodeImages = async () => [
    {filePath: "/still.jpg", width: 1280, height: 720, aspectRatio: 16 / 9, voteAverage: 5},
  ];
  tmdbService.search = async () => ({
    movies: {page: 1, totalPages: 1, totalResults: 0, results: []},
    tv: {
      page: 1,
      totalPages: 1,
      totalResults: 1,
      results: [sampleSummary({id: 99, title: "Other Show", popularity: 10})],
    },
  });
  puzzleService.upsertPuzzle = async (input) => {
    assert.equal(input.status, "published");
    assert.equal(input.correctChoiceId, "a");
    assert.equal(input.choices.length, 4);
    assert.ok(input.imageUrl.includes("still.jpg"));
    return {puzzleId: input.puzzleDate};
  };

  const result = await autoPuzzleService.ensureTodayPuzzle(new Date("2026-07-23T10:00:00+08:00"));
  assert.equal(result.created, true);
  if (result.created) {
    assert.equal(result.puzzleDate, "2026-07-23");
    assert.equal(result.puzzleId, "2026-07-23");
  }
});

test("ensureTodayPuzzle skips shows without usable seasons or stills then exhausts", async () => {
  mockPrivateDoc(false);
  tmdbService.trendingTv = async () => ({
    page: 1,
    totalPages: 1,
    totalResults: 2,
    results: [sampleSummary({id: 1}), sampleSummary({id: 2})],
  });
  tmdbService.tvDetail = async (id) =>
    sampleDetail({
      id,
      seasons:
        id === 1
          ? [{id: 1, seasonNumber: 0, title: "Specials", episodeCount: 3, airDate: null, poster: null}]
          : [{id: 2, seasonNumber: 1, title: "Season 1", episodeCount: 1, airDate: null, poster: null}],
    });
  tmdbService.tvSeasonDetail = async () => ({
    ...sampleSeason(),
    episodes: [
      {
        id: 1,
        episodeKey: "s1e1",
        seasonNumber: 1,
        episodeNumber: 1,
        title: "Pilot",
        overview: "",
        airDate: null,
        runtimeMinutes: null,
        still: null,
        voteAverage: 0,
      },
    ],
  });
  tmdbService.tvEpisodeImages = async () => [];

  const result = await autoPuzzleService.ensureTodayPuzzle(new Date("2026-07-23T10:00:00+08:00"));
  assert.deepEqual(result, {created: false, puzzleDate: "2026-07-23", reason: "exhausted"});
});

test("ensureTodayPuzzle continues after a failed show attempt", async () => {
  mockPrivateDoc(false);
  let detailCalls = 0;
  tmdbService.trendingTv = async () => ({
    page: 1,
    totalPages: 1,
    totalResults: 2,
    results: [sampleSummary({id: 1}), sampleSummary({id: 2, title: "Silo"})],
  });
  tmdbService.tvDetail = async (id) => {
    detailCalls += 1;
    if (id === 1 && detailCalls === 1) {
      throw new Error("TMDb timeout");
    }
    return sampleDetail({id, title: id === 2 ? "Silo" : "Severance"});
  };
  tmdbService.tvSeasonDetail = async () => sampleSeason();
  tmdbService.tvEpisodeImages = async () => [
    {filePath: "/ok.jpg", width: 800, height: 450, aspectRatio: 16 / 9, voteAverage: 1},
  ];
  tmdbService.search = async () => ({
    movies: {page: 1, totalPages: 1, totalResults: 0, results: []},
    tv: {page: 1, totalPages: 1, totalResults: 0, results: []},
  });
  puzzleService.upsertPuzzle = async (input) => ({puzzleId: input.puzzleDate});

  const result = await autoPuzzleService.ensureTodayPuzzle(new Date("2026-07-23T10:00:00+08:00"));
  assert.equal(result.created, true);
});
