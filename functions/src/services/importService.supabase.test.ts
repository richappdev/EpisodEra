import assert from "node:assert/strict";
import test, {afterEach} from "node:test";

import {AddWatchlistItemInput, WatchlistItem} from "../models/watchlist";
import {importService} from "./importService";
import {progressService} from "./progressService";
import {watchlistService} from "./watchlistService";

const previousFetch = globalThis.fetch;
const importId = "11111111-1111-1111-1111-111111111111";

const importRow = (status: string) => ({
  id: importId,
  firebase_uid: "smoke-user",
  provider: "tv_time",
  status,
  summary: {
    sourceHash: "smoke-import",
    watchlistStaged: 1,
    episodesStaged: 1,
    watchlistImported: 0,
    episodesImported: 0,
    episodesSkipped: 0,
    episodesFailed: 0,
    errorMessage: null,
    completedAt: null,
  },
  created_at: "2026-08-08T00:00:00.000Z",
  updated_at: "2026-08-08T00:00:00.000Z",
});

afterEach(() => {
  globalThis.fetch = previousFetch;
  for (const name of [
    "FIRESTORE_WRITES_DISABLED",
    "SUPABASE_READ_IMPORT_STAGING",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_URL",
    "SUPABASE_WRITE_PRIMARY",
  ]) {
    delete process.env[name];
  }
});

test("commit uses the Supabase import job when Firestore persistence is disabled", async () => {
  process.env.FIRESTORE_WRITES_DISABLED = "true";
  process.env.SUPABASE_READ_IMPORT_STAGING = "true";
  process.env.SUPABASE_WRITE_PRIMARY = "true";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(40);

  let status = "draft";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(`/imports?id=eq.${importId}`) && (init?.method ?? "GET") === "GET") {
      return new Response(JSON.stringify([importRow(status)]), {status: 200});
    }
    if (url.includes("/imports?on_conflict=id") && init?.method === "POST") {
      const rows = JSON.parse(String(init.body)) as Array<{status?: string}>;
      status = rows[0]?.status ?? status;
      return new Response(null, {status: 201});
    }
    return new Response(null, {status: 200});
  }) as typeof fetch;

  const summary = await importService.commit("smoke-user", importId);

  assert.equal(summary.status, "staged");
  assert.equal(summary.watchlistStaged, 1);
  assert.equal(summary.episodesStaged, 1);
});

test("create writes a Supabase import without opening Firestore when persistence is disabled", async () => {
  process.env.FIRESTORE_WRITES_DISABLED = "true";
  process.env.SUPABASE_WRITE_PRIMARY = "true";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(40);

  let wroteImport = false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/imports?on_conflict=id") && init?.method === "POST") {
      wroteImport = true;
      return new Response(null, {status: 201});
    }
    return new Response(null, {status: 200});
  }) as typeof fetch;

  const summary = await importService.create("smoke-user", "tv_time", "source-hash");

  assert.equal(summary.status, "draft");
  assert.equal(summary.sourceHash, "source-hash");
  assert.equal(wroteImport, true);
});

test("watchlist staging updates Supabase counters when Firestore persistence is disabled", async () => {
  process.env.FIRESTORE_WRITES_DISABLED = "true";
  process.env.SUPABASE_READ_IMPORT_STAGING = "true";
  process.env.SUPABASE_WRITE_PRIMARY = "true";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(40);

  const row = importRow("draft");
  row.summary.watchlistStaged = 0;
  row.summary.episodesStaged = 0;
  let stagedShow = false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(`/imports?id=eq.${importId}`) && (init?.method ?? "GET") === "GET") {
      return new Response(JSON.stringify([row]), {status: 200});
    }
    if (url.includes("/rpc/upsert_import_staged_show")) {
      stagedShow = true;
      return new Response(null, {status: 200});
    }
    return new Response(null, {status: url.includes("/imports?on_conflict=id") ? 201 : 200});
  }) as typeof fetch;

  const summary = await importService.stageWatchlist("smoke-user", importId, [{
    tmdbId: 125988,
    mediaType: "tv",
    title: "Smoke Show",
    status: "planned",
  }]);

  assert.equal(summary.watchlistStaged, 1);
  assert.equal(stagedShow, true);
});

test("staging updates Supabase import counters when Firestore persistence is disabled", async () => {
  process.env.FIRESTORE_WRITES_DISABLED = "true";
  process.env.SUPABASE_READ_IMPORT_STAGING = "true";
  process.env.SUPABASE_WRITE_PRIMARY = "true";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(40);

  const row = importRow("draft");
  row.summary.watchlistStaged = 0;
  row.summary.episodesStaged = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(`/imports?id=eq.${importId}`) && (init?.method ?? "GET") === "GET") {
      return new Response(JSON.stringify([row]), {status: 200});
    }
    return new Response(null, {status: url.includes("/imports?on_conflict=id") ? 201 : 200});
  }) as typeof fetch;

  const summary = await importService.stageEpisodes("smoke-user", importId, [{
    tmdbId: 125988,
    seasonNumber: 1,
    episodeNumber: 1,
  }]);

  assert.equal(summary.status, "draft");
  assert.equal(summary.episodesStaged, 1);
});

test("run completes and clears Supabase staging when Firestore persistence is disabled", async (t) => {
  process.env.FIRESTORE_WRITES_DISABLED = "true";
  process.env.SUPABASE_READ_IMPORT_STAGING = "true";
  process.env.SUPABASE_WRITE_PRIMARY = "true";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(40);

  let status = "staged";
  let episodeStatus = "pending";
  let stagingCleared = false;
  let latestSummary = importRow(status).summary;
  t.mock.method(progressService, "importWatchedEpisodes", async () => ({
    imported: 1,
    skipped: 0,
    failedKeys: [],
    skippedKeys: [],
    importedKeys: ["s1e1"],
  }));

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.includes(`/imports?id=eq.${importId}`) && (init?.method ?? "GET") === "GET") {
      return new Response(JSON.stringify([{...importRow(status), summary: latestSummary}]), {status: 200});
    }
    if (url.includes("/imports?on_conflict=id") && init?.method === "POST") {
      const rows = body as unknown as Array<{status?: string; summary?: typeof latestSummary}>;
      status = rows[0]?.status ?? status;
      latestSummary = rows[0]?.summary ?? latestSummary;
      return new Response(null, {status: 201});
    }
    if (url.includes("/rpc/list_import_staged_shows")) {
      return new Response(JSON.stringify([]), {status: 200});
    }
    if (url.includes("/rpc/list_import_staged_episodes")) {
      if (stagingCleared || (body.p_status === "pending" && episodeStatus !== "pending")) {
        return new Response(JSON.stringify([]), {status: 200});
      }
      return new Response(JSON.stringify([{
        show_tmdb_id: 125988,
        season_number: 1,
        episode_number: 1,
        status: episodeStatus,
        payload: {tmdbId: 125988, seasonNumber: 1, episodeNumber: 1, status: episodeStatus},
      }]), {status: 200});
    }
    if (url.includes("/rpc/upsert_import_staged_episode")) {
      episodeStatus = String(body.p_status);
      return new Response(null, {status: 200});
    }
    if (url.includes("/rpc/delete_import_staged")) {
      stagingCleared = true;
      return new Response(JSON.stringify(1), {status: 200});
    }
    return new Response(null, {status: 200});
  }) as typeof fetch;

  const result = await importService.run("smoke-user", importId, 1);

  assert.equal(result.done, true);
  assert.equal(result.import.status, "completed");
  assert.equal(result.import.episodesImported, 1);
  assert.equal(result.import.stagingDocsDeleted, 1);
  assert.match(result.import.stagingClearedAt ?? "", /^\d{4}-/);
  assert.equal(stagingCleared, true);
});

test("run processes Supabase shows and reports skipped and failed episodes", async (t) => {
  process.env.FIRESTORE_WRITES_DISABLED = "true";
  process.env.SUPABASE_READ_IMPORT_STAGING = "true";
  process.env.SUPABASE_WRITE_PRIMARY = "true";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(40);

  let status = "staged";
  let showImported = false;
  let stagingCleared = false;
  const episodeStatuses = new Map([[1, "pending"], [2, "pending"]]);
  let latestSummary: Record<string, unknown> = {
    ...importRow(status).summary,
    watchlistStaged: 1,
    episodesStaged: 2,
    mappingSkippedShows: [{title: "Unknown Show", sourceShowId: "legacy-1", reason: "unresolved"}],
  };
  t.mock.method(watchlistService, "mergeImport", async (
    _userId: string,
    input: AddWatchlistItemInput,
  ): Promise<WatchlistItem> => ({
    itemId: `tv_${input.tmdbId}`,
    tmdbId: input.tmdbId,
    mediaType: input.mediaType,
    title: input.title,
    poster: input.poster ?? null,
    backdrop: input.backdrop ?? null,
    status: input.status ?? "planned",
    addedAt: null,
    updatedAt: null,
  }));
  t.mock.method(progressService, "importWatchedEpisodes", async () => ({
    imported: 0,
    skipped: 1,
    failedKeys: ["s01e02"],
    skippedKeys: ["s01e01"],
    importedKeys: [],
  }));

  const episodeRow = (episodeNumber: number) => ({
    show_tmdb_id: 125988,
    season_number: 1,
    episode_number: episodeNumber,
    status: episodeStatuses.get(episodeNumber),
    payload: {
      tmdbId: 125988,
      seasonNumber: 1,
      episodeNumber,
      status: episodeStatuses.get(episodeNumber),
      sourceShowId: "source-show",
    },
  });

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.includes(`/imports?id=eq.${importId}`) && (init?.method ?? "GET") === "GET") {
      return new Response(JSON.stringify([{...importRow(status), summary: latestSummary}]), {status: 200});
    }
    if (url.includes("/imports?on_conflict=id") && init?.method === "POST") {
      const rows = body as unknown as Array<{status?: string; summary?: Record<string, unknown>}>;
      status = rows[0]?.status ?? status;
      latestSummary = rows[0]?.summary ?? latestSummary;
      return new Response(null, {status: 201});
    }
    if (url.includes("/rpc/list_import_staged_shows")) {
      const rows = stagingCleared || (body.p_imported_only === false && showImported) ? [] : [{
        media_type: "tv",
        tmdb_id: 125988,
        status: "watching",
        payload: {tmdbId: 125988, mediaType: "tv", title: "Smoke Show", status: "watching", imported: showImported},
      }];
      return new Response(JSON.stringify(rows), {status: 200});
    }
    if (url.includes("/rpc/upsert_import_staged_show")) {
      const payload = body.p_payload as Record<string, unknown>;
      showImported = payload.imported === true;
      return new Response(null, {status: 200});
    }
    if (url.includes("/rpc/list_import_staged_episodes")) {
      const rows = stagingCleared ? [] : [episodeRow(1), episodeRow(2)]
        .filter((row) => body.p_status == null || row.status === body.p_status)
        .slice(0, Number(body.p_limit ?? 500));
      return new Response(JSON.stringify(rows), {status: 200});
    }
    if (url.includes("/rpc/upsert_import_staged_episode")) {
      episodeStatuses.set(Number(body.p_episode_number), String(body.p_status));
      return new Response(null, {status: 200});
    }
    if (url.includes("/rpc/delete_import_staged")) {
      stagingCleared = true;
      return new Response(JSON.stringify(3), {status: 200});
    }
    return new Response(null, {status: 200});
  }) as typeof fetch;

  const result = await importService.run("smoke-user", importId, 2);

  assert.equal(result.done, true);
  assert.equal(result.import.watchlistImported, 1);
  assert.equal(result.import.episodesSkipped, 1);
  assert.equal(result.import.episodesFailed, 1);
  assert.equal(result.import.report?.skippedShowCount, 1);
  assert.deepEqual(result.import.report?.rows.map((row) => row.kind), [
    "skipped_show",
    "skipped_episode",
    "failed_episode",
  ]);
});
