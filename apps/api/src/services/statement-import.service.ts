import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import Papa from "papaparse";
import { resolveCategory } from "@spendsense/parser";
import type {
  StatementColumnMapping,
  StatementCommitRequest,
  StatementCommitResult,
  StatementFileType,
  StatementImportHistoryItem,
  StatementPreviewResult,
  StatementRow
} from "@spendsense/shared";
import { statementRowSchema } from "@spendsense/shared";
import { env } from "../config/env";
import { CategoryRuleModel } from "../models/category-rule.model";
import { StatementImportModel } from "../models/statement-import.model";
import { TransactionModel } from "../models/transaction.model";
import { BankMappingModel } from "../models/bank-mapping.model";
import { toMonthKey } from "../utils/date";
import { buildCanonicalFingerprint, toMinorUnits } from "../utils/fingerprint";
import { HttpError } from "../utils/http-error";
import { normalizeMerchant } from "../utils/merchant";

type StatementRawRow = Record<string, string>;

type ExistingTransaction = {
  id: string;
  sources: Array<"manual" | "sms" | "notification" | "statement">;
  categoryName: string;
  bankCode?: string;
  amountMinor: number;
  direction: "debit" | "credit";
  transactionDate: Date;
  merchantNormalized: string;
  sourceRefs?: Array<Record<string, unknown>>;
};

type CategoryRule = {
  keywordNormalized: string;
  categoryName: string;
  priority: number;
};

export type StatementImportPersistence = {
  findBySourceFingerprint(userId: string, sourceFingerprint: string): Promise<ExistingTransaction | null>;
  findByCanonicalFingerprint(userId: string, canonicalFingerprint: string): Promise<ExistingTransaction | null>;
  findFuzzyCandidates(input: {
    userId: string;
    direction: "debit" | "credit";
    amountMinor: number;
    fromDate: Date;
    toDate: Date;
  }): Promise<ExistingTransaction[]>;
  getCategoryRules(userId: string): Promise<CategoryRule[]>;
  createTransaction(input: {
    userId: string;
    amountMinor: number;
    direction: "debit" | "credit";
    currency: string;
    merchantOriginal: string;
    merchantNormalized: string;
    categoryName: string;
    paymentMode: string;
    bankCode?: string;
    bankName?: string;
    transactionDate: Date;
    postedDate?: Date;
    month: string;
    sources: Array<"statement">;
    sourceRefs: Array<Record<string, unknown>>;
    canonicalFingerprint: string;
    sourceFingerprint: string;
    statementDescription?: string;
    reconciliationStatus: "verified";
  }): Promise<void>;
  mergeStatementIntoTransaction(input: {
    transactionId: string;
    sourceFingerprint: string;
    statementDescription?: string;
    postedDate?: Date;
    rowNumber: number;
    importId: string;
  }): Promise<ExistingTransaction | null>;
  createStatementImport(input: {
    userId: string;
    fileName: string;
    fileType: "csv" | "xlsx";
    bankCode?: string;
    bankName?: string;
    statementMonth?: string;
    status: "imported" | "failed";
    summary: {
      totalRows: number;
      created: number;
      matchedWithSms: number;
      duplicatesSkipped: number;
      failed: number;
    };
  }): Promise<{ id: string }>;
  updateStatementImport(input: {
    importId: string;
    status: "imported" | "failed";
    summary: {
      totalRows: number;
      created: number;
      matchedWithSms: number;
      duplicatesSkipped: number;
      failed: number;
    };
  }): Promise<void>;
  resolveBankName(userId: string, bankCode?: string): Promise<string | undefined>;
  listStatementImports(userId: string): Promise<StatementImportHistoryItem[]>;
};

function usingMongo(): boolean {
  return mongoose.connection.readyState === 1;
}

function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseAmount(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const negativeByParens = raw.includes("(") && raw.includes(")");
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") {
    return null;
  }
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return negativeByParens ? -Math.abs(parsed) : parsed;
}

function parseDirection(value: string | undefined): "debit" | "credit" | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["debit", "debited", "dr", "d", "withdrawal"].includes(normalized)) {
    return "debit";
  }
  if (["credit", "credited", "cr", "c", "deposit"].includes(normalized)) {
    return "credit";
  }
  return null;
}

function formatAmountMajor(value: number): string {
  return Math.abs(value).toFixed(2);
}

function parseDateToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const normalized = raw.replace(/\./g, "-").replace(/\s+/g, " ");

  let match = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    const year = match[1] ?? "";
    const month = match[2] ?? "";
    const day = match[3] ?? "";
    return toIsoDate(year, month, day);
  }

  match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const day = match[1] ?? "";
    const month = match[2] ?? "";
    const year = match[3] ?? "";
    return toIsoDate(year, month, day);
  }

  match = normalized.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})$/);
  if (match) {
    const dayRaw = match[1] ?? "";
    const monthRaw = match[2] ?? "";
    const yearRaw = match[3] ?? "";
    const month = monthFromName(monthRaw);
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    if (!month) {
      return null;
    }
    return toIsoDate(year, month, dayRaw);
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function monthFromName(value: string): string | null {
  const key = value.toLowerCase().slice(0, 3);
  const mapping: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12"
  };
  return mapping[key] ?? null;
}

function toIsoDate(yearRaw: string, monthRaw: string, dayRaw: string): string | null {
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function computeSourceFingerprint(input: {
  bankCode?: string;
  direction: "debit" | "credit";
  amountMajor: string;
  transactionDate: string;
  postedDate?: string;
  merchantOriginal: string;
  statementDescription?: string;
}): string {
  const payload = [
    "statement",
    input.bankCode ?? "UNKNOWN_BANK",
    input.direction,
    input.amountMajor,
    input.transactionDate,
    input.postedDate ?? "",
    normalizeMerchant(input.merchantOriginal),
    normalizeMerchant(input.statementDescription ?? "")
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signingSecretOrThrow(): string {
  const candidate = env.jwtSecret ?? process.env.WEBHOOK_SECRET_HASH ?? "dev-import-preview-secret";
  if (env.nodeEnv === "production" && candidate === "dev-import-preview-secret") {
    throw new HttpError(
      500,
      "IMPORT_PREVIEW_SECRET_MISSING",
      "Set JWT_SECRET or WEBHOOK_SECRET_HASH for preview token signing"
    );
  }
  return candidate;
}

function computePreviewDigest(input: {
  fileName: string;
  fileType: StatementFileType;
  statementMonth?: string;
  bankCode?: string;
  rows: StatementRow[];
}): string {
  const payload = {
    fileName: input.fileName,
    fileType: input.fileType,
    statementMonth: input.statementMonth ?? "",
    bankCode: input.bankCode ?? "",
    rows: [...input.rows]
      .sort((a, b) => a.rowNumber - b.rowNumber)
      .map((row) => ({
        rowNumber: row.rowNumber,
        amountMajor: row.amountMajor,
        direction: row.direction,
        transactionDate: row.transactionDate,
        postedDate: row.postedDate ?? "",
        merchantOriginal: row.merchantOriginal,
        statementDescription: row.statementDescription ?? "",
        bankCode: row.bankCode ?? "",
        sourceFingerprint: row.sourceFingerprint ?? ""
      }))
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function createStatementPreviewToken(input: {
  fileName: string;
  fileType: StatementFileType;
  statementMonth?: string;
  bankCode?: string;
  rows: StatementRow[];
  expiresInSeconds?: number;
}): string {
  const expiresInSeconds = input.expiresInSeconds ?? 30 * 60;
  const digest = computePreviewDigest(input);
  const payload = {
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    digest
  };
  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", signingSecretOrThrow())
    .update(payloadEncoded)
    .digest("base64url");
  return `${payloadEncoded}.${signature}`;
}

export function verifyStatementPreviewToken(input: {
  previewToken: string;
  fileName: string;
  fileType: StatementFileType;
  statementMonth?: string;
  bankCode?: string;
  rows: StatementRow[];
}): boolean {
  const [payloadEncoded, signatureEncoded] = input.previewToken.split(".");
  if (!payloadEncoded || !signatureEncoded) {
    return false;
  }
  const expectedSignature = createHmac("sha256", signingSecretOrThrow())
    .update(payloadEncoded)
    .digest("base64url");

  const actual = Buffer.from(signatureEncoded, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadEncoded)) as { exp?: number; digest?: string };
    if (!payload.exp || !payload.digest) {
      return false;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    const computedDigest = computePreviewDigest({
      fileName: input.fileName,
      fileType: input.fileType,
      statementMonth: input.statementMonth,
      bankCode: input.bankCode,
      rows: input.rows
    });
    return computedDigest === payload.digest;
  } catch {
    return false;
  }
}

function detectMapping(headers: string[]): StatementColumnMapping {
  const byNormalized = new Map(headers.map((header) => [normalizeHeader(header), header] as const));
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const match = byNormalized.get(key);
      if (match) {
        return match;
      }
    }
    return undefined;
  };

  return {
    transactionDate: pick("transactiondate", "date", "txn date", "valuedate") ?? headers[0] ?? "date",
    postedDate: pick("posteddate", "postdate"),
    debitAmount: pick("debitamount", "debit", "withdrawal"),
    creditAmount: pick("creditamount", "credit", "deposit"),
    amount: pick("amount", "transactionamount", "txnamount"),
    direction: pick("direction", "drcr", "type"),
    narration: pick("narration", "description", "remarks", "merchant", "particulars"),
    balance: pick("balance", "closingbalance")
  };
}

function parseFile(buffer: Buffer, fileType: StatementFileType): { headers: string[]; rows: StatementRawRow[] } {
  if (fileType === "csv") {
    const parsed = Papa.parse<Record<string, string>>(buffer.toString("utf8"), {
      header: true,
      skipEmptyLines: true
    });
    if (parsed.errors.length > 0) {
      throw new HttpError(400, "INVALID_STATEMENT_FILE", parsed.errors[0]?.message ?? "Unable to parse CSV");
    }
    const headers = parsed.meta.fields ?? [];
    return {
      headers,
      rows: (parsed.data ?? []).map((row: Record<string, string>) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, typeof value === "string" ? value : String(value ?? "")])
        )
      )
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require("xlsx") as typeof import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new HttpError(400, "INVALID_STATEMENT_FILE", "Workbook is empty");
  }
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new HttpError(400, "INVALID_STATEMENT_FILE", "Unable to read first worksheet");
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false
  });
  const headers = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
  return {
    headers,
    rows: rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, typeof value === "string" ? value : String(value ?? "")])
      )
    )
  };
}

type NormalizeRowsInput = {
  rawRows: StatementRawRow[];
  mapping: StatementColumnMapping;
  bankCode?: string;
};

function normalizeRows({ rawRows, mapping, bankCode }: NormalizeRowsInput): Pick<
  StatementPreviewResult,
  "rows" | "errors" | "validRows" | "failedRows" | "totalRows"
> {
  const rows: StatementRow[] = [];
  const errors: Array<{ rowNumber: number; reason: string }> = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const transactionDate = parseDateToken(rawRow[mapping.transactionDate]);
    if (!transactionDate) {
      errors.push({ rowNumber, reason: "Invalid transaction date" });
      return;
    }

    const postedDate = mapping.postedDate ? parseDateToken(rawRow[mapping.postedDate]) : null;

    const debitAmount = mapping.debitAmount ? parseAmount(rawRow[mapping.debitAmount]) : null;
    const creditAmount = mapping.creditAmount ? parseAmount(rawRow[mapping.creditAmount]) : null;
    const amount = mapping.amount ? parseAmount(rawRow[mapping.amount]) : null;
    const explicitDirection = mapping.direction ? parseDirection(rawRow[mapping.direction]) : null;

    let direction: "debit" | "credit" | null = null;
    let amountMajor: string | null = null;

    if ((debitAmount && Math.abs(debitAmount) > 0) || (creditAmount && Math.abs(creditAmount) > 0)) {
      if (debitAmount && Math.abs(debitAmount) > 0 && creditAmount && Math.abs(creditAmount) > 0) {
        errors.push({ rowNumber, reason: "Both debit and credit amounts are populated" });
        return;
      }
      if (debitAmount && Math.abs(debitAmount) > 0) {
        direction = "debit";
        amountMajor = formatAmountMajor(debitAmount);
      } else if (creditAmount && Math.abs(creditAmount) > 0) {
        direction = "credit";
        amountMajor = formatAmountMajor(creditAmount);
      }
    } else if (amount !== null) {
      direction = explicitDirection ?? (amount < 0 ? "debit" : "credit");
      amountMajor = formatAmountMajor(amount);
    }

    if (!direction || !amountMajor || Number(amountMajor) <= 0) {
      errors.push({ rowNumber, reason: "Unable to resolve amount and direction from mapping" });
      return;
    }

    const statementDescription = trimOrUndefined(mapping.narration ? rawRow[mapping.narration] : undefined);
    const merchantOriginal = statementDescription ?? "Statement Entry";

    const sourceFingerprint = computeSourceFingerprint({
      bankCode,
      direction,
      amountMajor,
      transactionDate,
      postedDate: postedDate ?? undefined,
      merchantOriginal,
      statementDescription
    });

    const parsed = statementRowSchema.safeParse({
      rowNumber,
      amountMajor,
      direction,
      transactionDate,
      postedDate: postedDate ?? undefined,
      merchantOriginal,
      statementDescription,
      bankCode,
      sourceFingerprint
    });

    if (!parsed.success) {
      errors.push({
        rowNumber,
        reason: parsed.error.issues.map((issue) => issue.message).join(", ")
      });
      return;
    }

    rows.push(parsed.data);
  });

  return {
    rows,
    errors,
    totalRows: rawRows.length,
    validRows: rows.length,
    failedRows: errors.length
  };
}

function hasMerchantOverlap(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }
  return left.includes(right) || right.includes(left);
}

function computeCanonicalFingerprint(userId: string, row: StatementRow, bankCode?: string): string {
  return buildCanonicalFingerprint({
    userId,
    bankCode: bankCode ?? row.bankCode ?? null,
    direction: row.direction,
    amountMinor: toMinorUnits(row.amountMajor),
    transactionDateIso: row.transactionDate,
    merchantNormalized: normalizeMerchant(row.merchantOriginal)
  });
}

export async function previewStatementImport(input: {
  fileName: string;
  fileType: StatementFileType;
  fileBuffer: Buffer;
  mapping?: Partial<StatementColumnMapping>;
  statementMonth?: string;
  bankCode?: string;
}): Promise<StatementPreviewResult> {
  const parsed = parseFile(input.fileBuffer, input.fileType);
  const autoMapping = detectMapping(parsed.headers);
  const mapping: StatementColumnMapping = {
    ...autoMapping,
    ...input.mapping
  };

  const normalized = normalizeRows({
    rawRows: parsed.rows,
    mapping,
    bankCode: trimOrUndefined(input.bankCode)
  });

  return {
    fileName: input.fileName,
    fileType: input.fileType,
    statementMonth: trimOrUndefined(input.statementMonth),
    headers: parsed.headers,
    previewToken: createStatementPreviewToken({
      fileName: input.fileName,
      fileType: input.fileType,
      statementMonth: trimOrUndefined(input.statementMonth),
      bankCode: trimOrUndefined(input.bankCode),
      rows: normalized.rows
    }),
    mapping,
    ...normalized
  };
}

export async function commitStatementImport(input: {
  userId: string;
  payload: StatementCommitRequest;
  defaultCurrency: string;
  persistence: StatementImportPersistence;
}): Promise<StatementCommitResult> {
  const isValidPreviewToken = verifyStatementPreviewToken({
    previewToken: input.payload.previewToken,
    fileName: input.payload.fileName,
    fileType: input.payload.fileType,
    statementMonth: trimOrUndefined(input.payload.statementMonth),
    bankCode: trimOrUndefined(input.payload.bankCode),
    rows: input.payload.rows
  });
  if (!isValidPreviewToken) {
    throw new HttpError(
      400,
      "INVALID_PREVIEW_TOKEN",
      "Commit requires a valid, non-expired preview token"
    );
  }

  const summary = {
    totalRows: input.payload.rows.length,
    created: 0,
    matchedWithSms: 0,
    duplicatesSkipped: 0,
    failed: 0
  };

  const categoryRules = await input.persistence.getCategoryRules(input.userId);
  const importRecord = await input.persistence.createStatementImport({
    userId: input.userId,
    fileName: input.payload.fileName,
    fileType: input.payload.fileType,
    bankCode: trimOrUndefined(input.payload.bankCode),
    bankName: trimOrUndefined(input.payload.bankName),
    statementMonth: trimOrUndefined(input.payload.statementMonth),
    status: "imported",
    summary
  });

  for (const row of input.payload.rows) {
    try {
      const bankCode = trimOrUndefined(row.bankCode ?? input.payload.bankCode);
      const sourceFingerprint =
        row.sourceFingerprint ??
        computeSourceFingerprint({
          bankCode,
          direction: row.direction,
          amountMajor: row.amountMajor,
          transactionDate: row.transactionDate,
          postedDate: row.postedDate,
          merchantOriginal: row.merchantOriginal,
          statementDescription: row.statementDescription
        });
      const canonicalFingerprint = computeCanonicalFingerprint(input.userId, row, bankCode);
      const amountMinor = toMinorUnits(row.amountMajor);
      const merchantNormalized = normalizeMerchant(row.merchantOriginal);
      const transactionDate = new Date(`${row.transactionDate}T00:00:00.000Z`);
      const postedDate = row.postedDate ? new Date(`${row.postedDate}T00:00:00.000Z`) : undefined;
      const month = toMonthKey(transactionDate);

      const sourceDuplicate = await input.persistence.findBySourceFingerprint(
        input.userId,
        sourceFingerprint
      );
      if (sourceDuplicate) {
        summary.duplicatesSkipped += 1;
        continue;
      }

      const canonicalDuplicate = await input.persistence.findByCanonicalFingerprint(
        input.userId,
        canonicalFingerprint
      );
      if (canonicalDuplicate) {
        const merged = await input.persistence.mergeStatementIntoTransaction({
          transactionId: canonicalDuplicate.id,
          sourceFingerprint,
          statementDescription: row.statementDescription,
          postedDate,
          rowNumber: row.rowNumber,
          importId: importRecord.id
        });
        if (merged && (merged.sources.includes("sms") || merged.sources.includes("notification"))) {
          summary.matchedWithSms += 1;
        } else {
          summary.duplicatesSkipped += 1;
        }
        continue;
      }

      const fromDate = new Date(transactionDate);
      fromDate.setUTCDate(fromDate.getUTCDate() - 1);
      const toDate = new Date(transactionDate);
      toDate.setUTCDate(toDate.getUTCDate() + 1);

      const candidates = await input.persistence.findFuzzyCandidates({
        userId: input.userId,
        direction: row.direction,
        amountMinor,
        fromDate,
        toDate
      });

      const fuzzyMatch = candidates.find((candidate) => {
        if (bankCode && candidate.bankCode && candidate.bankCode !== bankCode) {
          return false;
        }
        return hasMerchantOverlap(candidate.merchantNormalized, merchantNormalized);
      });

      if (fuzzyMatch) {
        const merged = await input.persistence.mergeStatementIntoTransaction({
          transactionId: fuzzyMatch.id,
          sourceFingerprint,
          statementDescription: row.statementDescription,
          postedDate,
          rowNumber: row.rowNumber,
          importId: importRecord.id
        });
        if (merged && (merged.sources.includes("sms") || merged.sources.includes("notification"))) {
          summary.matchedWithSms += 1;
        } else {
          summary.duplicatesSkipped += 1;
        }
        continue;
      }

      const categoryName = resolveCategory(merchantNormalized, categoryRules);
      const bankName = await input.persistence.resolveBankName(input.userId, bankCode);

      await input.persistence.createTransaction({
        userId: input.userId,
        amountMinor,
        direction: row.direction,
        currency: input.defaultCurrency,
        merchantOriginal: row.merchantOriginal,
        merchantNormalized,
        categoryName,
        paymentMode: "Statement",
        bankCode,
        bankName,
        transactionDate,
        postedDate,
        month,
        sources: ["statement"],
        sourceRefs: [
          {
            source: "statement",
            sourceFingerprint,
            rowNumber: row.rowNumber,
            importId: importRecord.id
          }
        ],
        canonicalFingerprint,
        sourceFingerprint,
        statementDescription: row.statementDescription,
        reconciliationStatus: "verified"
      });

      summary.created += 1;
    } catch (_error) {
      summary.failed += 1;
    }
  }

  const finalStatus =
    summary.failed > 0 && summary.created === 0 && summary.matchedWithSms === 0 ? "failed" : "imported";
  await input.persistence.updateStatementImport({
    importId: importRecord.id,
    summary,
    status: finalStatus
  });

  return {
    importId: importRecord.id,
    status: finalStatus,
    summary
  };
}

export async function listStatementImports(
  userId: string,
  persistence: StatementImportPersistence
): Promise<{ items: StatementImportHistoryItem[] }> {
  const items = await persistence.listStatementImports(userId);
  return { items };
}

export function createMongoStatementImportPersistence(): StatementImportPersistence {
  return {
    async findBySourceFingerprint(userId, sourceFingerprint) {
      const existing = await TransactionModel.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        $or: [
          { sourceFingerprint },
          { sourceRefs: { $elemMatch: { sourceFingerprint } } }
        ]
      });
      if (!existing) {
        return null;
      }
      return {
        id: existing._id.toString(),
        sources: existing.sources,
        categoryName: existing.categoryName,
        bankCode: existing.bankCode,
        amountMinor: existing.amountMinor,
        direction: existing.direction,
        transactionDate: existing.transactionDate,
        merchantNormalized: existing.merchantNormalized,
        sourceRefs: existing.sourceRefs as Array<Record<string, unknown>> | undefined
      };
    },
    async findByCanonicalFingerprint(userId, canonicalFingerprint) {
      const existing = await TransactionModel.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        canonicalFingerprint,
        isIgnored: false
      });
      if (!existing) {
        return null;
      }
      return {
        id: existing._id.toString(),
        sources: existing.sources,
        categoryName: existing.categoryName,
        bankCode: existing.bankCode,
        amountMinor: existing.amountMinor,
        direction: existing.direction,
        transactionDate: existing.transactionDate,
        merchantNormalized: existing.merchantNormalized,
        sourceRefs: existing.sourceRefs as Array<Record<string, unknown>> | undefined
      };
    },
    async findFuzzyCandidates(input) {
      const rows = await TransactionModel.find({
        userId: new mongoose.Types.ObjectId(input.userId),
        isIgnored: false,
        direction: input.direction,
        amountMinor: input.amountMinor,
        transactionDate: { $gte: input.fromDate, $lte: input.toDate }
      })
        .sort({ transactionDate: 1 })
        .limit(20);

      return rows.map((row) => ({
        id: row._id.toString(),
        sources: row.sources,
        categoryName: row.categoryName,
        bankCode: row.bankCode,
        amountMinor: row.amountMinor,
        direction: row.direction,
        transactionDate: row.transactionDate,
        merchantNormalized: row.merchantNormalized,
        sourceRefs: row.sourceRefs as Array<Record<string, unknown>> | undefined
      }));
    },
    async getCategoryRules(userId) {
      const rules = await CategoryRuleModel.find({
        userId: new mongoose.Types.ObjectId(userId),
        isActive: true
      })
        .sort({ priority: -1 })
        .lean();

      return rules.map((rule) => ({
        keywordNormalized: rule.keywordNormalized,
        categoryName: rule.categoryName,
        priority: rule.priority
      }));
    },
    async createTransaction(input) {
      await TransactionModel.create({
        userId: new mongoose.Types.ObjectId(input.userId),
        amountMinor: input.amountMinor,
        direction: input.direction,
        currency: input.currency,
        merchantOriginal: input.merchantOriginal,
        merchantNormalized: input.merchantNormalized,
        categoryName: input.categoryName,
        paymentMode: input.paymentMode,
        bankCode: input.bankCode,
        bankName: input.bankName,
        transactionDate: input.transactionDate,
        postedDate: input.postedDate,
        month: input.month,
        sources: input.sources,
        sourceRefs: input.sourceRefs,
        canonicalFingerprint: input.canonicalFingerprint,
        sourceFingerprint: input.sourceFingerprint,
        statementDescription: input.statementDescription,
        reconciliationStatus: input.reconciliationStatus,
        confidenceScore: 1,
        isIgnored: false
      });
    },
    async resolveBankName(userId, bankCode) {
      if (!bankCode) {
        return undefined;
      }
      const mapping = await BankMappingModel.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        senderCode: bankCode,
        isActive: true
      }).lean();
      return mapping?.bankName;
    },
    async mergeStatementIntoTransaction(input) {
      const existing = await TransactionModel.findById(input.transactionId);
      if (!existing) {
        return null;
      }
      const hasRef = (existing.sourceRefs ?? []).some((ref) => ref?.sourceFingerprint === input.sourceFingerprint);
      if (hasRef || existing.sources.includes("statement")) {
        return {
          id: existing._id.toString(),
          sources: existing.sources,
          categoryName: existing.categoryName,
          bankCode: existing.bankCode,
          amountMinor: existing.amountMinor,
          direction: existing.direction,
          transactionDate: existing.transactionDate,
          merchantNormalized: existing.merchantNormalized,
          sourceRefs: existing.sourceRefs as Array<Record<string, unknown>> | undefined
        };
      }

      const nextSources = [...new Set([...existing.sources, "statement"])] as Array<
        "manual" | "sms" | "notification" | "statement"
      >;
      const nextRefs = [
        ...(existing.sourceRefs ?? []),
        {
          source: "statement",
          sourceFingerprint: input.sourceFingerprint,
          rowNumber: input.rowNumber,
          importId: input.importId
        }
      ];

      await TransactionModel.findByIdAndUpdate(existing._id, {
        sources: nextSources,
        sourceRefs: nextRefs,
        reconciliationStatus: "verified",
        ...(input.statementDescription ? { statementDescription: input.statementDescription } : {}),
        ...(input.postedDate ? { postedDate: input.postedDate } : {})
      });

      return {
        id: existing._id.toString(),
        sources: existing.sources,
        categoryName: existing.categoryName,
        bankCode: existing.bankCode,
        amountMinor: existing.amountMinor,
        direction: existing.direction,
        transactionDate: existing.transactionDate,
        merchantNormalized: existing.merchantNormalized,
        sourceRefs: existing.sourceRefs as Array<Record<string, unknown>> | undefined
      };
    },
    async createStatementImport(input) {
      const created = await StatementImportModel.create({
        userId: new mongoose.Types.ObjectId(input.userId),
        fileName: input.fileName,
        fileType: input.fileType,
        bankCode: input.bankCode,
        bankName: input.bankName,
        statementMonth: input.statementMonth,
        status: input.status,
        summary: input.summary
      });
      return { id: created._id.toString() };
    },
    async listStatementImports(userId) {
      const rows = await StatementImportModel.find({
        userId: new mongoose.Types.ObjectId(userId)
      })
        .sort({ createdAt: -1 })
        .limit(100);

      return rows.map((row) => ({
        id: row._id.toString(),
        fileName: row.fileName,
        fileType: row.fileType,
        bankCode: row.bankCode ?? null,
        bankName: row.bankName ?? null,
        statementMonth: row.statementMonth ?? null,
        status: row.status,
        summary: row.summary,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
      }));
    },
    async updateStatementImport(input) {
      await StatementImportModel.findByIdAndUpdate(input.importId, {
        summary: input.summary,
        status: input.status
      });
    }
  };
}

export function assertStatementImportsSupported(): void {
  if (!usingMongo()) {
    throw new HttpError(
      503,
      "STATEMENT_IMPORT_REQUIRES_DATABASE",
      "Statement import requires MongoDB connection"
    );
  }
}
