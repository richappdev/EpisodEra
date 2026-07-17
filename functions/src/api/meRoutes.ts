import {Router} from "express";
import {parsePaginationQuery} from "../lib/pagination";
import {requireAppCheck} from "../middleware/appCheck";
import {AuthenticatedRequest, requireAuth} from "../middleware/auth";
import {accountDeletionService} from "../services/accountDeletionService";
import {exportService} from "../services/exportService";
import {historyService, parseUpdateHistoryInput} from "../services/historyService";
import {progressService} from "../services/progressService";
import {parseProfileInput, profileService} from "../services/profileService";
import {parseSettingsInput, settingsService} from "../services/settingsService";
import {achievementService} from "../services/achievementService";
import {challengeService} from "../services/challengeService";
import {friendService} from "../services/friendService";
import {statsService} from "../services/statsService";
import {franchiseService} from "../services/franchiseService";
import {
  importService,
  parseCreateImportInput,
  parseEpisodeStageInput,
  parseWatchlistStageInput,
} from "../services/importService";
import {
  parseResolveTvTimeShowsBody,
  tvTimeResolveService,
} from "../services/tvTimeResolveService";
import {mediaMappingService, parseUpsertMediaMappingInput} from "../services/mediaMappingService";
import {HttpError} from "../lib/httpError";

export const meRouter = Router();

meRouter.use(requireAuth, requireAppCheck);

meRouter.get("/me/stats", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await statsService.get(req.user!.uid));
  } catch (error) {
    next(error);
  }
});

meRouter.get("/me/recap", async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsedYear = Number(req.query.year);
    const year =
      Number.isInteger(parsedYear) && parsedYear >= 1970 && parsedYear <= 2100
        ? parsedYear
        : new Date().getUTCFullYear();
    res.json(await statsService.getYearRecap(req.user!.uid, year));
  } catch (error) {
    next(error);
  }
});

meRouter.get("/me/franchises/:slug/progress", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await franchiseService.getProgress(req.user!.uid, req.params.slug, req.query.order));
  } catch (error) {
    next(error);
  }
});

meRouter.get("/me/achievements", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await achievementService.list(req.user!.uid));
  } catch (error) {
    next(error);
  }
});

meRouter.get("/me/friends", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await friendService.list(req.user!.uid));
  } catch (error) {
    next(error);
  }
});

meRouter.post("/me/friends/request", async (req: AuthenticatedRequest, res, next) => {
  try {
    const friendCode = typeof req.body?.friendCode === "string" ? req.body.friendCode : "";
    res.status(201).json(await friendService.requestByCode(req.user!.uid, friendCode));
  } catch (error) {
    next(error);
  }
});

meRouter.patch("/me/friends/:friendUserId", async (req: AuthenticatedRequest, res, next) => {
  try {
    const status = req.body?.status;
    if (status !== "accepted" && status !== "declined" && status !== "removed") {
      throw new HttpError(400, "status must be accepted, declined, or removed.", "invalid_friend_status");
    }
    res.json(await friendService.updateStatus(req.user!.uid, req.params.friendUserId, status));
  } catch (error) {
    next(error);
  }
});

meRouter.get("/me/feed", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await friendService.feed(req.user!.uid));
  } catch (error) {
    next(error);
  }
});

meRouter.get("/me/friends/:friendUserId/compatibility", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await friendService.compatibility(req.user!.uid, req.params.friendUserId));
  } catch (error) {
    next(error);
  }
});

meRouter.get("/me/challenges", async (req: AuthenticatedRequest, res, next) => {
  try {
    const friendUserId = typeof req.query.friendUserId === "string" ? req.query.friendUserId : undefined;
    res.json(await challengeService.list(req.user!.uid, friendUserId));
  } catch (error) {
    next(error);
  }
});

meRouter.get("/me/export", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await exportService.build(req.user!.uid));
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

meRouter.post("/me/imports/resolve-tv-time-shows", async (req: AuthenticatedRequest, res, next) => {
  try {
    const shows = parseResolveTvTimeShowsBody(req.body);
    res.json(await tvTimeResolveService.resolveShows(shows));
  } catch (error) {
    next(error);
  }
});

meRouter.put("/me/imports/media-mappings", async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = parseUpsertMediaMappingInput(req.body);
    res.json({mapping: await mediaMappingService.upsert(req.user!.uid, input)});
  } catch (error) {
    next(error);
  }
});

meRouter.post("/me/imports", async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = parseCreateImportInput(req.body);
    res.status(201).json({import: await importService.create(req.user!.uid, input.provider, input.sourceHash)});
  } catch (error) {
    next(error);
  }
});

meRouter.get("/me/imports/:importId", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json({import: await importService.get(req.user!.uid, req.params.importId)});
  } catch (error) {
    next(error);
  }
});

meRouter.post("/me/imports/:importId/watchlist", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json({
      import: await importService.stageWatchlist(
        req.user!.uid,
        req.params.importId,
        parseWatchlistStageInput(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
});

meRouter.post("/me/imports/:importId/episodes", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json({
      import: await importService.stageEpisodes(
        req.user!.uid,
        req.params.importId,
        parseEpisodeStageInput(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
});

meRouter.post("/me/imports/:importId/commit", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json({import: await importService.commit(req.user!.uid, req.params.importId)});
  } catch (error) {
    next(error);
  }
});

meRouter.post("/me/imports/:importId/run", async (req: AuthenticatedRequest, res, next) => {
  try {
    const maxEpisodeWrites = Number(req.body?.maxEpisodeWrites);
    res.json(
      await importService.run(
        req.user!.uid,
        req.params.importId,
        Number.isInteger(maxEpisodeWrites) && maxEpisodeWrites > 0 ? maxEpisodeWrites : undefined,
      ),
    );
  } catch (error) {
    next(error);
  }
});
