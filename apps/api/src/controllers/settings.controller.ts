import type { Request, Response } from "express";
import { z } from "zod";
import {
  bankMappingSchema,
  budgetUpsertSchema,
  categoryRuleSchema,
  ingestionLogsQuerySchema,
  monthKeySchema,
  updateCategoryRuleSchema
} from "@spendsense/shared";
import type { RequestWithUser } from "../middlewares/resolve-user";
import { HttpError } from "../utils/http-error";
import {
  createCategoryRule,
  deleteCategoryRule,
  listCategoryRules,
  updateCategoryRule
} from "../services/settings/category-rules.service";
import { listBudgets, upsertBudget } from "../services/settings/budgets.service";
import {
  createBankMapping,
  listBankMappings,
  updateBankMapping
} from "../services/settings/bank-mappings.service";
import { listIngestionLogs } from "../services/settings/ingestion-logs.service";
import {
  createWebhookKey,
  disableWebhookKey,
  listWebhookKeys,
  rotateWebhookKey
} from "../services/settings/webhook-keys.service";

const updateBankMappingSchema = bankMappingSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "Provide at least one field to update"
);

const webhookKeyCreateSchema = z.object({
  name: z.string().trim().min(1).max(80)
});

function requireId(id: string | undefined): string {
  if (!id) {
    throw new HttpError(400, "INVALID_ID", "Identifier is required");
  }
  return id;
}

export async function listCategoryRulesController(req: Request, res: Response): Promise<void> {
  const result = await listCategoryRules((req as RequestWithUser).userId);
  res.status(200).json(result);
}

export async function createCategoryRuleController(req: Request, res: Response): Promise<void> {
  const input = categoryRuleSchema.parse(req.body);
  const result = await createCategoryRule((req as RequestWithUser).userId, input);
  res.status(201).json(result);
}

export async function updateCategoryRuleController(req: Request, res: Response): Promise<void> {
  const input = updateCategoryRuleSchema.parse(req.body);
  const id = requireId(req.params.id);
  const result = await updateCategoryRule((req as RequestWithUser).userId, id, input);
  res.status(200).json(result);
}

export async function deleteCategoryRuleController(req: Request, res: Response): Promise<void> {
  const id = requireId(req.params.id);
  const result = await deleteCategoryRule((req as RequestWithUser).userId, id);
  res.status(200).json(result);
}

export async function listBudgetsController(req: Request, res: Response): Promise<void> {
  const month = req.query.month;
  const parsedMonth =
    typeof month === "string" && month.trim().length > 0 ? monthKeySchema.parse(month) : undefined;
  const result = await listBudgets((req as RequestWithUser).userId, parsedMonth);
  res.status(200).json(result);
}

export async function upsertBudgetController(req: Request, res: Response): Promise<void> {
  const month = monthKeySchema.parse(requireId(req.params.month));
  const input = budgetUpsertSchema.parse(req.body);
  const result = await upsertBudget((req as RequestWithUser).userId, month, input);
  res.status(200).json(result);
}

export async function listBankMappingsController(req: Request, res: Response): Promise<void> {
  const result = await listBankMappings((req as RequestWithUser).userId);
  res.status(200).json(result);
}

export async function createBankMappingController(req: Request, res: Response): Promise<void> {
  const input = bankMappingSchema.parse(req.body);
  const result = await createBankMapping((req as RequestWithUser).userId, input);
  res.status(201).json(result);
}

export async function updateBankMappingController(req: Request, res: Response): Promise<void> {
  const id = requireId(req.params.id);
  const input = updateBankMappingSchema.parse(req.body);
  const result = await updateBankMapping((req as RequestWithUser).userId, id, input);
  res.status(200).json(result);
}

export async function listIngestionLogsController(req: Request, res: Response): Promise<void> {
  const query = ingestionLogsQuerySchema.parse(req.query);
  const result = await listIngestionLogs((req as RequestWithUser).userId, query);
  res.status(200).json(result);
}

export async function listWebhookKeysController(req: Request, res: Response): Promise<void> {
  const result = await listWebhookKeys((req as RequestWithUser).userId);
  res.status(200).json(result);
}

export async function createWebhookKeyController(req: Request, res: Response): Promise<void> {
  const input = webhookKeyCreateSchema.parse(req.body);
  const result = await createWebhookKey((req as RequestWithUser).userId, input);
  res.status(201).json(result);
}

export async function rotateWebhookKeyController(req: Request, res: Response): Promise<void> {
  const id = requireId(req.params.id);
  const result = await rotateWebhookKey((req as RequestWithUser).userId, id);
  res.status(200).json(result);
}

export async function disableWebhookKeyController(req: Request, res: Response): Promise<void> {
  const id = requireId(req.params.id);
  const result = await disableWebhookKey((req as RequestWithUser).userId, id);
  res.status(200).json(result);
}
