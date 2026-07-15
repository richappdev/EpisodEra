import {Router} from "express";
import {parsePaginationQuery} from "../lib/pagination";
import {AuthenticatedRequest, requireAuth} from "../middleware/auth";
import {accountDeletionService} from "../services/accountDeletionService";
import {historyService, parseUpdateHistoryInput} from "../services/historyService";
import {progressService} from "../services/progressService";
import {parseProfileInput, profileService} from "../services/profileService";
import {parseSettingsInput, settingsService} from "../services/settingsService";
import {statsService} from "../services/statsService";

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get("/me/stats", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await statsService.get(req.user!.uid));
  } catch (error) {
    next(error);
  }
});

meRouter.get("/me/history", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await historyService.list(req.user!.uid, parsePaginationQuery(req.query)));
  } catch (error) {
    next(error);
  }
});

meRouter.patch("/me/history/:historyId", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await historyService.updateWatchedAt(req.user!.uid, req.params.historyId, parseUpdateHistoryInput(req.body)));
  } catch (error) {
    next(error);
  }
});

meRouter.delete("/me/history/:historyId", async (req: AuthenticatedRequest, res, next) => {
  try {
    const entry = await historyService.get(req.user!.uid, req.params.historyId);

    if (entry.mediaType === "tv" && entry.seasonNumber != null && entry.episodeNumber != null) {
      const showId = String(entry.tmdbId);
      await progressService.updateEpisodes(req.user!.uid, showId, entry.tmdbId, {
        watched: false,
        episodes: [{seasonNumber: entry.seasonNumber, episodeNumber: entry.episodeNumber}],
      });
    } else if (entry.mediaType === "movie") {
      await historyService.removeMovie(req.user!.uid, entry.tmdbId);
    } else {
      await historyService.delete(req.user!.uid, req.params.historyId);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

meRouter.get("/me/profile", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json({profile: await profileService.get(req.user!.uid)});
  } catch (error) {
    next(error);
  }
});

meRouter.patch("/me/profile", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await profileService.update(req.user!.uid, req.user!.email, parseProfileInput(req.body)));
  } catch (error) {
    next(error);
  }
});

meRouter.get("/me/settings", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await settingsService.get(req.user!.uid));
  } catch (error) {
    next(error);
  }
});

meRouter.patch("/me/settings", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await settingsService.update(req.user!.uid, parseSettingsInput(req.body)));
  } catch (error) {
    next(error);
  }
});

meRouter.delete("/me/account", async (req: AuthenticatedRequest, res, next) => {
  try {
    await accountDeletionService.deleteAccount(req.user!.uid);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
