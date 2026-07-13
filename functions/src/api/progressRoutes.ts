import {Router} from "express";
import {parsePaginationQuery} from "../lib/pagination";
import {AuthenticatedRequest, requireAuth} from "../middleware/auth";
import {
  parseBatchEpisodeProgressInput,
  parseEpisodeProgressInput,
  parseShowId,
  progressService,
} from "../services/progressService";
import {HttpError} from "../lib/httpError";

export const progressRouter = Router();

progressRouter.use(requireAuth);

progressRouter.get("/progress", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await progressService.list(req.user!.uid, parsePaginationQuery(req.query)));
  } catch (error) {
    next(error);
  }
});

progressRouter.get("/progress/:showId", async (req: AuthenticatedRequest, res, next) => {
  try {
    const {showId} = parseShowId(req.params.showId);
    res.json({progress: await progressService.get(req.user!.uid, showId)});
  } catch (error) {
    next(error);
  }
});

progressRouter.post("/progress/:showId/episode", async (req: AuthenticatedRequest, res, next) => {
  try {
    const {showId, tmdbId} = parseShowId(req.params.showId);
    const progress = await progressService.markWatched(
      req.user!.uid,
      showId,
      tmdbId,
      parseEpisodeProgressInput(req.body),
    );
    res.status(201).json(progress);
  } catch (error) {
    next(error);
  }
});

progressRouter.post("/progress/:showId/episodes/batch", async (req: AuthenticatedRequest, res, next) => {
  try {
    const {showId, tmdbId} = parseShowId(req.params.showId);
    const progress = await progressService.updateEpisodes(
      req.user!.uid,
      showId,
      tmdbId,
      parseBatchEpisodeProgressInput(req.body),
    );
    res.json(progress);
  } catch (error) {
    next(error);
  }
});

progressRouter.delete("/progress/:showId/episode/:episodeKey", async (req: AuthenticatedRequest, res, next) => {
  try {
    const {showId, tmdbId} = parseShowId(req.params.showId);
    const match = /^s(\d{2,})e(\d{2,})$/.exec(req.params.episodeKey);
    if (!match) {
      throw new HttpError(400, "Episode key must look like s01e01.", "invalid_episode_key");
    }
    res.json({
      progress: await progressService.markUnwatched(req.user!.uid, showId, tmdbId, {
        seasonNumber: Number(match[1]),
        episodeNumber: Number(match[2]),
      }),
    });
  } catch (error) {
    next(error);
  }
});
