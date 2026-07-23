/**
 * Backfill Firestore users/{uid} + settings/profile → Supabase profiles + user_settings.
 *
 * Idempotent upserts on firebase_uid. Also records private.identity_mappings via RPC.
 *
 * Usage (from repo root, with Firebase Admin credentials):
 *   node scripts/supabase/backfill-profiles.mjs --dry-run
 *   node scripts/supabase/backfill-profiles.mjs --uid <FIREBASE_UID>
 *   node scripts/supabase/backfill-profiles.mjs --limit 50
 *
 * Requires:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   Firebase Admin ADC / GOOGLE_APPLICATION_CREDENTIALS (or emulator hosts)
 *   Migration 20260723130001_upsert_identity_mapping_rpc.sql applied
 */
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {loadEnvFiles, requireSupabaseEnv, supabaseRest, supabaseRpc} from "./lib/supabaseRest.mjs";
import {mapProfileRow, mapSettingsRow} from "./lib/profileTransform.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFiles(repoRoot);

const require = createRequire(path.join(repoRoot, "functions", "package.json"));
const {initializeApp, getApps} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");

const dryRun = process.argv.includes("--dry-run");
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
const auth = getAuth();
const supabase = dryRun ? null : requireSupabaseEnv();

async function resolveAuthEmail(uid) {
  try {
    const user = await auth.getUser(uid);
    return user.email ?? null;
  } catch {
    return null;
  }
}

async function upsertProfile(row) {
  try {
    await supabaseRest(supabase, "profiles?on_conflict=firebase_uid", {
      method: "POST",
      body: [row],
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  } catch (error) {
    if (String(error.message).includes("friend_code") || String(error.message).includes("23505")) {
      await supabaseRest(supabase, "profiles?on_conflict=firebase_uid", {
        method: "POST",
        body: [{...row, friend_code: null}],
        prefer: "resolution=merge-duplicates,return=minimal",
      });
      return {friendCodeDropped: true};
    }
    throw error;
  }
  return {friendCodeDropped: false};
}

async function upsertSettings(row) {
  await supabaseRest(supabase, "user_settings?on_conflict=firebase_uid", {
    method: "POST",
    body: [row],
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function listUserDocs() {
  if (uidFilter) {
    const snap = await db.collection("users").doc(uidFilter).get();
    return snap.exists ? [snap] : [];
  }

  const docs = [];
  const query = db.collection("users").orderBy("__name__").limit(200);
  let last = null;
  while (true) {
    const page = last ? await query.startAfter(last).get() : await query.get();
    if (page.empty) {
      break;
    }
    docs.push(...page.docs);
    last = page.docs[page.docs.length - 1];
    if (limit != null && docs.length >= limit) {
      return docs.slice(0, limit);
    }
    if (page.size < 200) {
      break;
    }
  }
  return docs;
}

const summary = {
  scanned: 0,
  profilesUpserted: 0,
  settingsUpserted: 0,
  identityMapped: 0,
  friendCodeDropped: 0,
  errors: [],
};

const userDocs = await listUserDocs();

for (const userDoc of userDocs) {
  summary.scanned += 1;
  const uid = userDoc.id;
  const data = userDoc.data() ?? {};

  try {
    const authEmail = await resolveAuthEmail(uid);
    const profile = mapProfileRow(uid, data, authEmail);
    const settingsSnap = await db
      .collection("users")
      .doc(uid)
      .collection("settings")
      .doc("profile")
      .get();
    const settings = mapSettingsRow(uid, settingsSnap.exists ? settingsSnap.data() : {});

    if (dryRun) {
      console.log(
        JSON.stringify({
          dryRun: true,
          uid,
          profile: {
            email: profile.email,
            first_name: profile.first_name,
            friend_code: profile.friend_code,
          },
          settings: {locale: settings.locale, spoiler_mode: settings.spoiler_mode},
        }),
      );
      summary.profilesUpserted += 1;
      summary.settingsUpserted += 1;
      summary.identityMapped += 1;
      continue;
    }

    const profileResult = await upsertProfile(profile);
    if (profileResult.friendCodeDropped) {
      summary.friendCodeDropped += 1;
    }
    summary.profilesUpserted += 1;

    await upsertSettings(settings);
    summary.settingsUpserted += 1;

    await supabaseRpc(supabase, "upsert_identity_mapping", {
      p_firebase_uid: uid,
      p_email: profile.email,
    });
    summary.identityMapped += 1;
  } catch (error) {
    summary.errors.push({uid, error: error instanceof Error ? error.message : String(error)});
    console.error(`Failed ${uid}:`, error instanceof Error ? error.message : error);
  }
}

console.log(JSON.stringify({dryRun, uidFilter, limit, ...summary}, null, 2));
if (summary.errors.length > 0) {
  process.exitCode = 1;
}
