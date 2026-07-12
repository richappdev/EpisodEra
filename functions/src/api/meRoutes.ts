import {Router} from "express";
import {AuthenticatedRequest, requireAuth} from "../middleware/auth";
import {historyService} from "../services/historyService";
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
    res.json({items: await historyService.list(req.user!.uid)});
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
