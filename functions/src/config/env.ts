import {defineSecret} from "firebase-functions/params";

export const tmdbApiKey = defineSecret("TMDB_API_KEY");
export const tmdbBaseUrl = "https://api.themoviedb.org/3";
export const tmdbImageBaseUrl = "https://image.tmdb.org/t/p";
export const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const positiveIntegerFromEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export const publicReadRateLimit = {
  maxRequests: positiveIntegerFromEnv("PUBLIC_READ_RATE_LIMIT_MAX", 120),
  windowMs: positiveIntegerFromEnv("PUBLIC_READ_RATE_LIMIT_WINDOW_MS", 60_000),
};

export const authenticatedWriteRateLimit = {
  maxRequests: positiveIntegerFromEnv("AUTH_WRITE_RATE_LIMIT_MAX", 60),
  windowMs: positiveIntegerFromEnv("AUTH_WRITE_RATE_LIMIT_WINDOW_MS", 60_000),
};

const booleanFromEnv = (name: string, fallback = false) => {
  const value = (process.env[name] ?? "").trim().toLowerCase();
  if (!value) {
    return fallback;
  }

  return value === "1" || value === "true" || value === "yes" || value === "on";
};

/** Phase 3: require App Check on all requireAuth routes when true. */
export const isAppCheckEnforceAuthWrites = () => booleanFromEnv("APP_CHECK_ENFORCE_AUTH_WRITES");

/** Phase 4: require App Check on public read routes when true (middleware ready, not mounted). */
export const isAppCheckEnforcePublicReads = () => booleanFromEnv("APP_CHECK_ENFORCE_PUBLIC_READS");

/**
 * Phase 4–6: after Firestore primary write succeeds, also write to Supabase (shadow).
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Failures go to migration outbox.
 */
export const isSupabaseShadowWrites = () => booleanFromEnv("SUPABASE_SHADOW_WRITES");

/**
 * Phase 5+: read profiles/settings from Supabase when true.
 * Default false — Firestore remains read primary during shadow mode.
 */
export const isSupabaseReadProfiles = () => booleanFromEnv("SUPABASE_READ_PROFILES");

/**
 * Phase 10 prep: when true, mutation routes should refuse Firestore writes
 * after Supabase has become primary (not enforced globally yet — see Phase10Retirement.md).
 */
export const isFirestoreWritesDisabled = () => booleanFromEnv("FIRESTORE_WRITES_DISABLED");

/**
 * Phase 10 prep: treat Supabase as read primary for library domains when true.
 * Default false until soak completes.
 */
export const isSupabaseReadPrimary = () => booleanFromEnv("SUPABASE_READ_PRIMARY");

/** Comma-separated emails allowed to use puzzle admin APIs. */
export const puzzleAdminEmails = () =>
  (process.env.PUZZLE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

/**
 * Opt-in smoke bypass for production-smoke.mjs (Auth REST, no web SDK).
 * Requires SMOKE_BYPASS_APP_CHECK=true and a non-empty SMOKE_BYPASS_APP_CHECK_SECRET.
 * Prefer App Check debug tokens for browser clients; use this only for CI smoke.
 */
export const isSmokeBypassAppCheck = () => booleanFromEnv("SMOKE_BYPASS_APP_CHECK");
export const smokeBypassAppCheckSecret = () => (process.env.SMOKE_BYPASS_APP_CHECK_SECRET ?? "").trim();
