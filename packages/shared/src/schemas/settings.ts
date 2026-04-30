import { z } from "zod";
import { ingestionLogStatuses, transactionSources } from "../constants/domain";
import { monthKeySchema } from "./transactions";
import { paginationMetaSchema } from "./pagination";

export const categoryRuleSchema = z.object({
  keyword: z.string().trim().min(1).max(100),
  categoryName: z.string().trim().min(1).max(80),
  priority: z.number().int().min(0).max(1000).default(100),
  isActive: z.boolean().default(true)
});

export const budgetSchema = z.object({
  month: monthKeySchema,
  monthlyBudgetMajor: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/),
  categoryBudgets: z
    .array(
      z.object({
        categoryName: z.string().trim().min(1).max(80),
        budgetMajor: z
          .string()
          .trim()
          .regex(/^\d+(\.\d{1,2})?$/)
      })
    )
    .default([])
});

export const bankMappingSchema = z.object({
  senderCode: z.string().trim().min(1).max(32),
  bankName: z.string().trim().min(1).max(120),
  accountLabel: z.string().trim().max(120).optional(),
  accountLast4: z.string().trim().regex(/^\d{4}$/).optional(),
  isActive: z.boolean().default(true)
});

export const ingestionLogSchema = z.object({
  source: z.enum(transactionSources),
  status: z.enum(ingestionLogStatuses),
  reason: z.string().trim().max(200).optional(),
  senderOriginal: z.string().trim().max(120).optional(),
  senderNormalized: z.string().trim().max(60).optional(),
  sourceFingerprint: z.string().trim().max(128).optional(),
  rawMessageSanitized: z.string().trim().max(2000).optional()
});

export const webhookKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  secretHash: z.string().trim().min(20).max(256),
  isActive: z.boolean().default(true)
});

export const updateCategoryRuleSchema = categoryRuleSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "Provide at least one field to update"
);

export const budgetUpsertSchema = budgetSchema.omit({ month: true });

export const ingestionLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  source: z.enum(transactionSources).optional(),
  status: z.enum(ingestionLogStatuses).optional(),
  fromDate: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
    .optional()
});

export const categoryRuleResponseSchema = z.object({
  id: z.string(),
  keyword: z.string(),
  keywordNormalized: z.string(),
  categoryName: z.string(),
  priority: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const budgetResponseSchema = z.object({
  id: z.string(),
  month: monthKeySchema,
  monthlyBudgetMajor: z.string(),
  categoryBudgets: z.array(
    z.object({
      categoryName: z.string(),
      budgetMajor: z.string()
    })
  ),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const bankMappingResponseSchema = z.object({
  id: z.string(),
  senderCode: z.string(),
  bankName: z.string(),
  accountLabel: z.string().nullable(),
  accountLast4: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ingestionLogResponseSchema = z.object({
  id: z.string(),
  source: z.enum(transactionSources),
  status: z.enum(ingestionLogStatuses),
  reason: z.string().nullable(),
  senderOriginal: z.string().nullable(),
  senderNormalized: z.string().nullable(),
  sourceFingerprint: z.string().nullable(),
  transactionId: z.string().nullable(),
  rawMessageSanitized: z.string().nullable(),
  createdAt: z.string()
});

export const webhookKeyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const webhookKeyCreateResponseSchema = z.object({
  key: webhookKeyResponseSchema,
  plaintextSecret: z.string()
});

export const webhookKeyRotateResponseSchema = z.object({
  key: webhookKeyResponseSchema,
  plaintextSecret: z.string()
});

export const listCategoryRulesResponseSchema = z.object({
  items: z.array(categoryRuleResponseSchema)
});

export const listBudgetsResponseSchema = z.object({
  items: z.array(budgetResponseSchema)
});

export const listBankMappingsResponseSchema = z.object({
  items: z.array(bankMappingResponseSchema)
});

export const listIngestionLogsResponseSchema = z.object({
  items: z.array(ingestionLogResponseSchema),
  pagination: paginationMetaSchema
});

export const listWebhookKeysResponseSchema = z.object({
  items: z.array(webhookKeyResponseSchema)
});

export type CategoryRuleInput = z.infer<typeof categoryRuleSchema>;
export type UpdateCategoryRuleInput = z.infer<typeof updateCategoryRuleSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type BudgetUpsertInput = z.infer<typeof budgetUpsertSchema>;
export type BankMappingInput = z.infer<typeof bankMappingSchema>;
export type IngestionLogInput = z.infer<typeof ingestionLogSchema>;
export type WebhookKeyInput = z.infer<typeof webhookKeySchema>;
export type IngestionLogsQuery = z.infer<typeof ingestionLogsQuerySchema>;
export type CategoryRuleResponse = z.infer<typeof categoryRuleResponseSchema>;
export type BudgetResponse = z.infer<typeof budgetResponseSchema>;
export type BankMappingResponse = z.infer<typeof bankMappingResponseSchema>;
export type IngestionLogResponse = z.infer<typeof ingestionLogResponseSchema>;
export type WebhookKeyResponse = z.infer<typeof webhookKeyResponseSchema>;
export type WebhookKeyCreateResponse = z.infer<typeof webhookKeyCreateResponseSchema>;
export type WebhookKeyRotateResponse = z.infer<typeof webhookKeyRotateResponseSchema>;
export type ListCategoryRulesResponse = z.infer<typeof listCategoryRulesResponseSchema>;
export type ListBudgetsResponse = z.infer<typeof listBudgetsResponseSchema>;
export type ListBankMappingsResponse = z.infer<typeof listBankMappingsResponseSchema>;
export type ListIngestionLogsResponse = z.infer<typeof listIngestionLogsResponseSchema>;
export type ListWebhookKeysResponse = z.infer<typeof listWebhookKeysResponseSchema>;
