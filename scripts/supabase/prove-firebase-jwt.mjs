/**
 * Prove Firebase ID token works with Supabase third-party Auth.
 *
 * Usage:
 *   node scripts/supabase/prove-firebase-jwt.mjs --token "<FIREBASE_ID_TOKEN>"
 *
 * Requires:
 *   SUPABASE_URL
 *   SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)
 *   Migration firebase_uid_probe applied
 *   Dashboard: Firebase third-party Auth enabled for project episodera
 *   Token must include custom claim role=authenticated
 */
import path from "node:path";
import {fileURLToPath} from "node:url";
import {loadEnvFiles} from "./lib/supabaseRest.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFiles(repoRoot, [".env", "functions/.env.supabase"]);

const tokenArg = process.argv.includes("--token")
  ? process.argv[process.argv.indexOf("--token") + 1]
  : null;

if (!tokenArg) {
  console.error("Usage: node scripts/supabase/prove-firebase-jwt.mjs --token <FIREBASE_ID_TOKEN>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL?.trim()?.replace(/\/$/, "");
const publishable =
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.SUPABASE_ANON_KEY?.trim();

if (!url || !publishable) {
  console.error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).");
  process.exit(1);
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Not a JWT");
  }
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

const claims = decodeJwtPayload(tokenArg);
const checks = {
  hasSub: typeof claims.sub === "string" && claims.sub.length > 0,
  roleAuthenticated: claims.role === "authenticated",
  issuerLooksFirebase:
    typeof claims.iss === "string" && claims.iss.includes("securetoken.google.com"),
  audienceEpisodera: claims.aud === "episodera" || claims.aud === process.env.FIREBASE_PROJECT,
};

const response = await fetch(`${url}/rest/v1/rpc/firebase_uid_probe`, {
  method: "POST",
  headers: {
    apikey: publishable,
    Authorization: `Bearer ${tokenArg}`,
    "Content-Type": "application/json",
  },
  body: "{}",
});
const bodyText = await response.text();
let probedUid = null;
try {
  probedUid = JSON.parse(bodyText);
} catch {
  probedUid = bodyText;
}

const probeOk =
  response.ok && typeof probedUid === "string" && probedUid === claims.sub;

const report = {
  jwt: {
    sub: claims.sub ?? null,
    role: claims.role ?? null,
    iss: claims.iss ?? null,
    aud: claims.aud ?? null,
    exp: claims.exp ?? null,
  },
  checks,
  supabaseProbe: {
    status: response.status,
    uid: probedUid,
    ok: probeOk,
    raw: response.ok ? undefined : bodyText.slice(0, 500),
  },
  passed:
    checks.hasSub &&
    checks.roleAuthenticated &&
    checks.issuerLooksFirebase &&
    probeOk,
};

console.log(JSON.stringify(report, null, 2));
if (!report.passed) {
  console.error(
    "Auth bridge proof FAILED. Fix: dashboard third-party Auth, claim backfill, getIdToken(true) after signup, and db push for firebase_uid_probe.",
  );
  process.exitCode = 1;
} else {
  console.error("Auth bridge proof PASSED.");
}
