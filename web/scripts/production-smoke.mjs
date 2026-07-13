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

const request = async (path, {body, method = "GET", token} = {}) =>
  withTimeout(async (signal) => {
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
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

    if (!response.ok) {
      const message = payload?.error?.message ?? payload ?? response.statusText;
      throw new Error(`${method} ${path} failed with HTTP ${response.status}: ${message}`);
    }

    return {payload, response};
  }, `${method} ${path}`);

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

try {
  const health = await request("/health");
  assert(health.payload?.ok === true, "Health check did not return {ok:true}.");

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

  console.log(`Production smoke passed against ${apiBaseUrl} using TV ${showId} (${title}).`);
} catch (error) {
  if (token) {
    await cleanup(token, originalProfile);
  }
  throw error;
}
