import {defineSecret} from "firebase-functions/params";

export const tmdbApiKey = defineSecret("TMDB_API_KEY");
export const tmdbBaseUrl = "https://api.themoviedb.org/3";
export const tmdbImageBaseUrl = "https://image.tmdb.org/t/p";
export const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
