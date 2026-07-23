/**
 * Backfill Firebase custom claim role=authenticated for Supabase third-party Auth.
 *
 * Usage:
 *   node scripts/supabase/backfill-firebase-role-claim.mjs [--dry-run]
 */
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const functionsRoot = path.join(repoRoot, "functions");
const require = createRequire(path.join(functionsRoot, "package.json"));
const {initializeApp, getApps} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");

const dryRun = process.argv.includes("--dry-run");

if (!getApps().length) {
  initializeApp({
    projectId:
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT ||
      "episodera",
  });
}

const auth = getAuth();
let nextPageToken;
let updated = 0;
let skipped = 0;

do {
  const page = await auth.listUsers(1000, nextPageToken);
  for (const user of page.users) {
    const claims = {...(user.customClaims ?? {})};
    if (claims.role === "authenticated") {
      skipped += 1;
      continue;
    }
    claims.role = "authenticated";
    if (dryRun) {
      console.log(`[dry-run] would set role for ${user.uid}`);
    } else {
      await auth.setCustomUserClaims(user.uid, claims);
      console.log(`set role for ${user.uid}`);
    }
    updated += 1;
  }
  nextPageToken = page.pageToken;
} while (nextPageToken);

console.log(JSON.stringify({updated, skipped, dryRun}, null, 2));
