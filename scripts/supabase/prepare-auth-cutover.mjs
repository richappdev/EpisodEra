/**
 * Prepare Phase 9 native Supabase Auth cutover artifacts from a site export.
 *
 * Does NOT import passwords into Supabase Auth by itself (use official Supabase
 * Firebase Auth migration tooling for hashes). This script:
 *   1) reads auth-users.json from a site dump
 *   2) writes identity mapping rows CSV/JSON for private.identity_mappings
 *   3) prints the official next commands
 *
 * Usage:
 *   node scripts/supabase/prepare-auth-cutover.mjs --from docs/supabase/evidence/site-export-...
 *   node scripts/supabase/prepare-auth-cutover.mjs --from <dir> --apply-mappings
 */
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {loadEnvFiles, requireSupabaseEnv, supabaseRpc} from "./lib/supabaseRest.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFiles(repoRoot);

const fromArg = process.argv.includes("--from")
  ? process.argv[process.argv.indexOf("--from") + 1]
  : null;
const applyMappings = process.argv.includes("--apply-mappings");

if (!fromArg) {
  console.error("Usage: node scripts/supabase/prepare-auth-cutover.mjs --from <dump-dir>");
  process.exit(1);
}

const dumpDir = path.resolve(repoRoot, fromArg);
const authDump = JSON.parse(await readFile(path.join(dumpDir, "auth-users.json"), "utf8"));
const users = authDump.users ?? [];
const outDir = path.join(dumpDir, "auth-cutover");
await mkdir(outDir, {recursive: true});

const mappings = users.map((user) => ({
  firebase_uid: user.uid,
  email: user.email ?? null,
  disabled: Boolean(user.disabled),
  providers: (user.providerData ?? []).map((p) => p.providerId),
  has_authenticated_role: user.customClaims?.role === "authenticated",
}));

await writeFile(path.join(outDir, "identity-mappings.json"), `${JSON.stringify(mappings, null, 2)}\n`);
await writeFile(
  path.join(outDir, "identity-mappings.csv"),
  ["firebase_uid,email", ...mappings.map((m) => `${m.firebase_uid},${m.email ?? ""}`)].join("\n") + "\n",
);

const checklist = {
  phase: 9,
  exportedUsers: mappings.length,
  missingRoleClaim: mappings.filter((m) => !m.has_authenticated_role).length,
  nextSteps: [
    "Keep Firebase Auth as third-party bridge until soak is green",
    "Export Firebase password hashes with official Supabase Firebase Auth migration tools",
    "Import users into Supabase Auth",
    "Fill private.identity_mappings.supabase_user_id for each firebase_uid",
    "Switch Express verifyIdToken → Supabase JWT verification",
    "Run AuthMigration.md test checklist",
  ],
  officialDocs: "https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth",
};

await writeFile(path.join(outDir, "checklist.json"), `${JSON.stringify(checklist, null, 2)}\n`);

if (applyMappings) {
  const env = requireSupabaseEnv();
  let applied = 0;
  for (const row of mappings) {
    await supabaseRpc(env, "upsert_identity_mapping", {
      p_firebase_uid: row.firebase_uid,
      p_email: row.email,
    });
    applied += 1;
  }
  checklist.appliedMappings = applied;
}

console.log(JSON.stringify({ok: true, outDir, ...checklist}, null, 2));
