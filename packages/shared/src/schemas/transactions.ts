import { z } from "zod";
import {
  reconciliationStatuses,
  transactionDirections,
  transactionSources
} from "../constants/transactions";

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Invalid month format");
export const isoDateOnlySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Invalid date format");

export const transactionDirectionSchema = z.enum(transactionDirections);
export const transactionSourceSchema = z.enum(transactionSources);
export const reconciliationStatusSchema = z.enum(reconciliationStatuses);

export const createTransactionSchema = z.object({
  direction: transactionDirectionSchema,
  amountMajor: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive number with up to 2 decimals"),
  currency: z.string().trim().min(3).max(3).default("INR"),
  merchantOriginal: z.string().trim().min(1).max(160),
  categoryName: z.string().trim().min(1).max(80).default("Uncategorized"),
  paymentMode: z.string().trim().min(1).max(40).default("Unknown"),
  bankCode: z.string().trim().max(32).optional(),
  transactionDate: isoDateOnlySchema,
  notes: z.string().trim().max(600).optional()
});

export const updateTransactionSchema = z
  .object({
    direction: transactionDirectionSchema.optional(),
    amountMajor: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive number with up to 2 decimals")
      .optional(),
    currency: z.string().trim().min(3).max(3).optional(),
    merchantOriginal: z.string().trim().min(1).max(160).optional(),
    categoryName: z.string().trim().min(1).max(80).optional(),
    paymentMode: z.string().trim().min(1).max(40).optional(),
    bankCode: z.string().trim().max(32).optional(),
    transactionDate: isoDateOnlySchema.optional(),
    notes: z.string().trim().max(600).optional()
  })
  .refine((input) => Object.keys(input).length > 0, "Provide at least one field to update");

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  month: monthKeySchema.optional(),
  category: z.string().trim().min(1).max(80).optional(),
  direction: transactionDirectionSchema.optional(),
  includeIgnored: z.coerce.boolean().default(false),
  q: z.string().trim().min(1).max(120).optional()
});

export const transactionResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  amountMinor: z.number().int(),
  amountMajor: z.string(),
  currency: z.string(),
  direction: transactionDirectionSchema,
  merchantOriginal: z.string(),
  merchantNormalized: z.string(),
  categoryName: z.string(),
  paymentMode: z.string(),
  bankCode: z.string().nullable(),
  transactionDate: z.string(),
  month: monthKeySchema,
  sources: z.array(transactionSourceSchema),
  reconciliationStatus: reconciliationStatusSchema,
  isIgnored: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const paginatedTransactionsResponseSchema = z.object({
  items: z.array(transactionResponseSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int()
  })
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type TransactionResponse = z.infer<typeof transactionResponseSchema>;
export type PaginatedTransactionsResponse = z.infer<typeof paginatedTransactionsResponseSchema>;
