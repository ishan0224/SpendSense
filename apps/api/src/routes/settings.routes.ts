import { Router } from "express";
import { asyncHandler } from "../middlewares/async-handler";
import { resolveUser } from "../middlewares/resolve-user";
import {
  createBankMappingController,
  createCategoryRuleController,
  createWebhookKeyController,
  deleteCategoryRuleController,
  disableWebhookKeyController,
  listBankMappingsController,
  listBudgetsController,
  listCategoryRulesController,
  listIngestionLogsController,
  listWebhookKeysController,
  rotateWebhookKeyController,
  updateBankMappingController,
  updateCategoryRuleController,
  upsertBudgetController
} from "../controllers/settings.controller";

export const settingsRouter = Router();

settingsRouter.use(resolveUser);

settingsRouter.get("/category-rules", asyncHandler(listCategoryRulesController));
settingsRouter.post("/category-rules", asyncHandler(createCategoryRuleController));
settingsRouter.patch("/category-rules/:id", asyncHandler(updateCategoryRuleController));
settingsRouter.delete("/category-rules/:id", asyncHandler(deleteCategoryRuleController));

settingsRouter.get("/budgets", asyncHandler(listBudgetsController));
settingsRouter.put("/budgets/:month", asyncHandler(upsertBudgetController));

settingsRouter.get("/bank-mappings", asyncHandler(listBankMappingsController));
settingsRouter.post("/bank-mappings", asyncHandler(createBankMappingController));
settingsRouter.patch("/bank-mappings/:id", asyncHandler(updateBankMappingController));

settingsRouter.get("/ingestion-logs", asyncHandler(listIngestionLogsController));

settingsRouter.get("/webhook-keys", asyncHandler(listWebhookKeysController));
settingsRouter.post("/webhook-keys", asyncHandler(createWebhookKeyController));
settingsRouter.post("/webhook-keys/:id/rotate", asyncHandler(rotateWebhookKeyController));
settingsRouter.post("/webhook-keys/:id/disable", asyncHandler(disableWebhookKeyController));
