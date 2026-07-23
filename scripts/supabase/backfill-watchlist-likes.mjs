/**
 * Backfill Firestore watchlist + likes → Supabase watchlist_items + likes.
 *
 * Requires profiles to exist first (run backfill-profiles.mjs).
 *
 * Usage:
 *   node scripts/supabase/backfill-watchlist-likes.mjs --dry-run --limit 5
 *   node scripts/supabase/backfill-watchlist-likes.mjs --uid <FIREBASE_UID>
 *   node scripts/supabase/backfill-watchlist-likes.mjs
 *
 * Flags:
 *   --ensure-profile   upsert a stub profile when missing (default: skip user)
 *   --watchlist-only
 *   --likes-only
 */
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {loadEnvFiles, requireSupabaseEnv, supabaseRest} from "./lib/supabaseRest.mjs";
import {mapLikeRow, mapWatchlistRow} from "./lib/libraryTransform.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFiles(repoRoot);

const require = createRequire(path.join(repoRoot, "functions", "package.json"));
const {initializeApp, getApps} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const dryRun = process.argv.includes("--dry-run");
const ensureProfile = process.argv.includes("--ensure-profile");
const watchlistOnly = process.argv.includes("--watchlist-only");
const likesOnly = process.argv.includes("--likes-only");
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
const supabase = dryRun ? null : requireSupabaseEnv();
const doWatchlist = !likesOnly;
const doLikes = !watchlistOnly;

async function listUserIds() {
  if (uidFilter) {
    return [uidFilter];
  }
  const ids = [];
  const query = db.collection("users").orderBy("__name__").limit(200);
  let last = null;
  while (true) {
    const page = last ? await query.startAfter(last).get() : await query.get();
    if (page.empty) {
      break;
    }
    ids.push(...page.docs.map((d) => d.id));
    last = page.docs[page.docs.length - 1];
    if (limit != null && ids.length >= limit) {
      return ids.slice(0, limit);
    }
    if (page.size < 200) {
      break;
    }
  }
  return ids;
}

async function profileExists(uid) {
  const rows = await supabaseRest(
    supabase,
    `profiles?firebase_uid=eq.${encodeURIComponent(uid)}&select=firebase_uid`,
    {method: "GET", prefer: "return=representation"},
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureStubProfile(uid) {
  const row = {
    firebase_uid: uid,
    first_name: "User",
    last_name: "Unknown",
    display_name: "User Unknown",
    email: `${uid}@users.firebase.local`,
  };
  if (dryRun) {
    return;
  }
  await supabaseRest(supabase, "profiles?on_conflict=firebase_uid", {
    method: "POST",
    body: [row],
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function upsertBatch(table, onConflict, rows) {
  if (rows.length === 0) {
    return;
  }
  // PostgREST chunk size — keep payloads modest.
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await supabaseRest(supabase, `${table}?on_conflict=${onConflict}`, {
      method: "POST",
      body: chunk,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }
}

const summary = {
  users: 0,
  skippedMissingProfile: 0,
  stubProfiles: 0,
  watchlistRows: 0,
  likeRows: 0,
  skippedInvalid: 0,
  errors: [],
};

for (const uid of await listUserIds()) {
  summary.users += 1;
  try {
    if (!dryRun) {
      const exists = await profileExists(uid);
      if (!exists) {
        if (!ensureProfile) {
          summary.skippedMissingProfile += 1;
          console.warn(`skip ${uid}: no profiles row (run backfill-profiles or --ensure-profile)`);
          continue;
        }
        await ensureStubProfile(uid);
        summary.stubProfiles += 1;
      }
    } else if (ensureProfile) {
      summary.stubProfiles += 1;
    }

    if (doWatchlist) {
      const snap = await db.collection("users").doc(uid).collection("watchlist").get();
      const rows = [];
      for (const doc of snap.docs) {
        const row = mapWatchlistRow(uid, doc.id, doc.data() ?? {});
        if (!row) {
          summary.skippedInvalid += 1;
          continue;
        }
        rows.push(row);
      }
      if (dryRun) {
        console.log(JSON.stringify({dryRun: true, uid, watchlist: rows.length}));
      } else {
        await upsertBatch("watchlist_items", "firebase_uid,media_type,tmdb_id", rows);
      }
      summary.watchlistRows += rows.length;
    }

    if (doLikes) {
      const snap = await db.collection("users").doc(uid).collection("likes").get();
      const rows = [];
      for (const doc of snap.docs) {
        const row = mapLikeRow(uid, doc.id, doc.data() ?? {});
        if (!row) {
          summary.skippedInvalid += 1;
          continue;
        }
        rows.push(row);
      }
      if (dryRun) {
        console.log(JSON.stringify({dryRun: true, uid, likes: rows.length}));
      } else {
        await upsertBatch("likes", "firebase_uid,media_type,tmdb_id", rows);
      }
      summary.likeRows += rows.length;
    }
  } catch (error) {
    summary.errors.push({uid, error: error instanceof Error ? error.message : String(error)});
    console.error(`Failed ${uid}:`, error instanceof Error ? error.message : error);
  }
}

console.log(JSON.stringify({dryRun, uidFilter, limit, ensureProfile, ...summary}, null, 2));
if (summary.errors.length > 0) {
  process.exitCode = 1;
}
