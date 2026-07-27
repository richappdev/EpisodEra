import test, {afterEach} from "node:test";
import assert from "node:assert/strict";

import {
  deleteImportStagedShadow,
  deleteUserOwnedOrphansShadow,
  getDerivedCacheShadow,
  invalidateDerivedCacheShadow,
  markEpisodesWatchedPrimary,
  patchShowProgressNextEpisode,
  removeFriendshipShadow,
  removeHistoryShadow,
  removeLikeShadow,
  removeWatchlistShadow,
  upsertDiscussionCommentShadow,
  upsertDerivedCacheShadow,
  upsertFranchiseShadow,
  upsertFriendshipShadow,
  upsertGameConfigShadow,
  upsertHistoryShadow,
  upsertImportShadow,
  upsertImportStagedEpisodeShadow,
  upsertImportStagedShowShadow,
  upsertLikeShadow,
  upsertMediaMappingShadow,
  upsertProfileShadow,
  upsertPuzzleAttemptShadow,
  upsertPuzzleShadow,
  upsertSettingsShadow,
  upsertShowProgressShadow,
  upsertUserGameStatsShadow,
  upsertWatchlistShadow,
} from "./supabaseWriters";

const previousFetch = globalThis.fetch;
const calls: Array<{url: string; method: string}> = [];

const installFetchStub = (rpcPayload: unknown = null) => {
  calls.length = 0;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(40);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({url, method});
    if (url.includes("/rpc/")) {
      return new Response(JSON.stringify(rpcPayload), {status: 200});
    }
    return new Response(null, {status: 201});
  }) as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = previousFetch;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  calls.length = 0;
});

test("library and remaining-domain writers post expected tables and RPCs", async () => {
  installFetchStub({
    payload: {ok: true},
    computed_at: "2026-07-27T00:00:00.000Z",
    invalidated_at: null,
  });

  await upsertProfileShadow("u1", {
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: "Ada",
    email: "ada@example.com",
    photoURL: null,
    bio: null,
    country: "us",
    timezone: "UTC",
    friendCode: "ABC123",
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
  });
  await upsertSettingsShadow("u1", {
    language: "en-US",
    preferredProviderIds: [],
    watchRegion: "US",
    autoMarkPreviousEpisodesWatched: true,
    achievementsEnabled: true,
    showAchievementsOnProfile: true,
    shareActivityWithFriends: true,
    allowFriendRequests: true,
    hideSpoilersUntilWatched: true,
    updatedAt: "2026-07-27T00:00:00.000Z",
  });
  await upsertWatchlistShadow("u1", {
    itemId: "movie_1",
    tmdbId: 1,
    mediaType: "movie",
    title: "Movie",
    poster: null,
    backdrop: null,
    status: "unwatched",
    addedAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
  });
  await removeWatchlistShadow("u1", "movie", 1);
  await upsertLikeShadow("u1", {
    itemId: "movie_1",
    tmdbId: 1,
    mediaType: "movie",
    title: "Movie",
    poster: null,
    backdrop: null,
    likedAt: "2026-07-27T00:00:00.000Z",
  });
  await removeLikeShadow("u1", "movie", 1);
  await upsertShowProgressShadow("u1", {
    showId: "tv_10",
    tmdbId: 10,
    title: "Show",
    poster: null,
    totalEpisodes: 2,
    watchedEpisodeCount: 1,
    progressPercent: 50,
    currentSeason: 1,
    currentEpisode: 1,
    nextEpisode: {seasonNumber: 1, episodeNumber: 2, episodeTitle: "E2", episodeKey: "s01e02"},
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: "E1",
        episodeKey: "s01e01",
        watched: true,
        watchedAt: "2026-07-27T00:00:00.000Z",
        updatedAt: "2026-07-27T00:00:00.000Z",
      },
    ],
    updatedAt: "2026-07-27T00:00:00.000Z",
  });
  await upsertHistoryShadow("u1", {
    historyId: "movie_1",
    tmdbId: 1,
    mediaType: "movie",
    title: "Movie",
    seasonNumber: null,
    episodeNumber: null,
    episodeTitle: null,
    watchedAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    rewatchCount: 0,
    genreNames: [],
    runtimeMinutes: 90,
  });
  await removeHistoryShadow("u1", "movie_1");
  await upsertFriendshipShadow("u1", "u2", "accepted", "Friend", "XYZ789");
  await removeFriendshipShadow("u1", "u2");
  await upsertDerivedCacheShadow("u1", "stats", {total: 1});
  await invalidateDerivedCacheShadow("u1");
  const derived = await getDerivedCacheShadow("u1", "stats");
  assert.deepEqual(derived?.payload, {ok: true});
  await markEpisodesWatchedPrimary({
    firebaseUid: "u1",
    showTmdbId: 10,
    title: "Show",
    posterPath: null,
    totalEpisodes: 2,
    episodes: [{season_number: 1, episode_number: 1, episode_title: "E1", watched: true}],
  });
  await patchShowProgressNextEpisode("u1", 10, {
    seasonNumber: 1,
    episodeNumber: 2,
    episodeTitle: "E2",
  });

  await upsertDiscussionCommentShadow({
    commentId: "c1",
    userId: "u1",
    displayName: "Viewer",
    body: "hello",
    mediaType: "tv",
    tmdbId: 1,
    seasonNumber: 1,
    episodeNumber: 2,
    createdAt: "2026-07-27T00:00:00.000Z",
  });
  await upsertMediaMappingShadow({
    provider: "tv_time",
    mediaType: "tv",
    externalId: "abc",
    tmdbId: 10,
    title: "Show",
    updatedBy: "u1",
  });
  await upsertFranchiseShadow({
    slug: "demo",
    title: "Demo",
    description: "desc",
    published: true,
    sortOrder: 1,
    phases: [],
    titles: [],
  });
  await upsertPuzzleShadow({
    puzzleId: "2026-07-27",
    puzzleDate: "2026-07-27",
    publicPayload: {id: "2026-07-27"},
    answer: {correctChoiceId: "a"},
    hints: [],
    status: "published",
    imageAsset: null,
    publishedAt: "2026-07-27T00:00:00.000Z",
  });
  await upsertPuzzleAttemptShadow("uid:u1", "2026-07-27", {attemptCount: 1});
  await upsertUserGameStatsShadow("u1", {
    currentStreak: 1,
    maxStreak: 2,
    wins: 3,
    plays: 4,
    payload: {winsByAttempt: {1: 1}},
  });
  await upsertGameConfigShadow("dailyPuzzle", {lastPublishedIds: ["2026-07-27"]});
  await upsertImportShadow("u1", {
    importId: "11111111-1111-1111-1111-111111111111",
    provider: "tv_time",
    status: "draft",
  });
  await upsertImportStagedShowShadow("11111111-1111-1111-1111-111111111111", {
    mediaType: "tv",
    tmdbId: 1,
    status: "pending",
    payload: {title: "Show"},
  });
  await upsertImportStagedEpisodeShadow("11111111-1111-1111-1111-111111111111", {
    showTmdbId: 1,
    seasonNumber: 1,
    episodeNumber: 1,
    status: "pending",
    payload: {},
  });
  await deleteImportStagedShadow("11111111-1111-1111-1111-111111111111");
  await deleteUserOwnedOrphansShadow("u1");

  const urls = calls.map((call) => call.url).join("\n");
  assert.match(urls, /profiles/);
  assert.match(urls, /user_settings/);
  assert.match(urls, /watchlist_items/);
  assert.match(urls, /likes/);
  assert.match(urls, /show_progress/);
  assert.match(urls, /watch_history/);
  assert.match(urls, /friendships/);
  assert.match(urls, /upsert_derived_cache/);
  assert.match(urls, /mark_episodes_watched/);
  assert.match(urls, /discussion_comments/);
  assert.match(urls, /media_mappings/);
  assert.match(urls, /franchises/);
  assert.match(urls, /puzzles_public/);
  assert.match(urls, /upsert_puzzle_private/);
  assert.match(urls, /puzzle_attempts/);
  assert.match(urls, /user_game_stats/);
  assert.match(urls, /upsert_game_config/);
  assert.match(urls, /upsert_import_staged_show/);
  assert.match(urls, /delete_import_staged/);
});

test("deleteUserOwnedOrphansShadow no-ops without supabase env", async () => {
  await deleteUserOwnedOrphansShadow("u1");
  assert.equal(calls.length, 0);
});

test("getDerivedCacheShadow returns null without supabase env", async () => {
  assert.equal(await getDerivedCacheShadow("u1", "stats"), null);
});
