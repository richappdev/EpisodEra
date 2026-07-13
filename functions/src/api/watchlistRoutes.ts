import {Router} from "express";
import {parsePaginationQuery} from "../lib/pagination";
import {AuthenticatedRequest, requireAuth} from "../middleware/auth";
import {
  parseAddWatchlistItemInput,
  parseWatchlistStatusInput,
  watchlistService,
} from "../services/watchlistService";

export const watchlistRouter = Router();

watchlistRouter.use(requireAuth);

watchlistRouter.get("/watchlist", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await watchlistService.list(req.user!.uid, parsePaginationQuery(req.query)));
  } catch (error) {
    next(error);
  }
});

watchlistRouter.post("/watchlist", async (req: AuthenticatedRequest, res, next) => {
  try {
    const item = await watchlistService.add(req.user!.uid, parseAddWatchlistItemInput(req.body));
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

watchlistRouter.patch("/watchlist/:itemId/status", async (req: AuthenticatedRequest, res, next) => {
  try {
    const item = await watchlistService.updateStatus(
      req.user!.uid,
      req.params.itemId,
      parseWatchlistStatusInput(req.body),
    );
    res.json(item);
  } catch (error) {
    next(error);
  }
});

watchlistRouter.delete("/watchlist/:itemId", async (req: AuthenticatedRequest, res, next) => {
  try {
    await watchlistService.remove(req.user!.uid, req.params.itemId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
