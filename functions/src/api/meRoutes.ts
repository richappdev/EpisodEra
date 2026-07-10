import {Router} from "express";
import {AuthenticatedRequest, requireAuth} from "../middleware/auth";
import {historyService} from "../services/historyService";
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
    res.json({items: await historyService.list(req.user!.uid)});
  } catch (error) {
    next(error);
  }
});
