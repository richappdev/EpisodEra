/**
 * Seeds Firestore `franchises/{slug}` (and Supabase when configured) from the
 * bundled catalogs in `functions/src/data/franchises.ts`.
 *
 * Usage (from repo root, after `cd functions && npm run build`):
 *   node scripts/seed-franchises.mjs
 *
 * Optional:
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — also upsert public.franchises
 *   FIRESTORE_WRITES_DISABLED=true — skip Firestore writes
 */
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {loadEnvFiles, supabaseRest} from "./supabase/lib/supabaseRest.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFiles(repoRoot);
const functionsRoot = path.join(repoRoot, "functions");
const require = createRequire(path.join(functionsRoot, "package.json"));

const {initializeApp, getApps} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {franchiseCatalogs} = require(path.join(functionsRoot, "lib", "data", "franchises.js"));
const {franchiseDocumentFromCatalog} = require(
  path.join(functionsRoot, "lib", "services", "franchiseCatalogLoader.js"),
);

const firestoreDisabled =
  ["1", "true", "yes", "on"].includes((process.env.FIRESTORE_WRITES_DISABLED ?? "").trim().toLowerCase());

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const supabase =
  supabaseUrl && supabaseKey
    ? {url: supabaseUrl.replace(/\/$/, ""), serviceRoleKey: supabaseKey}
    : null;

if (!firestoreDisabled && getApps().length === 0) {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT ||
    "episodera";
  initializeApp({projectId});
}

const db = firestoreDisabled ? null : getFirestore();
let written = 0;

for (const [index, catalog] of franchiseCatalogs.entries()) {
  const sortOrder = index + 1;
  if (db) {
    const ref = db.collection("franchises").doc(catalog.slug);
    await ref.set(franchiseDocumentFromCatalog(catalog, sortOrder), {merge: true});
  }
  if (supabase) {
    await supabaseRest(supabase, "franchises?on_conflict=slug", {
      method: "POST",
      body: [
        {
          slug: catalog.slug,
          title: catalog.name,
          description: catalog.description ?? null,
          published: true,
          sort_order: sortOrder,
          phases: catalog.phases,
          titles: catalog.titles,
          updated_at: new Date().toISOString(),
        },
      ],
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }
  written += 1;
  console.log(`Wrote franchise ${catalog.slug} (sortOrder=${sortOrder})`);
}

console.log(`Seeded ${written} franchise catalog(s).`);
