import {Router} from "express";
import {HttpError} from "../lib/httpError";
import {SupportedLanguage, supportedLanguages} from "../models/settings";
import {tmdbService} from "../services/tmdbService";

export const mediaRouter = Router();

const pageParam = (value: unknown) => {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const numericId = (value: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, "A positive numeric id is required.", "invalid_id");
  }
  return id;
};

export const languageParam = (value: unknown): SupportedLanguage => {
  if (value === undefined || value === null || value === "") {
    return "en-US";
  }

  if (typeof value === "string" && supportedLanguages.includes(value as SupportedLanguage)) {
    return value as SupportedLanguage;
  }

  return "en-US";
};

mediaRouter.get("/search", async (req, res, next) => {
  try {
    const query = String(req.query.q ?? "").trim();
    if (!query) {
      throw new HttpError(400, "Query parameter q is required.", "missing_query");
    }

    res.json(await tmdbService.search(query, pageParam(req.query.page), languageParam(req.query.language)));
  } catch (error) {
    next(error);
  }
});

mediaRouter.get("/trending", async (req, res, next) => {
  try {
    res.json(await tmdbService.trending(pageParam(req.query.page), languageParam(req.query.language)));
  } catch (error) {
    next(error);
  }
});

mediaRouter.get("/trending/movie", async (req, res, next) => {
  try {
    res.json(await tmdbService.trendingMovies(pageParam(req.query.page), languageParam(req.query.language)));
  } catch (error) {
    next(error);
  }
});

mediaRouter.get(["/trending/tv", "/trending/shows"], async (req, res, next) => {
  try {
    res.json(await tmdbService.trendingTv(pageParam(req.query.page), languageParam(req.query.language)));
  } catch (error) {
    next(error);
  }
});

mediaRouter.get("/movie/:id", async (req, res, next) => {
  try {
    res.json(await tmdbService.movieDetail(numericId(req.params.id), languageParam(req.query.language)));
  } catch (error) {
    next(error);
  }
});

mediaRouter.get("/tv/:id", async (req, res, next) => {
  try {
    res.json(await tmdbService.tvDetail(numericId(req.params.id), languageParam(req.query.language)));
  } catch (error) {
    next(error);
  }
});

mediaRouter.get("/tv/:id/season/:seasonNumber", async (req, res, next) => {
  try {
    res.json(
      await tmdbService.tvSeasonDetail(
        numericId(req.params.id),
        numericId(req.params.seasonNumber),
        languageParam(req.query.language),
      ),
    );
  } catch (error) {
    next(error);
  }
});
