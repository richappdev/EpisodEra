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
