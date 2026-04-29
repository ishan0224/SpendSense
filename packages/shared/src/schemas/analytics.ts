import { z } from "zod";
import { monthKeySchema, transactionDirectionSchema } from "./transactions";

export const analyticsMonthQuerySchema = z.object({
  month: monthKeySchema
});

export const moneySummarySchema = z.object({
  month: monthKeySchema,
  totalSpentMinor: z.number().int().min(0),
  totalCreditedMinor: z.number().int().min(0),
  netCashflowMinor: z.number().int(),
  dailyAverageMinor: z.number().int().min(0),
  elapsedDays: z.number().int().min(1).max(31),
  monthlyBudgetMinor: z.number().int().min(0).nullable(),
  budgetUsedPercentage: z.number().min(0).nullable(),
  topCategory: z
    .object({
      categoryName: z.string(),
      totalMinor: z.number().int().min(0)
    })
    .nullable()
});

export const categoryAnalyticsItemSchema = z.object({
  categoryName: z.string(),
  totalMinor: z.number().int().min(0),
  count: z.number().int().min(0),
  percentage: z.number().min(0)
});

export const dailyAnalyticsItemSchema = z.object({
  date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/),
  totalMinor: z.number().int().min(0),
  count: z.number().int().min(0)
});

export const merchantAnalyticsItemSchema = z.object({
  merchantNormalized: z.string(),
  merchantOriginal: z.string(),
  totalMinor: z.number().int().min(0),
  count: z.number().int().min(0)
});

export const impactTransactionSchema = z.object({
  id: z.string(),
  merchantOriginal: z.string(),
  categoryName: z.string(),
  amountMinor: z.number().int().min(0),
  transactionDate: z.string(),
  direction: transactionDirectionSchema,
  impactPercentage: z.number().min(0)
});

export const analyticsListResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    month: monthKeySchema,
    items: z.array(itemSchema)
  });

export type AnalyticsMonthQuery = z.infer<typeof analyticsMonthQuerySchema>;
export type MoneySummary = z.infer<typeof moneySummarySchema>;
export type CategoryAnalyticsItem = z.infer<typeof categoryAnalyticsItemSchema>;
export type DailyAnalyticsItem = z.infer<typeof dailyAnalyticsItemSchema>;
export type MerchantAnalyticsItem = z.infer<typeof merchantAnalyticsItemSchema>;
export type ImpactTransaction = z.infer<typeof impactTransactionSchema>;
