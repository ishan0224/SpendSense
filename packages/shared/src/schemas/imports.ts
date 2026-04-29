import { z } from "zod";
import { isoDateOnlySchema, monthKeySchema, transactionDirectionSchema } from "./transactions";

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
  bankCode: z.string().trim().max(32).optional()
});

export const statementPreviewRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  fileType: z.enum(["csv", "xlsx"]),
  statementMonth: monthKeySchema.optional(),
  rows: z.array(statementRowSchema).min(1)
});

export type StatementRow = z.infer<typeof statementRowSchema>;
export type StatementPreviewRequest = z.infer<typeof statementPreviewRequestSchema>;
