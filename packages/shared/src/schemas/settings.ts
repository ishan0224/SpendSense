import { z } from "zod";
import { ingestionLogStatuses, transactionSources } from "../constants/domain";
import { monthKeySchema } from "./transactions";

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

export type CategoryRuleInput = z.infer<typeof categoryRuleSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type BankMappingInput = z.infer<typeof bankMappingSchema>;
export type IngestionLogInput = z.infer<typeof ingestionLogSchema>;
export type WebhookKeyInput = z.infer<typeof webhookKeySchema>;
