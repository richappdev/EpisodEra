/**
 * Seeds Firestore `franchises/{slug}` from the bundled catalogs in
 * `functions/src/data/franchises.ts`.
 *
 * Usage (from repo root, after `cd functions && npm run build`):
 *   node scripts/seed-franchises.mjs
 *
 * Optional:
 *   GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT / FIREBASE_CONFIG — project id
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 — target the emulator
 */
import {initializeApp, getApps} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const {franchiseCatalogs} = require(path.join(repoRoot, "functions", "lib", "data", "franchises.js"));
const {franchiseDocumentFromCatalog} = require(
  path.join(repoRoot, "functions", "lib", "services", "franchiseCatalogLoader.js"),
);

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
let written = 0;

for (const [index, catalog] of franchiseCatalogs.entries()) {
  const ref = db.collection("franchises").doc(catalog.slug);
  await ref.set(franchiseDocumentFromCatalog(catalog, index + 1), {merge: true});
  written += 1;
  console.log(`Wrote franchises/${catalog.slug} (sortOrder=${index + 1})`);
}

console.log(`Seeded ${written} franchise catalog(s).`);
