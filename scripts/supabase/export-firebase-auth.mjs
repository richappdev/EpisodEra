/**
 * Export Firebase Auth users for Phase 0 / Phase 9 prep.
 *
 * Usage (from repo root):
 *   node scripts/supabase/export-firebase-auth.mjs [--out docs/supabase/evidence/auth-users.json]
 */
import {createRequire} from "node:module";
import {createWriteStream} from "node:fs";
import {mkdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const functionsRoot = path.join(repoRoot, "functions");
const require = createRequire(path.join(functionsRoot, "package.json"));
const {initializeApp, getApps} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");

const outArg = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "docs/supabase/evidence/auth-users.json";

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
const users = [];
let nextPageToken;

do {
  const page = await auth.listUsers(1000, nextPageToken);
  for (const user of page.users) {
    users.push({
      uid: user.uid,
      email: user.email ?? null,
      emailVerified: user.emailVerified,
      disabled: user.disabled,
      providerData: user.providerData.map((p) => ({
        providerId: p.providerId,
        uid: p.uid,
      })),
      customClaims: user.customClaims ?? null,
      createdAt: user.metadata.creationTime,
      lastSignInAt: user.metadata.lastSignInTime,
    });
  }
  nextPageToken = page.pageToken;
} while (nextPageToken);

const outPath = path.isAbsolute(outArg) ? outArg : path.join(repoRoot, outArg);
await mkdir(path.dirname(outPath), {recursive: true});
const stream = createWriteStream(outPath);
stream.write(`${JSON.stringify({exportedAt: new Date().toISOString(), users}, null, 2)}\n`);
stream.end();
console.log(`Wrote ${users.length} users to ${outPath}`);
