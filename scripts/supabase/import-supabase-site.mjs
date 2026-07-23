/**
 * Import a Firebase site dump into Supabase Postgres (restore user data).
 *
 * Usage:
 *   node scripts/supabase/import-supabase-site.mjs --from docs/supabase/evidence/site-export-...
 *   node scripts/supabase/import-supabase-site.mjs --from <dir> --dry-run
 *   node scripts/supabase/import-supabase-site.mjs --from <dir> --uid <UID>
 *   node scripts/supabase/import-supabase-site.mjs --from <dir> --skip-friends
 *
 * Order: profiles → settings → identity → watchlist/likes → progress → episodes → history → friendships
 * Auth passwords are NOT imported here (Firebase Auth bridge / Phase 9).
 */
import {readdir, readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {loadEnvFiles, requireSupabaseEnv, supabaseRest, supabaseRpc} from "./lib/supabaseRest.mjs";
import {buildUserRestoreBatches} from "./lib/restoreTransform.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFiles(repoRoot);

const fromArg = process.argv.includes("--from")
  ? process.argv[process.argv.indexOf("--from") + 1]
  : null;
const dryRun = process.argv.includes("--dry-run");
const skipFriends = process.argv.includes("--skip-friends");
const skipCatalogs = process.argv.includes("--skip-catalogs");
const uidFilter = process.argv.includes("--uid")
  ? process.argv[process.argv.indexOf("--uid") + 1]
  : null;

if (!fromArg) {
  console.error("Usage: node scripts/supabase/import-supabase-site.mjs --from <dump-dir>");
  process.exit(1);
}

const dumpDir = path.resolve(repoRoot, fromArg);
const usersDir = path.join(dumpDir, "users");
const supabase = dryRun ? null : requireSupabaseEnv();

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function upsertBatch(table, onConflict, rows) {
  if (!rows.length) {
    return;
  }
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

const manifest = await readJson(path.join(dumpDir, "manifest.json"));
if (manifest.format !== "episodera-firebase-site-export") {
  throw new Error(`Unexpected dump format: ${manifest.format}`);
}

const authEmailByUid = new Map();
try {
  const authDump = await readJson(path.join(dumpDir, "auth-users.json"));
  for (const user of authDump.users ?? []) {
    if (user.uid) {
      authEmailByUid.set(user.uid, user.email ?? null);
    }
  }
} catch {
  // auth dump optional
}

if (!skipCatalogs) {
  try {
    const franchisesDump = await readJson(path.join(dumpDir, "franchises.json"));
    const rows = (franchisesDump.items ?? []).map((item) => ({
      slug: item.id,
      title: item.data?.title ?? item.id,
      description: item.data?.description ?? null,
      published: Boolean(item.data?.published),
      sort_order: Number.isInteger(item.data?.sortOrder) ? item.data.sortOrder : 0,
      phases: item.data?.phases ?? [],
      titles: item.data?.titles ?? [],
      updated_at: item.data?.updatedAt ?? new Date().toISOString(),
    }));
    if (dryRun) {
      console.log(JSON.stringify({dryRun: true, franchises: rows.length}));
    } else {
      await upsertBatch("franchises", "slug", rows);
    }
  } catch {
    // optional file
  }
}

const userFiles = (await readdir(usersDir))
  .filter((name) => name.endsWith(".json"))
  .filter((name) => (uidFilter ? name === `${uidFilter}.json` : true));

const summary = {
  users: 0,
  profiles: 0,
  settings: 0,
  watchlist: 0,
  likes: 0,
  progress: 0,
  episodes: 0,
  history: 0,
  friendships: 0,
  friendshipsSkipped: 0,
  errors: [],
};

const allFriendships = [];

for (const fileName of userFiles) {
  const uid = fileName.replace(/\.json$/, "");
  try {
    const userDump = await readJson(path.join(usersDir, fileName));
    const batches = buildUserRestoreBatches(userDump, authEmailByUid.get(uid) ?? null);

    if (dryRun) {
      console.log(
        JSON.stringify({
          dryRun: true,
          uid,
          watchlist: batches.watchlist.length,
          likes: batches.likes.length,
          progress: batches.progress.length,
          episodes: batches.episodes.length,
          history: batches.history.length,
          friendships: batches.friendships.length,
        }),
      );
    } else {
      await upsertBatch("profiles", "firebase_uid", [batches.profile]);
      await upsertBatch("user_settings", "firebase_uid", [batches.settings]);
      await supabaseRpc(supabase, "upsert_identity_mapping", {
        p_firebase_uid: uid,
        p_email: batches.profile.email,
      });
      await upsertBatch("watchlist_items", "firebase_uid,media_type,tmdb_id", batches.watchlist);
      await upsertBatch("likes", "firebase_uid,media_type,tmdb_id", batches.likes);
      await upsertBatch("show_progress", "firebase_uid,show_tmdb_id", batches.progress);
      await upsertBatch(
        "watched_episodes",
        "firebase_uid,show_tmdb_id,season_number,episode_number",
        batches.episodes,
      );
      await upsertBatch("watch_history", "firebase_uid,history_key", batches.history);
    }

    summary.users += 1;
    summary.profiles += 1;
    summary.settings += 1;
    summary.watchlist += batches.watchlist.length;
    summary.likes += batches.likes.length;
    summary.progress += batches.progress.length;
    summary.episodes += batches.episodes.length;
    summary.history += batches.history.length;
    allFriendships.push(...batches.friendships);
  } catch (error) {
    summary.errors.push({uid, error: error instanceof Error ? error.message : String(error)});
    console.error(`Failed ${uid}:`, error instanceof Error ? error.message : error);
  }
}

if (!skipFriends) {
  if (dryRun) {
    summary.friendships = allFriendships.length;
  } else {
    for (const row of allFriendships) {
      try {
        await upsertBatch("friendships", "firebase_uid,friend_firebase_uid", [row]);
        summary.friendships += 1;
      } catch (error) {
        summary.friendshipsSkipped += 1;
        console.warn(
          `friendship skip ${row.firebase_uid}->${row.friend_firebase_uid}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }
}

console.log(
  JSON.stringify(
    {
      dryRun,
      from: path.relative(repoRoot, dumpDir).replace(/\\/g, "/"),
      manifestVersion: manifest.version,
      exportedAt: manifest.exportedAt,
      ...summary,
    },
    null,
    2,
  ),
);
if (summary.errors.length > 0) {
  process.exitCode = 1;
}
