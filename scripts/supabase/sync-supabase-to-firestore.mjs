/**
 * Sync Supabase library domains → Firestore (catch-up when Firestore mirror was off).
 *
 * Covers: profiles, settings, watchlist, likes, progress+episodes, history, friendships,
 * and derived cache keys (stats / achievements / recent yearRecap via RPC).
 *
 * Usage (repo root, with Firebase Admin ADC + functions/.env.supabase):
 *   node scripts/supabase/sync-supabase-to-firestore.mjs --dry-run
 *   node scripts/supabase/sync-supabase-to-firestore.mjs --uid <FIREBASE_UID>
 *   node scripts/supabase/sync-supabase-to-firestore.mjs --limit 20
 *   node scripts/supabase/sync-supabase-to-firestore.mjs --skip-derived
 *
 * Does NOT sync puzzles, discussions, franchises, or import staging.
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

console.log(JSON.stringify({done: true, dryRun, totals}, null, 2));
