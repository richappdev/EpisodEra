/**
 * Seeds Firestore `franchises/{slug}` from the bundled catalogs in
 * `functions/src/data/franchises.ts`.
 *
 * Usage (from repo root, after `cd functions && npm run build`):
 *   node scripts/seed-franchises.mjs
 *
 * Or:
 *   cd functions && npm run seed:franchises
 *
 * Optional:
 *   GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT / FIREBASE_CONFIG — project id
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 — target the emulator
 */
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const functionsRoot = path.join(repoRoot, "functions");
const require = createRequire(path.join(functionsRoot, "package.json"));

const {initializeApp, getApps} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {franchiseCatalogs} = require(path.join(functionsRoot, "lib", "data", "franchises.js"));
const {franchiseDocumentFromCatalog} = require(
  path.join(functionsRoot, "lib", "services", "franchiseCatalogLoader.js"),
);

if (getApps().length === 0) {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT ||
    "episodera";
  initializeApp({projectId});
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
