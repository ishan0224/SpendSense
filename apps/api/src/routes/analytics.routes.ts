import { Router } from "express";
import {
  categoriesController,
  dailyController,
  impactController,
  merchantsController,
  summaryController
} from "../controllers/analytics.controller";
import { asyncHandler } from "../middlewares/async-handler";
import { resolveUser } from "../middlewares/resolve-user";

export const analyticsRouter = Router();

analyticsRouter.use(resolveUser);
analyticsRouter.get("/summary", asyncHandler(summaryController));
analyticsRouter.get("/categories", asyncHandler(categoriesController));
analyticsRouter.get("/daily", asyncHandler(dailyController));
analyticsRouter.get("/merchants", asyncHandler(merchantsController));
analyticsRouter.get("/impact", asyncHandler(impactController));
