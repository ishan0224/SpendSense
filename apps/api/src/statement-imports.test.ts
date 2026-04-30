import test from "node:test";
import assert from "node:assert/strict";
import type {
  StatementCommitRequest,
  StatementImportHistoryItem
} from "@spendsense/shared";
import { buildCanonicalFingerprint, toMinorUnits } from "./utils/fingerprint";
import { normalizeMerchant } from "./utils/merchant";
import {
  commitStatementImport,
  createStatementPreviewToken,
  previewStatementImport,
  type StatementImportPersistence
} from "./services/statement-import.service";

type MemoryTxn = {
  id: string;
  bankCode?: string;
  amountMinor: number;
  direction: "debit" | "credit";
  transactionDate: Date;
  merchantNormalized: string;
  sources: Array<"manual" | "sms" | "notification" | "statement">;
  canonicalFingerprint: string;
  sourceRefs: Array<Record<string, unknown>>;
};

class MemoryStatementPersistence implements StatementImportPersistence {
  public transactions: MemoryTxn[] = [];
  public imports: StatementImportHistoryItem[] = [];
  private idCounter = 1;

  async findBySourceFingerprint(_userId: string, sourceFingerprint: string) {
    const found = this.transactions.find(
      (txn) =>
        txn.sourceRefs.some((ref) => ref.sourceFingerprint === sourceFingerprint) ||
        txn.sourceRefs.some((ref) => ref.sourceFingerprint === sourceFingerprint)
    );
    return found ? this.toExisting(found) : null;
  }

  async findByCanonicalFingerprint(_userId: string, canonicalFingerprint: string) {
    const found = this.transactions.find((txn) => txn.canonicalFingerprint === canonicalFingerprint);
    return found ? this.toExisting(found) : null;
  }

  async findFuzzyCandidates(input: {
    userId: string;
    direction: "debit" | "credit";
    amountMinor: number;
    fromDate: Date;
    toDate: Date;
  }) {
    return this.transactions
      .filter((txn) => txn.direction === input.direction && txn.amountMinor === input.amountMinor)
      .filter((txn) => txn.transactionDate >= input.fromDate && txn.transactionDate <= input.toDate)
      .map((txn) => this.toExisting(txn));
  }

  async getCategoryRules(_userId: string) {
    return [{ keywordNormalized: "SWIGGY", categoryName: "Food", priority: 100 }];
  }

  async createTransaction(input: {
    userId: string;
    amountMinor: number;
    direction: "debit" | "credit";
    currency: string;
    merchantOriginal: string;
    merchantNormalized: string;
    categoryName: string;
    paymentMode: string;
    bankCode?: string;
    transactionDate: Date;
    postedDate?: Date;
    month: string;
    sources: Array<"statement">;
    sourceRefs: Array<Record<string, unknown>>;
    canonicalFingerprint: string;
    sourceFingerprint: string;
    statementDescription?: string;
    reconciliationStatus: "verified";
  }) {
    const id = `tx-${this.idCounter++}`;
    this.transactions.push({
      id,
      bankCode: input.bankCode,
      amountMinor: input.amountMinor,
      direction: input.direction,
      transactionDate: input.transactionDate,
      merchantNormalized: input.merchantNormalized,
      sources: [...input.sources],
      canonicalFingerprint: input.canonicalFingerprint,
      sourceRefs: [...input.sourceRefs]
    });
  }

  async mergeStatementIntoTransaction(input: {
    transactionId: string;
    sourceFingerprint: string;
    statementDescription?: string;
    postedDate?: Date;
    rowNumber: number;
    importId: string;
  }) {
    const found = this.transactions.find((txn) => txn.id === input.transactionId);
    if (!found) {
      return null;
    }
    if (!found.sources.includes("statement")) {
      found.sources = [...new Set([...found.sources, "statement"])] as Array<
        "manual" | "sms" | "notification" | "statement"
      >;
    }
    found.sourceRefs.push({
      source: "statement",
      sourceFingerprint: input.sourceFingerprint,
      rowNumber: input.rowNumber,
      importId: input.importId
    });
    return this.toExisting(found);
  }

  async createStatementImport(input: {
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
  }) {
    const id = `imp-${this.idCounter++}`;
    this.imports.unshift({
      id,
      fileName: input.fileName,
      fileType: input.fileType,
      bankCode: input.bankCode ?? null,
      bankName: input.bankName ?? null,
      statementMonth: input.statementMonth ?? null,
      status: input.status,
      summary: input.summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return { id };
  }

  async updateStatementImport(input: {
    importId: string;
    status: "imported" | "failed";
    summary: {
      totalRows: number;
      created: number;
      matchedWithSms: number;
      duplicatesSkipped: number;
      failed: number;
    };
  }) {
    const found = this.imports.find((item) => item.id === input.importId);
    if (!found) {
      return;
    }
    found.status = input.status;
    found.summary = input.summary;
    found.updatedAt = new Date().toISOString();
  }

  async resolveBankName(_userId: string, bankCode?: string) {
    return bankCode ? `${bankCode} Bank` : undefined;
  }

  async listStatementImports(_userId: string) {
    return this.imports;
  }

  private toExisting(txn: MemoryTxn) {
    return {
      id: txn.id,
      sources: txn.sources,
      categoryName: "Uncategorized",
      bankCode: txn.bankCode,
      amountMinor: txn.amountMinor,
      direction: txn.direction,
      transactionDate: txn.transactionDate,
      merchantNormalized: txn.merchantNormalized,
      sourceRefs: txn.sourceRefs
    };
  }
}

function canonical(userId: string, input: {
  bankCode?: string;
  direction: "debit" | "credit";
  amountMajor: string;
  transactionDate: string;
  merchantOriginal: string;
}): string {
  return buildCanonicalFingerprint({
    userId,
    bankCode: input.bankCode ?? null,
    direction: input.direction,
    amountMinor: toMinorUnits(input.amountMajor),
    transactionDateIso: input.transactionDate,
    merchantNormalized: normalizeMerchant(input.merchantOriginal)
  });
}

test("preview parses csv with auto-detected headers", async () => {
  const csv = [
    "Date,Description,Debit,Credit",
    "29-04-2026,Swiggy order,250.00,",
    "30-04-2026,Salary,,1000.00"
  ].join("\n");

  const result = await previewStatementImport({
    fileName: "sample.csv",
    fileType: "csv",
    fileBuffer: Buffer.from(csv, "utf8"),
    bankCode: "HDFCBK"
  });

  assert.equal(result.totalRows, 2);
  assert.equal(result.validRows, 2);
  assert.equal(result.failedRows, 0);
  assert.equal(result.rows[0]?.direction, "debit");
  assert.equal(result.rows[1]?.direction, "credit");
});

test("commit reconciles matched rows, skips duplicates, and creates unmatched rows", async () => {
  const userId = "507f1f77bcf86cd799439011";
  const persistence = new MemoryStatementPersistence();

  const row1: StatementCommitRequest["rows"][number] = {
    rowNumber: 2,
    amountMajor: "250.00",
    direction: "debit",
    transactionDate: "2026-04-29",
    merchantOriginal: "Swiggy",
    bankCode: "HDFCBK",
    sourceFingerprint: "sf-row-1"
  };
  const row2: StatementCommitRequest["rows"][number] = {
    rowNumber: 3,
    amountMajor: "300.00",
    direction: "debit",
    transactionDate: "2026-04-29",
    merchantOriginal: "Coffee",
    bankCode: "HDFCBK",
    sourceFingerprint: "sf-duplicate"
  };
  const row3: StatementCommitRequest["rows"][number] = {
    rowNumber: 4,
    amountMajor: "999.00",
    direction: "debit",
    transactionDate: "2026-04-28",
    merchantOriginal: "Book Store",
    bankCode: "HDFCBK",
    sourceFingerprint: "sf-new"
  };

  persistence.transactions.push(
    {
      id: "tx-existing-sms",
      bankCode: "HDFCBK",
      amountMinor: 25000,
      direction: "debit",
      transactionDate: new Date("2026-04-29T00:00:00.000Z"),
      merchantNormalized: "SWIGGY",
      sources: ["sms"],
      canonicalFingerprint: canonical(userId, row1),
      sourceRefs: [{ source: "sms", sourceFingerprint: "sf-sms-1" }]
    },
    {
      id: "tx-existing-statement",
      bankCode: "HDFCBK",
      amountMinor: 30000,
      direction: "debit",
      transactionDate: new Date("2026-04-29T00:00:00.000Z"),
      merchantNormalized: "COFFEE",
      sources: ["statement"],
      canonicalFingerprint: canonical(userId, row2),
      sourceRefs: [{ source: "statement", sourceFingerprint: "sf-duplicate" }]
    }
  );

  const result = await commitStatementImport({
    userId,
    defaultCurrency: "INR",
    persistence,
    payload: {
      fileName: "april.csv",
      fileType: "csv",
      statementMonth: "2026-04",
      bankCode: "HDFCBK",
      previewToken: createStatementPreviewToken({
        fileName: "april.csv",
        fileType: "csv",
        statementMonth: "2026-04",
        bankCode: "HDFCBK",
        rows: [row1, row2, row3],
        expiresInSeconds: 3600
      }),
      rows: [row1, row2, row3]
    }
  });

  assert.equal(result.summary.totalRows, 3);
  assert.equal(result.summary.matchedWithSms, 1);
  assert.equal(result.summary.duplicatesSkipped, 1);
  assert.equal(result.summary.created, 1);
  assert.equal(result.summary.failed, 0);
  assert.equal(persistence.imports.length, 1);
});

test("commit rejects payload without valid preview token", async () => {
  const userId = "507f1f77bcf86cd799439011";
  const persistence = new MemoryStatementPersistence();
  const row = {
    rowNumber: 2,
    amountMajor: "100.00",
    direction: "debit" as const,
    transactionDate: "2026-04-29",
    merchantOriginal: "Test Merchant",
    bankCode: "HDFCBK",
    sourceFingerprint: "sf-token-test"
  };

  await assert.rejects(
    commitStatementImport({
      userId,
      defaultCurrency: "INR",
      persistence,
      payload: {
        fileName: "bad.csv",
        fileType: "csv",
        statementMonth: "2026-04",
        bankCode: "HDFCBK",
        previewToken: "invalid.preview.token",
        rows: [row]
      }
    }),
    (error: unknown) => error instanceof Error && error.message.includes("preview token")
  );
});
