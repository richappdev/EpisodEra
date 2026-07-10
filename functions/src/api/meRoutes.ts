import {Router} from "express";
import {AuthenticatedRequest, requireAuth} from "../middleware/auth";
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
