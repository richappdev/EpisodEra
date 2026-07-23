/**
 * Export a small Firestore sample for parity fixtures (not a full dump).
 *
 * Usage:
 *   node scripts/supabase/export-firestore-sample.mjs [--uid UID] [--out path]
 */
import {createRequire} from "node:module";
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const functionsRoot = path.join(repoRoot, "functions");
const require = createRequire(path.join(functionsRoot, "package.json"));
const {initializeApp, getApps} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const uid = process.argv.includes("--uid")
  ? process.argv[process.argv.indexOf("--uid") + 1]
  : null;
const outArg = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "docs/supabase/evidence/firestore-sample.json";

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
const sample = {exportedAt: new Date().toISOString(), franchises: [], user: null};

const franchises = await db.collection("franchises").limit(20).get();
sample.franchises = franchises.docs.map((doc) => ({id: doc.id, ...doc.data()}));

if (uid) {
  const userRef = db.collection("users").doc(uid);
  const profile = await userRef.get();
  const [watchlist, likes, progress, history] = await Promise.all([
    userRef.collection("watchlist").limit(50).get(),
    userRef.collection("likes").limit(50).get(),
    userRef.collection("progress").limit(20).get(),
    userRef.collection("history").limit(50).get(),
  ]);
  sample.user = {
    uid,
    profile: profile.exists ? profile.data() : null,
    watchlist: watchlist.docs.map((d) => ({id: d.id, ...d.data()})),
    likes: likes.docs.map((d) => ({id: d.id, ...d.data()})),
    progress: progress.docs.map((d) => ({id: d.id, ...d.data()})),
    history: history.docs.map((d) => ({id: d.id, ...d.data()})),
  };
}

const outPath = path.isAbsolute(outArg) ? outArg : path.join(repoRoot, outArg);
await mkdir(path.dirname(outPath), {recursive: true});
await writeFile(outPath, `${JSON.stringify(sample, null, 2)}\n`);
console.log(`Wrote sample to ${outPath}`);
