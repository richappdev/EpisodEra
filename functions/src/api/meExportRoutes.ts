import {Router} from "express";
import {requireAppCheck} from "../middleware/appCheck";
import {AuthenticatedRequest, requireAuth} from "../middleware/auth";
import {exportService} from "../services/exportService";

export const meExportRouter = Router();

meExportRouter.use(requireAuth, requireAppCheck);

meExportRouter.get("/me/export", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await exportService.build(req.user!.uid));
  } catch (error) {
    next(error);
  }
});
