import fs from "node:fs";
import path from "node:path";

const normalizeEnv = (value) => {
  if (!value) {
    return value;
  }

  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const loadEnvFile = (filePath, {override = false} = {}) => {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Smoke env file not found: ${resolved}`);
  }

  for (const line of fs.readFileSync(resolved, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index <= 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = normalizeEnv(trimmed.slice(index + 1));
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const smokeEnvFile = process.env.EPISODERA_SMOKE_ENV_FILE;
if (smokeEnvFile) {
  loadEnvFile(smokeEnvFile, {override: true});
}

const defaultApiBaseUrl = "https://api-m74gmd4u4a-uc.a.run.app";
const firebaseApiKey = normalizeEnv(process.env.EPISODERA_FIREBASE_API_KEY ?? process.env.VITE_FIREBASE_API_KEY);
const email = normalizeEnv(process.env.EPISODERA_SMOKE_EMAIL);
const password = normalizeEnv(process.env.EPISODERA_SMOKE_PASSWORD);
const apiBaseUrl = normalizeEnv(process.env.EPISODERA_PROD_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, "");
const showId = Number(process.env.EPISODERA_SMOKE_SHOW_ID ?? "125988");
const timeoutMs = Number(process.env.EPISODERA_SMOKE_TIMEOUT_MS ?? "30000");

const requiredEnv = [
  ["EPISODERA_FIREBASE_API_KEY or VITE_FIREBASE_API_KEY", firebaseApiKey],
  ["EPISODERA_SMOKE_EMAIL", email],
  ["EPISODERA_SMOKE_PASSWORD", password],
];

const missingEnv = requiredEnv.filter(([, value]) => !value).map(([name]) => name);

if (missingEnv.length > 0) {
  throw new Error(`Missing required production smoke env vars: ${missingEnv.join(", ")}`);
}

if (!Number.isInteger(showId) || showId <= 0) {
  throw new Error("EPISODERA_SMOKE_SHOW_ID must be a positive TMDb TV id.");
}

const withTimeout = async (operation, label) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const readPayload = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const rawRequest = async (
  path,
  {allowError = false, body, method = "GET", origin, token} = {},
) =>
  withTimeout(async (signal) => {
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (origin) {
      headers.set("Origin", origin);
    }
    const smokeBypass = normalizeEnv(process.env.EPISODERA_SMOKE_APP_CHECK_BYPASS);
    if (smokeBypass) {
      headers.set("X-EpisodEra-Smoke-Bypass", smokeBypass);
    }
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
      method,
      signal,
    });
    const payload = await readPayload(response);

    if (!allowError && !response.ok) {
      const message = payload?.error?.message ?? payload ?? response.statusText;
      throw new Error(`${method} ${path} failed with HTTP ${response.status}: ${message}`);
    }

    return {payload, response};
  }, `${method} ${path}`);

const request = async (path, options = {}) => rawRequest(path, options);

const negativeCheckResults = {
  cors: "not-run",
  invalidAuth: "not-run",
  rateLimit: "not-run",
};

const runInvalidAuthCheck = async () => {
  const result = await rawRequest("/me/profile", {
    allowError: true,
    token: "episodera-smoke-invalid-token",
  });

  assert(result.response.status === 401, `Invalid auth expected HTTP 401, got ${result.response.status}.`);
  assert(
    result.payload?.error?.code === "unauthenticated",
    `Invalid auth expected unauthenticated error code, got ${result.payload?.error?.code ?? "none"}.`,
  );
  negativeCheckResults.invalidAuth = "passed";
};

const runCorsRejectionCheck = async () => {
  const allowedOrigin = normalizeEnv(process.env.EPISODERA_SMOKE_ALLOWED_ORIGIN) ?? "https://episodera.web.app";
  const invalidOrigin = "https://episodera-smoke-invalid.example";

  const allowedPreflight = await withTimeout(async (signal) => {
    const response = await fetch(`${apiBaseUrl}/health`, {
      headers: {
        "Access-Control-Request-Method": "GET",
        Origin: allowedOrigin,
      },
      method: "OPTIONS",
      signal,
    });

    return {payload: await readPayload(response), response};
  }, "CORS preflight allowed origin");

  if (![200, 204].includes(allowedPreflight.response.status)) {
    console.warn(
      `Skipping CORS negative check: allowed origin preflight returned HTTP ${allowedPreflight.response.status}.`,
    );
    negativeCheckResults.cors = "skipped";
    return;
  }

  const rejected = await withTimeout(async (signal) => {
    const response = await fetch(`${apiBaseUrl}/health`, {
      headers: {
        "Access-Control-Request-Method": "GET",
        Origin: invalidOrigin,
      },
      method: "OPTIONS",
      signal,
    });

    return {payload: await readPayload(response), response};
  }, "CORS preflight rejected origin");

  if ([200, 204].includes(rejected.response.status)) {
    console.warn("Skipping CORS negative check: CORS allowlist does not appear enforced on this target.");
    negativeCheckResults.cors = "skipped";
    return;
  }

  assert(rejected.response.status === 403, `Rejected origin expected HTTP 403, got ${rejected.response.status}.`);
  assert(
    rejected.payload?.error?.code === "origin_not_allowed",
    `Rejected origin expected origin_not_allowed error code, got ${rejected.payload?.error?.code ?? "none"}.`,
  );
  negativeCheckResults.cors = "passed";
};

const runRateLimitCheck = async () => {
  const path = "/trending/tv?page=1&language=en-US";
  const first = await rawRequest(path, {allowError: true});

  if (!first.response.ok) {
    throw new Error(`Rate-limit probe failed with HTTP ${first.response.status}.`);
  }

  const limitHeader = first.response.headers.get("x-ratelimit-limit");
  const remainingHeader = first.response.headers.get("x-ratelimit-remaining");

  if (!limitHeader || remainingHeader === null) {
    console.warn("Skipping rate-limit negative check: x-ratelimit headers were not returned.");
    negativeCheckResults.rateLimit = "skipped";
    return;
  }

  let remaining = Number(remainingHeader);
  assert(Number.isFinite(remaining) && remaining >= 0, "x-ratelimit-remaining was not a valid number.");

  while (remaining > 0) {
    const burst = await rawRequest(path, {allowError: true});

    if (burst.response.status === 429) {
      assert(
        burst.payload?.error?.code === "rate_limited",
        `Rate-limit expected rate_limited error code, got ${burst.payload?.error?.code ?? "none"}.`,
      );
      assert(burst.response.headers.get("x-ratelimit-limit"), "Rate-limited response missing x-ratelimit-limit header.");
      negativeCheckResults.rateLimit = "passed";
      return;
    }

    if (!burst.response.ok) {
      throw new Error(`Rate-limit burst failed unexpectedly with HTTP ${burst.response.status}.`);
    }

    const nextRemaining = burst.response.headers.get("x-ratelimit-remaining");
    if (nextRemaining !== null) {
      remaining = Number(nextRemaining);
      continue;
    }

    remaining -= 1;
  }

  const limited = await rawRequest(path, {allowError: true});
  assert(limited.response.status === 429, `Rate-limit expected HTTP 429, got ${limited.response.status}.`);
  assert(
    limited.payload?.error?.code === "rate_limited",
    `Rate-limit expected rate_limited error code, got ${limited.payload?.error?.code ?? "none"}.`,
  );
  assert(limited.response.headers.get("x-ratelimit-limit"), "Rate-limited response missing x-ratelimit-limit header.");
  negativeCheckResults.rateLimit = "passed";
};

const formatNegativeSummary = () => {
  if (skipNegativeChecks) {
    return "negative checks skipped";
  }

  const parts = [];
  if (negativeCheckResults.invalidAuth === "passed") {
    parts.push("invalid auth");
  }
  if (negativeCheckResults.cors === "passed") {
    parts.push("CORS rejection");
  } else if (negativeCheckResults.cors === "skipped") {
    parts.push("CORS check skipped (allowlist not enforced)");
  }
  if (!skipRateLimitCheck) {
    if (negativeCheckResults.rateLimit === "passed") {
      parts.push("rate-limit 429");
    } else if (negativeCheckResults.rateLimit === "skipped") {
      parts.push("rate-limit check skipped");
    }
  }

  return parts.length > 0 ? `${parts.join(", ")} verified` : "negative checks not run";
};

const signIn = async () =>
  withTimeout(async (signal) => {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
      {
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        signal,
      },
    );
    const payload = await readPayload(response);

    if (!response.ok || !payload?.idToken) {
      const message = payload?.error?.message ?? response.statusText;
      throw new Error(`Firebase Auth sign-in failed with HTTP ${response.status}: ${message}`);
    }

    return payload.idToken;
  }, "Firebase Auth sign-in");

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const cleanup = async (token, originalProfile) => {
  const failures = [];

  const steps = [
    async () => {
      const progress = await request(`/progress/${showId}`, {token});
      if (progress.payload?.progress?.episodes?.some((episode) => episode.episodeKey === "s01e01")) {
        await request(`/progress/${showId}/episode/s01e01`, {method: "DELETE", token});
      }
    },
    () => request(`/watchlist/tv_${showId}`, {method: "DELETE", token}),
  ];

  if (originalProfile?.firstName && originalProfile?.lastName) {
    steps.push(() =>
      request("/me/profile", {
        body: {
          displayName: originalProfile.displayName,
          firstName: originalProfile.firstName,
          lastName: originalProfile.lastName,
        },
        method: "PATCH",
        token,
      }));
  }

  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (failures.length > 0) {
    console.warn(`Cleanup completed with warnings:\n- ${failures.join("\n- ")}`);
  }
};

let token;
let originalProfile;

const skipNegativeChecks = normalizeEnv(process.env.EPISODERA_SMOKE_SKIP_NEGATIVE_CHECKS) === "true";
const skipRateLimitCheck = normalizeEnv(process.env.EPISODERA_SMOKE_SKIP_RATE_LIMIT_CHECK) === "true";

try {
  const health = await request("/health");
  assert(health.payload?.ok === true, "Health check did not return {ok:true}.");

  if (!skipNegativeChecks) {
    await runInvalidAuthCheck();
    await runCorsRejectionCheck();
  }

  token = await signIn();

  const profile = await request("/me/profile", {token});
  originalProfile = profile.payload?.profile ?? null;

  const displayName = `Episodera Smoke ${new Date().toISOString()}`;
  const updatedProfile = await request("/me/profile", {
    body: {
      displayName,
      firstName: "Episodera",
      lastName: "Smoke",
    },
    method: "PATCH",
    token,
  });
  assert(updatedProfile.payload?.displayName === displayName, "Profile update did not return the smoke display name.");

  const detail = await request(`/tv/${showId}?language=en-US`, {token});
  assert(detail.payload?.mediaType === "tv", `TMDb detail for ${showId} was not a TV payload.`);

  const title = detail.payload.title ?? `Smoke TV ${showId}`;
  const watchlistItem = await request("/watchlist", {
    body: {
      backdrop: detail.payload.images?.backdrop ?? null,
      mediaType: "tv",
      poster: detail.payload.images?.poster ?? null,
      status: "planned",
      title,
      tmdbId: showId,
    },
    method: "POST",
    token,
  });
  assert(watchlistItem.payload?.itemId === `tv_${showId}`, "Watchlist add did not return the expected item id.");

  const updatedWatchlistItem = await request(`/watchlist/tv_${showId}/status`, {
    body: {status: "watching"},
    method: "PATCH",
    token,
  });
  assert(updatedWatchlistItem.payload?.status === "watching", "Watchlist status did not update to watching.");

  const progress = await request(`/progress/${showId}/episodes/batch`, {
    body: {
      episodes: [{episodeNumber: 1, seasonNumber: 1}],
      watched: true,
    },
    method: "POST",
    token,
  });
  assert(progress.payload?.episodes?.some((episode) => episode.episodeKey === "s01e01"), "Progress did not include S1 E1.");

  const progressRead = await request(`/progress/${showId}`, {token});
  assert(
    progressRead.payload?.progress?.episodes?.some((episode) => episode.episodeKey === "s01e01"),
    "Progress readback did not include S1 E1.",
  );

  const stats = await request("/me/stats", {token});
  assert(Number(stats.payload?.totalWatchedEpisodes) >= 1, "Stats did not include the watched episode.");

  const history = await request("/me/history", {token});
  assert(
    history.payload?.items?.some((item) => item.historyId === `tv_${showId}_s01e01`),
    "History did not include the watched episode.",
  );

  await cleanup(token, originalProfile);

  const watchlistRead = await request("/watchlist", {token});
  assert(
    !watchlistRead.payload?.items?.some((item) => item.itemId === `tv_${showId}`),
    "Smoke watchlist item was not removed during cleanup.",
  );

  const progressAfterCleanup = await request(`/progress/${showId}`, {token});
  assert(
    !progressAfterCleanup.payload?.progress?.episodes?.some((episode) => episode.episodeKey === "s01e01"),
    "Smoke progress episode was not removed during cleanup.",
  );

  if (!skipNegativeChecks && !skipRateLimitCheck) {
    await runRateLimitCheck();
  }

  console.log(
    `Production smoke passed against ${apiBaseUrl} using TV ${showId} (${title}); ${formatNegativeSummary()}.`,
  );
} catch (error) {
  if (token) {
    await cleanup(token, originalProfile);
  }
  throw error;
}
