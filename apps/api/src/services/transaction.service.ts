import mongoose, { isValidObjectId } from "mongoose";
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  PaginatedTransactionsResponse,
  TransactionResponse,
  UpdateTransactionInput
} from "@spendsense/shared";
import { TransactionModel, type TransactionDocument } from "../models/transaction.model";
import { formatIsoDateOnly, parseIsoDateOnly, toMonthKey } from "../utils/date";
import { buildCanonicalFingerprint, toMajorUnits, toMinorUnits } from "../utils/fingerprint";
import { HttpError } from "../utils/http-error";
import { normalizeMerchant } from "../utils/merchant";

type InMemoryTransaction = TransactionDocument & {
  _id: mongoose.Types.ObjectId;
};

const inMemoryTransactions = new Map<string, InMemoryTransaction>();

function usingMongo(): boolean {
  return mongoose.connection.readyState === 1;
}

function toResponse(transaction: {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amountMinor: number;
  currency: string;
  direction: "debit" | "credit";
  merchantOriginal: string;
  merchantNormalized: string;
  categoryName: string;
  paymentMode: string;
  bankCode?: string;
  transactionDate: Date;
  month: string;
  sources: Array<"manual" | "sms" | "notification" | "statement">;
  reconciliationStatus: "manual" | "unverified" | "verified" | "ignored";
  isIgnored: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}): TransactionResponse {
  return {
    id: transaction._id.toString(),
    userId: transaction.userId.toString(),
    amountMinor: transaction.amountMinor,
    amountMajor: toMajorUnits(transaction.amountMinor),
    currency: transaction.currency,
    direction: transaction.direction,
    merchantOriginal: transaction.merchantOriginal,
    merchantNormalized: transaction.merchantNormalized,
    categoryName: transaction.categoryName,
    paymentMode: transaction.paymentMode,
    bankCode: transaction.bankCode ?? null,
    transactionDate: formatIsoDateOnly(transaction.transactionDate),
    month: transaction.month,
    sources: transaction.sources,
    reconciliationStatus: transaction.reconciliationStatus,
    isIgnored: transaction.isIgnored,
    notes: transaction.notes ?? null,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString()
  };
}

function buildFingerprint(userId: string, payload: CreateTransactionInput | UpdateTransactionInput & {
  direction: "debit" | "credit";
  amountMajor: string;
  merchantOriginal: string;
  transactionDate: string;
}): { canonicalFingerprint: string; amountMinor: number; month: string; merchantNormalized: string } {
  const amountMinor = toMinorUnits(payload.amountMajor);
  const parsedDate = parseIsoDateOnly(payload.transactionDate);
  const month = toMonthKey(parsedDate);
  const merchantNormalized = normalizeMerchant(payload.merchantOriginal);

  const canonicalFingerprint = buildCanonicalFingerprint({
    userId,
    bankCode: payload.bankCode ?? null,
    direction: payload.direction,
    amountMinor,
    transactionDateIso: formatIsoDateOnly(parsedDate),
    merchantNormalized
  });

  return {
    canonicalFingerprint,
    amountMinor,
    month,
    merchantNormalized
  };
}

async function ensureNoDuplicate(userId: string, canonicalFingerprint: string, existingId?: string): Promise<void> {
  if (usingMongo()) {
    const duplicate = await TransactionModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      canonicalFingerprint,
      isIgnored: false,
      ...(existingId ? { _id: { $ne: new mongoose.Types.ObjectId(existingId) } } : {})
    }).lean();

    if (duplicate) {
      throw new HttpError(409, "DUPLICATE_TRANSACTION", "A similar transaction already exists");
    }
    return;
  }

  for (const transaction of inMemoryTransactions.values()) {
    if (
      transaction.userId.toString() === userId &&
      transaction.canonicalFingerprint === canonicalFingerprint &&
      !transaction.isIgnored &&
      (!existingId || transaction._id.toString() !== existingId)
    ) {
      throw new HttpError(409, "DUPLICATE_TRANSACTION", "A similar transaction already exists");
    }
  }
}

export async function listTransactions(
  userId: string,
  query: ListTransactionsQuery
): Promise<PaginatedTransactionsResponse> {
  if (usingMongo()) {
    const filter: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId)
    };

    if (!query.includeIgnored) {
      filter.isIgnored = false;
    }
    if (query.month) {
      filter.month = query.month;
    }
    if (query.category) {
      filter.categoryName = query.category;
    }
    if (query.direction) {
      filter.direction = query.direction;
    }
    if (query.q) {
      filter.$or = [
        { merchantOriginal: { $regex: query.q, $options: "i" } },
        { notes: { $regex: query.q, $options: "i" } }
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      TransactionModel.find(filter).sort({ transactionDate: -1, createdAt: -1 }).skip(skip).limit(query.pageSize),
      TransactionModel.countDocuments(filter)
    ]);

    return {
      items: items.map((item) => toResponse(item)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize))
      }
    };
  }

  const filtered = [...inMemoryTransactions.values()]
    .filter((item) => item.userId.toString() === userId)
    .filter((item) => (query.includeIgnored ? true : !item.isIgnored))
    .filter((item) => (query.month ? item.month === query.month : true))
    .filter((item) => (query.category ? item.categoryName === query.category : true))
    .filter((item) => (query.direction ? item.direction === query.direction : true))
    .filter((item) =>
      query.q
        ? item.merchantOriginal.toLowerCase().includes(query.q.toLowerCase()) ||
          (item.notes ?? "").toLowerCase().includes(query.q.toLowerCase())
        : true
    )
    .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());

  const start = (query.page - 1) * query.pageSize;
  const items = filtered.slice(start, start + query.pageSize);
  const total = filtered.length;

  return {
    items: items.map((item) => toResponse(item)),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize))
    }
  };
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput
): Promise<TransactionResponse> {
  const derived = buildFingerprint(userId, {
    ...input,
    direction: input.direction,
    amountMajor: input.amountMajor,
    merchantOriginal: input.merchantOriginal,
    transactionDate: input.transactionDate
  });

  await ensureNoDuplicate(userId, derived.canonicalFingerprint);

  if (usingMongo()) {
    const created = await TransactionModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      amountMinor: derived.amountMinor,
      currency: input.currency.toUpperCase(),
      direction: input.direction,
      merchantOriginal: input.merchantOriginal.trim(),
      merchantNormalized: derived.merchantNormalized,
      categoryName: input.categoryName.trim(),
      paymentMode: input.paymentMode.trim(),
      bankCode: input.bankCode?.trim(),
      transactionDate: parseIsoDateOnly(input.transactionDate),
      month: derived.month,
      sources: ["manual"],
      canonicalFingerprint: derived.canonicalFingerprint,
      confidenceScore: 1,
      reconciliationStatus: "manual",
      isIgnored: false,
      notes: input.notes?.trim()
    });

    return toResponse(created);
  }

  const now = new Date();
  const id = new mongoose.Types.ObjectId();
  const inMemory: InMemoryTransaction = {
    _id: id,
    userId: new mongoose.Types.ObjectId(userId),
    amountMinor: derived.amountMinor,
    currency: input.currency.toUpperCase(),
    direction: input.direction,
    merchantOriginal: input.merchantOriginal.trim(),
    merchantNormalized: derived.merchantNormalized,
    categoryName: input.categoryName.trim(),
    paymentMode: input.paymentMode.trim(),
    bankCode: input.bankCode?.trim(),
    transactionDate: parseIsoDateOnly(input.transactionDate),
    month: derived.month,
    sources: ["manual"],
    canonicalFingerprint: derived.canonicalFingerprint,
    confidenceScore: 1,
    reconciliationStatus: "manual",
    isIgnored: false,
    notes: input.notes?.trim(),
    createdAt: now,
    updatedAt: now
  };
  inMemoryTransactions.set(id.toString(), inMemory);

  return toResponse(inMemory);
}

async function getTransactionOrThrow(userId: string, transactionId: string): Promise<InMemoryTransaction | (TransactionDocument & { _id: mongoose.Types.ObjectId })> {
  if (!isValidObjectId(transactionId)) {
    throw new HttpError(400, "INVALID_TRANSACTION_ID", "Transaction ID is invalid");
  }

  if (usingMongo()) {
    const transaction = await TransactionModel.findOne({
      _id: new mongoose.Types.ObjectId(transactionId),
      userId: new mongoose.Types.ObjectId(userId)
    });
    if (!transaction) {
      throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction was not found");
    }
    return transaction as TransactionDocument & { _id: mongoose.Types.ObjectId };
  }

  const transaction = inMemoryTransactions.get(transactionId);
  if (!transaction || transaction.userId.toString() !== userId) {
    throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction was not found");
  }
  return transaction;
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: UpdateTransactionInput
): Promise<TransactionResponse> {
  const transaction = await getTransactionOrThrow(userId, transactionId);

  const nextDirection = input.direction ?? transaction.direction;
  const nextAmountMajor = input.amountMajor ?? toMajorUnits(transaction.amountMinor);
  const nextMerchantOriginal = input.merchantOriginal ?? transaction.merchantOriginal;
  const nextTransactionDate = input.transactionDate ?? formatIsoDateOnly(transaction.transactionDate);
  const nextBankCode = input.bankCode ?? transaction.bankCode;

  const derived = buildFingerprint(userId, {
    direction: nextDirection,
    amountMajor: nextAmountMajor,
    merchantOriginal: nextMerchantOriginal,
    transactionDate: nextTransactionDate,
    bankCode: nextBankCode
  });

  await ensureNoDuplicate(userId, derived.canonicalFingerprint, transactionId);

  const updatePatch = {
    amountMinor: derived.amountMinor,
    currency: (input.currency ?? transaction.currency).toUpperCase(),
    direction: nextDirection,
    merchantOriginal: nextMerchantOriginal.trim(),
    merchantNormalized: derived.merchantNormalized,
    categoryName: (input.categoryName ?? transaction.categoryName).trim(),
    paymentMode: (input.paymentMode ?? transaction.paymentMode).trim(),
    bankCode: nextBankCode?.trim(),
    transactionDate: parseIsoDateOnly(nextTransactionDate),
    month: derived.month,
    canonicalFingerprint: derived.canonicalFingerprint,
    notes: input.notes?.trim() ?? transaction.notes
  };

  if (usingMongo()) {
    const updated = await TransactionModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(transactionId),
        userId: new mongoose.Types.ObjectId(userId)
      },
      updatePatch,
      { new: true }
    );
    if (!updated) {
      throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction was not found");
    }
    return toResponse(updated);
  }

  const now = new Date();
  const nextTransaction: InMemoryTransaction = {
    ...(transaction as InMemoryTransaction),
    ...updatePatch,
    updatedAt: now
  };
  inMemoryTransactions.set(transactionId, nextTransaction);
  return toResponse(nextTransaction);
}

export async function ignoreTransaction(userId: string, transactionId: string): Promise<TransactionResponse> {
  const transaction = await getTransactionOrThrow(userId, transactionId);

  if (usingMongo()) {
    const updated = await TransactionModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(transactionId),
        userId: new mongoose.Types.ObjectId(userId)
      },
      {
        isIgnored: true,
        reconciliationStatus: "ignored"
      },
      { new: true }
    );
    if (!updated) {
      throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction was not found");
    }
    return toResponse(updated);
  }

  const next: InMemoryTransaction = {
    ...(transaction as InMemoryTransaction),
    isIgnored: true,
    reconciliationStatus: "ignored",
    updatedAt: new Date()
  };
  inMemoryTransactions.set(transactionId, next);
  return toResponse(next);
}

export async function restoreTransaction(userId: string, transactionId: string): Promise<TransactionResponse> {
  const transaction = await getTransactionOrThrow(userId, transactionId);

  await ensureNoDuplicate(userId, transaction.canonicalFingerprint, transactionId);

  if (usingMongo()) {
    const updated = await TransactionModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(transactionId),
        userId: new mongoose.Types.ObjectId(userId)
      },
      {
        isIgnored: false,
        reconciliationStatus: "manual"
      },
      { new: true }
    );
    if (!updated) {
      throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction was not found");
    }
    return toResponse(updated);
  }

  const next: InMemoryTransaction = {
    ...(transaction as InMemoryTransaction),
    isIgnored: false,
    reconciliationStatus: "manual",
    updatedAt: new Date()
  };
  inMemoryTransactions.set(transactionId, next);
  return toResponse(next);
}

export async function softDeleteTransaction(userId: string, transactionId: string): Promise<TransactionResponse> {
  return ignoreTransaction(userId, transactionId);
}

export function resetInMemoryTransactionsForTests(): void {
  inMemoryTransactions.clear();
}

export function listInMemoryTransactionsForAnalytics(userId: string, month: string): InMemoryTransaction[] {
  return [...inMemoryTransactions.values()].filter(
    (transaction) =>
      transaction.userId.toString() === userId &&
      transaction.month === month &&
      !transaction.isIgnored
  );
}
