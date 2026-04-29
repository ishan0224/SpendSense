import { amountMajorToMinor, deriveMonthKey, normalizeMerchant } from "./normalizers";

export type StatementRowInput = {
  amountMajor: string;
  direction: "debit" | "credit";
  transactionDate: string;
  merchantOriginal: string;
  description?: string;
};

export type NormalizedStatementRow = {
  amountMinor: number;
  direction: "debit" | "credit";
  transactionDate: Date;
  month: string;
  merchantOriginal: string;
  merchantNormalized: string;
  statementDescription?: string;
};

export function normalizeStatementRow(input: StatementRowInput): NormalizedStatementRow {
  const transactionDate = new Date(`${input.transactionDate}T00:00:00.000Z`);
  return {
    amountMinor: amountMajorToMinor(input.amountMajor),
    direction: input.direction,
    transactionDate,
    month: deriveMonthKey(transactionDate),
    merchantOriginal: input.merchantOriginal.trim(),
    merchantNormalized: normalizeMerchant(input.merchantOriginal),
    statementDescription: input.description?.trim()
  };
}
