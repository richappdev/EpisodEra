/**
 * Sync Supabase library domains → Firestore (catch-up when Firestore mirror was off).
 *
 * Covers: profiles, settings, watchlist, likes, progress+episodes, history, friendships,
 * derived cache keys, plus optional remaining domains (discussions, puzzles, franchises,
 * media mappings) when `--include-remaining` is set.
 *
 * Usage (repo root, with Firebase Admin ADC + functions/.env.supabase):
 *   node scripts/supabase/sync-supabase-to-firestore.mjs --dry-run
 *   node scripts/supabase/sync-supabase-to-firestore.mjs --uid <FIREBASE_UID>
 *   node scripts/supabase/sync-supabase-to-firestore.mjs --limit 20
 *   node scripts/supabase/sync-supabase-to-firestore.mjs --skip-derived
 *   node scripts/supabase/sync-supabase-to-firestore.mjs --include-remaining
 *
 * Import staging is not mirrored back to Firestore (ephemeral).
 */
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {loadEnvFiles, requireSupabaseEnv, supabaseRest, supabaseRpc} from "./lib/supabaseRest.mjs";
import {
  derivedDocFromSupabase,
  episodeDocFromSupabase,
  friendDocFromSupabase,
  historyDocFromSupabase,
  likeDocFromSupabase,
  profileDocFromSupabase,
  progressDocFromSupabase,
  settingsDocFromSupabase,
  watchlistDocFromSupabase,
} from "./lib/firestoreSyncTransform.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFiles(repoRoot);

const require = createRequire(path.join(repoRoot, "functions", "package.json"));
const {initializeApp, getApps} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");

const dryRun = process.argv.includes("--dry-run");
const skipDerived = process.argv.includes("--skip-derived");
const includeRemaining = process.argv.includes("--include-remaining");
const uidFilter = process.argv.includes("--uid")
  ? process.argv[process.argv.indexOf("--uid") + 1]
  : null;
const limit = process.argv.includes("--limit")
  ? Number(process.argv[process.argv.indexOf("--limit") + 1])
  : null;

if (!getApps().length) {
  initializeApp({
    projectId:
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT ||
      "episodera",
  });
}

const db = getFirestore();
const supabase = requireSupabaseEnv();
const pageSize = 100;

const toTimestamp = (value) => {
  if (value == null || value === "") {
    return null;
  }
  if (value instanceof Timestamp) {
    return value;
  }
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) {
    return null;
  }
  return Timestamp.fromDate(new Date(ms));
};

const withTimestamps = (data, fields) => {
  const next = {...data};
  for (const field of fields) {
    if (field in next) {
      next[field] = toTimestamp(next[field]);
    }
  }
  return next;
};

async function fetchAll(table, filters = "") {
  const rows = [];
  let offset = 0;
  for (;;) {
    const path =
      `${table}?select=*` +
      (filters ? `&${filters}` : "") +
      `&order=firebase_uid.asc&offset=${offset}&limit=${pageSize}`;
    const page = (await supabaseRest(supabase, path, {
      method: "GET",
      prefer: "return=representation",
    })) ?? [];
    if (!Array.isArray(page) || page.length === 0) {
      break;
    }
    rows.push(...page);
    if (page.length < pageSize) {
      break;
    }
    offset += pageSize;
  }
  return rows;
}

async function fetchForUid(table, uid, extraOrder = "") {
  const filter = `firebase_uid=eq.${encodeURIComponent(uid)}`;
  const rows = [];
  let offset = 0;
  for (;;) {
    const path =
      `${table}?${filter}&select=*` +
      (extraOrder ? `&order=${extraOrder}` : "") +
      `&offset=${offset}&limit=${pageSize}`;
    const page = (await supabaseRest(supabase, path, {
      method: "GET",
      prefer: "return=representation",
    })) ?? [];
    if (!Array.isArray(page) || page.length === 0) {
      break;
    }
    rows.push(...page);
    if (page.length < pageSize) {
      break;
    }
    offset += pageSize;
  }
  return rows;
}

async function listUids() {
  if (uidFilter) {
    return [uidFilter];
  }
  const profiles = await fetchAll("profiles");
  let uids = profiles.map((row) => row.firebase_uid).filter(Boolean);
  if (Number.isInteger(limit) && limit > 0) {
    uids = uids.slice(0, limit);
  }
  return uids;
}

async function syncUser(uid) {
  const summary = {
    uid,
    profile: 0,
    settings: 0,
    watchlist: 0,
    likes: 0,
    progress: 0,
    episodes: 0,
    history: 0,
    friends: 0,
    derived: 0,
  };

  const userRef = db.collection("users").doc(uid);

  const profiles = await fetchForUid("profiles", uid);
  const profile = profiles[0] ? profileDocFromSupabase(profiles[0]) : null;
  if (profile) {
    summary.profile = 1;
    if (!dryRun) {
      await userRef.set(
        withTimestamps(profile, ["createdAt", "updatedAt"]),
        {merge: true},
      );
    }
  }

  const settingsRows = await fetchForUid("user_settings", uid);
  const settings = settingsRows[0] ? settingsDocFromSupabase(settingsRows[0]) : null;
  if (settings) {
    summary.settings = 1;
    if (!dryRun) {
      await userRef.collection("settings").doc("profile").set(
        withTimestamps(settings, ["updatedAt"]),
        {merge: true},
      );
    }
  }

  for (const row of await fetchForUid("watchlist_items", uid, "updated_at.desc")) {
    const mapped = watchlistDocFromSupabase(row);
    if (!mapped) {
      continue;
    }
    summary.watchlist += 1;
    if (!dryRun) {
      await userRef.collection("watchlist").doc(mapped.itemId).set(
        withTimestamps(mapped.data, ["addedAt", "updatedAt"]),
        {merge: true},
      );
    }
  }

  for (const row of await fetchForUid("likes", uid, "liked_at.desc")) {
    const mapped = likeDocFromSupabase(row);
    if (!mapped) {
      continue;
    }
    summary.likes += 1;
    if (!dryRun) {
      await userRef.collection("likes").doc(mapped.itemId).set(
        withTimestamps(mapped.data, ["likedAt"]),
        {merge: true},
      );
    }
  }

  for (const row of await fetchForUid("show_progress", uid, "updated_at.desc")) {
    const mapped = progressDocFromSupabase(row);
    if (!mapped) {
      continue;
    }
    summary.progress += 1;
    if (!dryRun) {
      await userRef.collection("progress").doc(mapped.showId).set(
        withTimestamps(mapped.data, ["updatedAt"]),
        {merge: true},
      );
    }
  }

  for (const row of await fetchForUid(
    "watched_episodes",
    uid,
    "show_tmdb_id.asc,season_number.asc,episode_number.asc",
  )) {
    const mapped = episodeDocFromSupabase(row);
    if (!mapped) {
      continue;
    }
    summary.episodes += 1;
    if (!dryRun) {
      await userRef
        .collection("progress")
        .doc(mapped.showId)
        .collection("episodes")
        .doc(mapped.episodeKey)
        .set(withTimestamps(mapped.data, ["watchedAt", "updatedAt"]), {merge: true});
    }
  }

  for (const row of await fetchForUid("watch_history", uid, "watched_at.desc")) {
    const mapped = historyDocFromSupabase(row);
    if (!mapped) {
      continue;
    }
    summary.history += 1;
    if (!dryRun) {
      await userRef.collection("history").doc(mapped.historyId).set(
        withTimestamps(mapped.data, ["watchedAt", "updatedAt"]),
        {merge: true},
      );
    }
  }

  for (const row of await fetchForUid("friendships", uid, "updated_at.desc")) {
    const mapped = friendDocFromSupabase(row);
    if (!mapped) {
      continue;
    }
    summary.friends += 1;
    if (!dryRun) {
      await userRef.collection("friends").doc(mapped.friendUserId).set(
        withTimestamps(mapped.data, ["updatedAt"]),
        {merge: true},
      );
    }
  }

  if (!skipDerived) {
    const year = new Date().getUTCFullYear();
    const keys = ["stats", "achievements", `yearRecap_${year}`, `yearRecap_${year - 1}`];
    for (const cacheKey of keys) {
      let envelope = null;
      try {
        envelope = await supabaseRpc(
          supabase,
          "get_derived_cache",
          {p_firebase_uid: uid, p_cache_key: cacheKey},
          "return=representation",
        );
      } catch {
        continue;
      }
      const mapped = derivedDocFromSupabase(cacheKey, envelope);
      if (!mapped) {
        continue;
      }
      summary.derived += 1;
      if (!dryRun) {
        await userRef.collection("derived").doc(mapped.derivedId).set(
          withTimestamps(mapped.data, ["computedAt", "invalidatedAt"]),
          {merge: true},
        );
      }
    }
  }

  return summary;
}

const uids = await listUids();
const totals = {
  users: 0,
  profile: 0,
  settings: 0,
  watchlist: 0,
  likes: 0,
  progress: 0,
  episodes: 0,
  history: 0,
  friends: 0,
  derived: 0,
};

console.log(
  JSON.stringify(
    {
      dryRun,
      uidFilter,
      limit,
      skipDerived,
      includeRemaining,
      plannedUsers: uids.length,
    },
    null,
    2,
  ),
);

for (const uid of uids) {
  const summary = await syncUser(uid);
  totals.users += 1;
  for (const key of Object.keys(totals)) {
    if (key !== "users" && typeof summary[key] === "number") {
      totals[key] += summary[key];
    }
  }
  console.log(JSON.stringify(summary));
}

if (includeRemaining) {
  const remaining = {discussions: 0, puzzles: 0, mappings: 0, franchises: 0};

  async function fetchTable(table, order) {
    const rows = [];
    let offset = 0;
    for (;;) {
      const path = `${table}?select=*&order=${order}&offset=${offset}&limit=${pageSize}`;
      const page = (await supabaseRest(supabase, path, {
        method: "GET",
        prefer: "return=representation",
      })) ?? [];
      if (!Array.isArray(page) || page.length === 0) break;
      rows.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    return rows;
  }

  for (const row of await fetchTable("discussion_comments", "created_at.asc")) {
    const mediaType = row.media_type;
    const tmdbId = row.tmdb_id;
    const commentId = row.firestore_id || row.id;
    if (!mediaType || !tmdbId || !commentId) continue;
    const ref = db
      .collection("public")
      .doc("discussions")
      .collection(`${mediaType}_${tmdbId}`)
      .doc(String(commentId));
    if (!dryRun) {
      await ref.set(
        withTimestamps(
          {
            userId: row.author_firebase_uid,
            displayName: row.display_name ?? "Viewer",
            body: row.body,
            mediaType,
            tmdbId,
            seasonNumber: row.season_number ?? null,
            episodeNumber: row.episode_number ?? null,
            createdAt: row.created_at,
          },
          ["createdAt"],
        ),
        {merge: true},
      );
    }
    remaining.discussions += 1;
  }

  for (const row of await fetchTable("puzzles_public", "puzzle_date.asc")) {
    const payload = row.payload ?? {};
    if (!dryRun) {
      await db.collection("puzzlePublic").doc(row.puzzle_id).set(payload, {merge: true});
      const priv = await supabaseRpc(
        supabase,
        "get_puzzle_private",
        {p_puzzle_id: row.puzzle_id},
        "return=representation",
      );
      if (priv && typeof priv === "object") {
        const answer = priv.answer ?? {};
        await db.collection("puzzlePrivate").doc(row.puzzle_id).set(
          {
            puzzleId: row.puzzle_id,
            correctChoiceId: answer.correctChoiceId,
            correctShowId: answer.correctShowId,
            correctTitle: answer.correctTitle ?? null,
            hints: priv.hints ?? [],
            status: priv.status,
            difficulty: answer.difficulty ?? "medium",
            seasonNumber: answer.seasonNumber ?? null,
            episodeNumber: answer.episodeNumber ?? null,
            createdAt: answer.createdAt ?? null,
            updatedAt: priv.updated_at ?? null,
            publishedAt: answer.publishedAt ?? row.published_at ?? null,
            imageAsset: priv.image_asset ?? null,
          },
          {merge: true},
        );
      }
    }
    remaining.puzzles += 1;
  }

  for (const row of await fetchTable("media_mappings", "updated_at.asc")) {
    const raw = row.raw ?? {};
    const id = `${row.provider}_${row.media_type}_${row.external_id}`;
    if (!dryRun) {
      await db.collection("mediaMappings").doc(id).set(
        withTimestamps(
          {
            provider: row.provider,
            mediaType: row.media_type,
            externalId: row.external_id,
            tmdbId: row.tmdb_id,
            title: raw.title ?? null,
            updatedBy: raw.updatedBy ?? null,
            updatedAt: row.updated_at,
          },
          ["updatedAt"],
        ),
        {merge: true},
      );
    }
    remaining.mappings += 1;
  }

  for (const row of await fetchTable("franchises", "sort_order.asc")) {
    if (!dryRun) {
      await db.collection("franchises").doc(row.slug).set(
        withTimestamps(
          {
            slug: row.slug,
            name: row.title,
            description: row.description,
            published: row.published,
            sortOrder: row.sort_order,
            phases: row.phases ?? [],
            titles: row.titles ?? [],
            updatedAt: row.updated_at,
          },
          ["updatedAt"],
        ),
        {merge: true},
      );
    }
    remaining.franchises += 1;
  }

  console.log(JSON.stringify({remaining, dryRun}, null, 2));
}

console.log(JSON.stringify({done: true, dryRun, totals}, null, 2));
