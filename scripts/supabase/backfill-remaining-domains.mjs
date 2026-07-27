/**
 * Backfill remaining Firestore domains into Supabase:
 * discussions, puzzles, media mappings, franchises, active import staging.
 *
 * Usage:
 *   node scripts/supabase/backfill-remaining-domains.mjs --dry-run
 *   node scripts/supabase/backfill-remaining-domains.mjs
 *   node scripts/supabase/backfill-remaining-domains.mjs --only discussions,puzzles
 */
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {loadEnvFiles, requireSupabaseEnv, supabaseRest, supabaseRpc} from "./lib/supabaseRest.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFiles(repoRoot);

const dryRun = process.argv.includes("--dry-run");
const onlyArg = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;
const only = new Set(
  (onlyArg ?? "discussions,puzzles,mappings,franchises,staging")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const functionsRoot = path.join(repoRoot, "functions");
const require = createRequire(path.join(functionsRoot, "package.json"));
const {initializeApp, getApps} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

if (getApps().length === 0) {
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

async function upsert(table, onConflict, rows) {
  if (!rows.length || dryRun) {
    return;
  }
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await supabaseRest(supabase, `${table}?on_conflict=${onConflict}`, {
      method: "POST",
      body: rows.slice(i, i + chunkSize),
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }
}

async function backfillDiscussions() {
  const root = await db.collection("public").doc("discussions").listCollections();
  let count = 0;
  for (const col of root) {
    const snap = await col.limit(500).get();
    const rows = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        firestore_id: doc.id,
        media_type: data.mediaType,
        tmdb_id: data.tmdbId,
        author_firebase_uid: data.userId,
        display_name: data.displayName ?? "Viewer",
        body: data.body ?? "",
        season_number: data.seasonNumber ?? null,
        episode_number: data.episodeNumber ?? null,
        created_at: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
    count += rows.length;
    await upsert("discussion_comments", "firestore_id", rows);
  }
  console.log(`discussions: ${count} comments`);
}

async function backfillPuzzles() {
  const publicSnap = await db.collection("puzzlePublic").get();
  let count = 0;
  for (const doc of publicSnap.docs) {
    const pub = doc.data();
    const privSnap = await db.collection("puzzlePrivate").doc(doc.id).get();
    const priv = privSnap.exists ? privSnap.data() : {};
    const publicPayload = {
      id: doc.id,
      puzzleDate: pub.puzzleDate ?? doc.id,
      imageUrl: pub.imageUrl ?? "",
      mobileImageUrl: pub.mobileImageUrl ?? null,
      choices: pub.choices ?? [],
      maxAttempts: pub.maxAttempts ?? 3,
      nextPuzzleAt: pub.nextPuzzleAt ?? null,
      locale: pub.locale ?? "en-US",
    };
    const answer = {
      correctChoiceId: priv.correctChoiceId,
      correctShowId: priv.correctShowId,
      correctTitle: priv.correctTitle ?? null,
      seasonNumber: priv.seasonNumber ?? null,
      episodeNumber: priv.episodeNumber ?? null,
      difficulty: priv.difficulty ?? null,
      createdAt: priv.createdAt ?? null,
      publishedAt: priv.publishedAt ?? null,
    };
    if (!dryRun) {
      await upsert("puzzles_public", "puzzle_id", [
        {
          puzzle_id: doc.id,
          puzzle_date: pub.puzzleDate ?? doc.id,
          payload: publicPayload,
          published_at: priv.publishedAt ?? null,
          updated_at: new Date().toISOString(),
        },
      ]);
      await supabaseRpc(supabase, "upsert_puzzle_private", {
        p_puzzle_id: doc.id,
        p_answer: answer,
        p_hints: priv.hints ?? [],
        p_status: priv.status ?? "draft",
        p_image_asset: priv.imageAsset ?? null,
      });
    }
    count += 1;
  }

  const attempts = await db.collection("puzzleAttempts").get();
  const attemptRows = attempts.docs.map((doc) => {
    const data = doc.data();
    return {
      player_id: data.playerId,
      puzzle_id: data.puzzleId,
      attempt_state: data,
      updated_at: data.updatedAt ?? new Date().toISOString(),
    };
  });
  await upsert("puzzle_attempts", "player_id,puzzle_id", attemptRows);

  const stats = await db.collection("userGameStats").get();
  const statsRows = stats.docs.map((doc) => {
    const data = doc.data();
    return {
      firebase_uid: doc.id,
      current_streak: data.currentStreak ?? 0,
      max_streak: data.longestStreak ?? 0,
      wins: data.gamesWon ?? 0,
      plays: data.gamesPlayed ?? 0,
      payload: {
        winsByAttempt: data.winsByAttempt ?? {},
        lastPlayedPuzzleDate: data.lastPlayedPuzzleDate ?? null,
      },
      updated_at: data.updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
    };
  });
  await upsert("user_game_stats", "firebase_uid", statsRows);

  const config = await db.collection("gameConfig").doc("dailyPuzzle").get();
  if (config.exists && !dryRun) {
    await supabaseRpc(supabase, "upsert_game_config", {
      p_key: "dailyPuzzle",
      p_payload: config.data() ?? {},
    });
  }

  console.log(
    `puzzles: ${count} public/private, ${attemptRows.length} attempts, ${statsRows.length} stats`,
  );
}

async function backfillMappings() {
  const snap = await db.collection("mediaMappings").get();
  const rows = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      provider: data.provider,
      media_type: data.mediaType,
      external_id: data.externalId,
      tmdb_id: data.tmdbId,
      raw: {title: data.title ?? null, updatedBy: data.updatedBy ?? null},
      updated_at: data.updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
    };
  });
  await upsert("media_mappings", "provider,media_type,external_id", rows);
  console.log(`mappings: ${rows.length}`);
}

async function backfillFranchises() {
  const snap = await db.collection("franchises").get();
  const rows = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      slug: data.slug ?? doc.id,
      title: data.name ?? data.title ?? doc.id,
      description: data.description ?? null,
      published: data.published !== false,
      sort_order: data.sortOrder ?? 0,
      phases: data.phases ?? [],
      titles: data.titles ?? [],
      updated_at: data.updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
    };
  });
  await upsert("franchises", "slug", rows);
  console.log(`franchises: ${rows.length}`);
}

async function backfillStaging() {
  const users = await db.collection("users").limit(500).get();
  let shows = 0;
  let episodes = 0;
  for (const userDoc of users.docs) {
    const imports = await userDoc.ref.collection("imports").get();
    for (const importDoc of imports.docs) {
      const status = importDoc.data().status;
      if (status === "completed" || status === "failed") {
        continue;
      }
      const stagedShows = await importDoc.ref.collection("stagedShows").get();
      for (const showDoc of stagedShows.docs) {
        const data = showDoc.data();
        shows += 1;
        if (!dryRun) {
          await supabaseRpc(supabase, "upsert_import_staged_show", {
            p_import_id: importDoc.id,
            p_media_type: data.mediaType,
            p_tmdb_id: data.tmdbId,
            p_status: data.imported ? "imported" : "pending",
            p_payload: data,
          });
        }
      }
      const stagedEpisodes = await importDoc.ref.collection("stagedEpisodes").get();
      for (const epDoc of stagedEpisodes.docs) {
        const data = epDoc.data();
        episodes += 1;
        if (!dryRun) {
          await supabaseRpc(supabase, "upsert_import_staged_episode", {
            p_import_id: importDoc.id,
            p_show_tmdb_id: data.tmdbId,
            p_season_number: data.seasonNumber,
            p_episode_number: data.episodeNumber,
            p_status: data.status ?? "pending",
            p_payload: data,
          });
        }
      }
    }
  }
  console.log(`staging: ${shows} shows, ${episodes} episodes (active imports only)`);
}

console.log(dryRun ? "Dry run — no writes" : "Writing to Supabase…");
if (only.has("discussions")) await backfillDiscussions();
if (only.has("puzzles")) await backfillPuzzles();
if (only.has("mappings")) await backfillMappings();
if (only.has("franchises")) await backfillFranchises();
if (only.has("staging")) await backfillStaging();
console.log("Done.");
