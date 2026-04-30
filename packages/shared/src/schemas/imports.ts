import { z } from "zod";
import { isoDateOnlySchema, monthKeySchema, transactionDirectionSchema } from "./transactions";

export const statementFileTypeSchema = z.enum(["csv", "xlsx"]);

export const statementColumnMappingSchema = z.object({
  transactionDate: z.string().trim().min(1),
  postedDate: z.string().trim().min(1).optional(),
  debitAmount: z.string().trim().min(1).optional(),
  creditAmount: z.string().trim().min(1).optional(),
  amount: z.string().trim().min(1).optional(),
  direction: z.string().trim().min(1).optional(),
  narration: z.string().trim().min(1).optional(),
  balance: z.string().trim().min(1).optional()
});

export const statementRowSchema = z.object({
  rowNumber: z.number().int().min(1),
  amountMajor: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/),
  direction: transactionDirectionSchema,
  transactionDate: isoDateOnlySchema,
  postedDate: isoDateOnlySchema.optional(),
  merchantOriginal: z.string().trim().min(1).max(200),
  statementDescription: z.string().trim().max(500).optional(),
  bankCode: z.string().trim().max(32).optional(),
  sourceFingerprint: z.string().trim().min(16).max(128).optional()
});

export const statementPreviewResultSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  fileType: statementFileTypeSchema,
  statementMonth: monthKeySchema.optional(),
  headers: z.array(z.string()),
  previewToken: z.string().trim().min(20).max(1000),
  mapping: statementColumnMappingSchema,
  totalRows: z.number().int().min(0),
  validRows: z.number().int().min(0),
  failedRows: z.number().int().min(0),
  rows: z.array(statementRowSchema),
  errors: z.array(
    z.object({
      rowNumber: z.number().int().min(1),
      reason: z.string().trim().min(1)
    })
  )
});

export const statementCommitRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  fileType: statementFileTypeSchema,
  statementMonth: monthKeySchema.optional(),
  bankCode: z.string().trim().max(32).optional(),
  bankName: z.string().trim().max(120).optional(),
  previewToken: z.string().trim().min(20).max(1000),
  rows: z.array(statementRowSchema).min(1)
});

export const statementImportSummarySchema = z.object({
  totalRows: z.number().int().min(0),
  created: z.number().int().min(0),
  matchedWithSms: z.number().int().min(0),
  duplicatesSkipped: z.number().int().min(0),
  failed: z.number().int().min(0)
});

export const statementCommitResultSchema = z.object({
  importId: z.string(),
  status: z.enum(["imported", "failed"]),
  summary: statementImportSummarySchema
});

export const statementImportHistoryItemSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileType: statementFileTypeSchema,
  bankCode: z.string().nullable(),
  bankName: z.string().nullable(),
  statementMonth: monthKeySchema.nullable(),
  status: z.enum(["previewed", "imported", "failed"]),
  summary: statementImportSummarySchema,
  createdAt: z.string(),
  updatedAt: z.string()
});

export const statementImportHistoryResponseSchema = z.object({
  items: z.array(statementImportHistoryItemSchema)
});

export type StatementFileType = z.infer<typeof statementFileTypeSchema>;
export type StatementColumnMapping = z.infer<typeof statementColumnMappingSchema>;
export type StatementRow = z.infer<typeof statementRowSchema>;
export type StatementPreviewResult = z.infer<typeof statementPreviewResultSchema>;
export type StatementCommitRequest = z.infer<typeof statementCommitRequestSchema>;
export type StatementCommitResult = z.infer<typeof statementCommitResultSchema>;
export type StatementImportHistoryItem = z.infer<typeof statementImportHistoryItemSchema>;
export type StatementImportHistoryResponse = z.infer<typeof statementImportHistoryResponseSchema>;
