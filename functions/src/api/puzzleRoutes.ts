import {Router} from "express";
import {puzzleAdminEmails} from "../config/env";
import {HttpError} from "../lib/httpError";
import {AuthenticatedRequest, requireAuth} from "../middleware/auth";
import {requireAppCheck} from "../middleware/appCheck";
import {UpsertPuzzleInput} from "../models/puzzle";
import {buildOpaqueImageUrls, rankDistractors} from "../services/puzzleLogic";
import {puzzleService} from "../services/puzzleService";
import {tmdbService} from "../services/tmdbService";

export const puzzleRouter = Router();

const requirePuzzleAdmin = (req: AuthenticatedRequest, _res: unknown, next: (error?: unknown) => void) => {
  const allowlist = puzzleAdminEmails();
  const email = req.user?.email?.toLowerCase();
  if (allowlist.length === 0) {
    next(new HttpError(403, "Puzzle admin is not configured.", "puzzle_admin_unconfigured"));
    return;
  }
  if (!email || !allowlist.includes(email)) {
    next(new HttpError(403, "Puzzle admin access required.", "puzzle_admin_forbidden"));
    return;
  }
  next();
};

const playerIdFromRequest = (req: AuthenticatedRequest) => {
  const header = req.header("x-episodera-player-id");
  return puzzleService.resolvePlayerId({
    uid: req.user?.uid,
    anonymousPlayerId: header,
  });
};

puzzleRouter.get("/puzzles/today", async (req: AuthenticatedRequest, res, next) => {
  try {
    let playerId: string | null = null;
    try {
      playerId = playerIdFromRequest(req);
    } catch {
      playerId = req.user?.uid ? `uid:${req.user.uid}` : null;
    }
    res.json(await puzzleService.getToday(playerId));
  } catch (error) {
    next(error);
  }
});

puzzleRouter.post("/puzzles/:puzzleId/guess", async (req: AuthenticatedRequest, res, next) => {
  try {
    const choiceId = typeof req.body?.choiceId === "string" ? req.body.choiceId : "";
    if (!choiceId) {
      throw new HttpError(400, "choiceId is required.", "invalid_choice");
    }
    const playerId = playerIdFromRequest(req);
    res.json(
      await puzzleService.submitGuess({
        puzzleId: req.params.puzzleId,
        choiceId,
        playerId,
        uid: req.user?.uid,
      }),
    );
  } catch (error) {
    next(error);
  }
});

puzzleRouter.get("/puzzles/stats", requireAuth, requireAppCheck, async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await puzzleService.getStats(req.user!.uid));
  } catch (error) {
    next(error);
  }
});

puzzleRouter.get(
  "/admin/puzzles",
  requireAuth,
  requireAppCheck,
  requirePuzzleAdmin,
  async (_req, res, next) => {
    try {
      res.json({items: await puzzleService.listPuzzles()});
    } catch (error) {
      next(error);
    }
  },
);

puzzleRouter.post(
  "/admin/puzzles",
  requireAuth,
  requireAppCheck,
  requirePuzzleAdmin,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = req.body as UpsertPuzzleInput;
      const result = await puzzleService.upsertPuzzle(body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

puzzleRouter.post(
  "/admin/puzzles/publish-scheduled",
  requireAuth,
  requireAppCheck,
  requirePuzzleAdmin,
  async (_req, res, next) => {
    try {
      res.json(await puzzleService.publishScheduledPuzzles());
    } catch (error) {
      next(error);
    }
  },
);

puzzleRouter.get(
  "/admin/puzzles/search-tv",
  requireAuth,
  requireAppCheck,
  requirePuzzleAdmin,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const query = String(req.query.q ?? "").trim();
      if (!query) {
        throw new HttpError(400, "q is required.", "invalid_query");
      }
      const result = await tmdbService.search(query, 1, "en-US");
      res.json({
        items: result.tv.results.map((item) => ({
          id: item.id,
          title: item.title,
          overview: item.overview,
          releaseDate: item.releaseDate,
          popularity: item.popularity,
          poster: item.images.poster,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

puzzleRouter.get(
  "/admin/puzzles/tv/:showId/season/:seasonNumber/episode/:episodeNumber/stills",
  requireAuth,
  requireAppCheck,
  requirePuzzleAdmin,
  async (req, res, next) => {
    try {
      const showId = Number(req.params.showId);
      const seasonNumber = Number(req.params.seasonNumber);
      const episodeNumber = Number(req.params.episodeNumber);
      if (![showId, seasonNumber, episodeNumber].every(Number.isFinite)) {
        throw new HttpError(400, "Invalid show/season/episode.", "invalid_episode");
      }
      const stills = await tmdbService.tvEpisodeImages(showId, seasonNumber, episodeNumber);
      res.json({
        items: stills.map((still) => {
          const urls = buildOpaqueImageUrls(still.filePath);
          return {
            ...still,
            ...urls,
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  },
);

puzzleRouter.post(
  "/admin/puzzles/suggest-distractors",
  requireAuth,
  requireAppCheck,
  requirePuzzleAdmin,
  async (req, res, next) => {
    try {
      const showId = Number(req.body?.showId);
      if (!Number.isFinite(showId)) {
        throw new HttpError(400, "showId is required.", "invalid_show");
      }
      const detail = await tmdbService.tvDetail(showId, "en-US");
      const year = detail.releaseDate ? Number(detail.releaseDate.slice(0, 4)) : null;
      const search = await tmdbService.search(detail.title.split(":")[0] ?? detail.title, 1, "en-US");
      const trending = await tmdbService.trendingTv(1, "en-US");
      const candidates = [...search.tv.results, ...trending.results]
        .filter((item, index, arr) => arr.findIndex((entry) => entry.id === item.id) === index)
        .map((item) => ({
          id: item.id,
          title: item.title,
          genreIds: [],
          releaseYear: item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : null,
          popularity: item.popularity,
          originCountry: null,
          networkOrProvider: null,
        }));

      const ranked = rankDistractors(
        {
          id: detail.id,
          title: detail.title,
          genreIds: detail.genres?.map((genre) => genre.id) ?? [],
          releaseYear: year,
          popularity: detail.popularity,
          originCountry: null,
        },
        candidates,
        3,
      );

      res.json({
        answer: {id: detail.id, title: detail.title},
        distractors: ranked.map((item) => ({id: item.id, title: item.title})),
      });
    } catch (error) {
      next(error);
    }
  },
);
