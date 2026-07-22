import {Router} from "express";
import {parsePaginationQuery} from "../lib/pagination";
import {requireAppCheck} from "../middleware/appCheck";
import {AuthenticatedRequest, requireAuth} from "../middleware/auth";
import {likesService, parseAddLikedItemInput} from "../services/likesService";

export const likesRouter = Router();

likesRouter.use(requireAuth, requireAppCheck);

likesRouter.get("/likes", async (req: AuthenticatedRequest, res, next) => {
  try {
    const page = await likesService.list(req.user!.uid, parsePaginationQuery(req.query));
    const items = await likesService.backfillMissingImages(req.user!.uid, page.items);
    res.json({...page, items});
  } catch (error) {
    next(error);
  }
});

likesRouter.post("/likes", async (req: AuthenticatedRequest, res, next) => {
  try {
    const item = await likesService.add(req.user!.uid, parseAddLikedItemInput(req.body));
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

likesRouter.delete("/likes/:itemId", async (req: AuthenticatedRequest, res, next) => {
  try {
    await likesService.remove(req.user!.uid, req.params.itemId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
