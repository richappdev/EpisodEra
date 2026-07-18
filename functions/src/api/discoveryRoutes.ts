import {Router} from "express";
import {AuthenticatedRequest} from "../middleware/auth";
import {languageParam} from "./mediaRoutes";
import {discoveryService} from "../services/discoveryService";
import {franchiseService} from "../services/franchiseService";

export const discoveryRouter = Router();

discoveryRouter.get("/franchises", (_req, res) => {
  res.json({items: franchiseService.list()});
});

discoveryRouter.get("/franchises/:slug", (req, res, next) => {
  try {
    const catalog = franchiseService.getCatalog(req.params.slug);
    res.json(catalog);
  } catch (error) {
    next(error);
  }
});

discoveryRouter.get("/discover/suggestions", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(
      await discoveryService.suggestions(req, {
        mood: typeof req.query.mood === "string" ? req.query.mood : undefined,
        maxMinutes: typeof req.query.maxMinutes === "string" ? req.query.maxMinutes : undefined,
        providers: typeof req.query.providers === "string" ? req.query.providers : undefined,
        region: typeof req.query.region === "string" ? req.query.region : undefined,
        language: languageParam(req.query.language),
      }),
    );
  } catch (error) {
    next(error);
  }
});

discoveryRouter.get("/discover/lists/:listId", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(
      await discoveryService.list(req, req.params.listId, {
        page: typeof req.query.page === "string" ? req.query.page : undefined,
        mood: typeof req.query.mood === "string" ? req.query.mood : undefined,
        maxMinutes: typeof req.query.maxMinutes === "string" ? req.query.maxMinutes : undefined,
        providers: typeof req.query.providers === "string" ? req.query.providers : undefined,
        region: typeof req.query.region === "string" ? req.query.region : undefined,
        language: languageParam(req.query.language),
      }),
    );
  } catch (error) {
    next(error);
  }
});

discoveryRouter.get("/discover/options", (_req, res) => {
  res.json(discoveryService.options());
});
