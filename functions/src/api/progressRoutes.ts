import {Router} from "express";
import {AuthenticatedRequest, requireAuth} from "../middleware/auth";
import {
  parseMarkEpisodeWatchedInput,
  parseShowId,
  progressService,
} from "../services/progressService";

export const progressRouter = Router();

progressRouter.use(requireAuth);

progressRouter.get("/progress", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json({items: await progressService.list(req.user!.uid)});
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
      parseMarkEpisodeWatchedInput(req.body),
    );
    res.status(201).json(progress);
  } catch (error) {
    next(error);
  }
});

progressRouter.delete("/progress/:showId/episode/:episodeKey", async (req: AuthenticatedRequest, res, next) => {
  try {
    const {showId, tmdbId} = parseShowId(req.params.showId);
    res.json({progress: await progressService.markUnwatched(req.user!.uid, showId, tmdbId, req.params.episodeKey)});
  } catch (error) {
    next(error);
  }
});
