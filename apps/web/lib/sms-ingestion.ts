import mongoose from "mongoose";
import {
  buildCanonicalFingerprint,
  buildSourceFingerprint,
  isSensitiveMessage,
  normalizeSender,
  parseSmsMessage,
  resolveCategory,
  sanitizeMessage
} from "@spendsense/parser";
import type { WebhookIngestPayload } from "@spendsense/shared";
import { connectMongoForRouteHandler } from "./mongo";
import {
  WebBankMappingModel,
  WebCategoryRuleModel,
  WebIngestionLogModel,
  WebTransactionModel
} from "./ingest-models";

type IngestionStatus = "created" | "duplicate" | "ignored" | "failed";

type IngestionResult = {
  status: IngestionStatus;
  transactionId?: string;
  reason?: string;
};

type IngestionTransactionInput = {
  userId: string;
  amountMinor: number;
  currency: string;
  direction: "debit" | "credit";
  merchantOriginal: string;
  merchantNormalized: string;
  categoryName: string;
  paymentMode: string;
  bankCode: string;
  bankName?: string;
  senderOriginal: string;
  senderNormalized: string;
  transactionDate: Date;
  month: string;
  rawMessageSanitized: string;
  canonicalFingerprint: string;
  sourceFingerprint: string;
  confidenceScore: number;
  source: "sms" | "notification";
  receivedAt: string;
};

type IngestionLogInput = {
  userId: string;
  source: "sms" | "notification";
  status: IngestionStatus;
  reason?: string;
  senderOriginal?: string;
  senderNormalized?: string;
  sourceFingerprint?: string;
  transactionId?: string;
  rawMessageSanitized?: string;
};

type CategoryRule = {
  keywordNormalized: string;
  categoryName: string;
  priority: number;
};

export type SmsIngestionPersistence = {
  findBySourceFingerprint(userId: string, sourceFingerprint: string): Promise<{ id: string } | null>;
  findByCanonicalFingerprint(userId: string, canonicalFingerprint: string): Promise<{ id: string } | null>;
  getCategoryRules(userId: string): Promise<CategoryRule[]>;
  createTransaction(input: IngestionTransactionInput): Promise<{ id: string }>;
  resolveBankName(userId: string, senderNormalized: string): Promise<string | undefined>;
  writeLog(input: IngestionLogInput): Promise<void>;
};

type SmsIngestionOptions = {
  payload: WebhookIngestPayload;
  userId: string;
  timezone: string;
  defaultCurrency: string;
  minConfidenceScore?: number;
  persistence: SmsIngestionPersistence;
};

function deriveMonthKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function detectPaymentMode(message: string): string {
  if (/upi|vpa/i.test(message)) {
    return "UPI";
  }
  if (/card|debit card|credit card/i.test(message)) {
    return "Card";
  }
  if (/imps|neft|rtgs|netbanking|net banking/i.test(message)) {
    return "NetBanking";
  }
  if (/cash|atm/i.test(message)) {
    return "Cash";
  }
  return "Unknown";
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function ingestSmsPayload({
  payload,
  userId,
  timezone,
  defaultCurrency,
  minConfidenceScore = 0.6,
  persistence
}: SmsIngestionOptions): Promise<IngestionResult> {
  if (payload.source !== "sms" && payload.source !== "notification") {
    return { status: "failed", reason: "unsupported_source" };
  }

  const senderNormalized = normalizeSender(payload.sender);

  if (isSensitiveMessage(payload.message)) {
    await persistence.writeLog({
      userId,
      source: payload.source,
      status: "ignored",
      reason: "sensitive_message",
      senderOriginal: payload.sender,
      senderNormalized
    });
    return { status: "ignored", reason: "sensitive_message" };
  }

  const sanitizedMessage = sanitizeMessage(payload.message);
  const sourceFingerprint = buildSourceFingerprint({
    source: payload.source,
    sender: payload.sender,
    sanitizedMessage,
    receivedAt: payload.receivedAt
  });

  const sourceDuplicate = await persistence.findBySourceFingerprint(userId, sourceFingerprint);
  if (sourceDuplicate) {
    await persistence.writeLog({
      userId,
      source: payload.source,
      status: "duplicate",
      reason: "source_fingerprint_match",
      senderOriginal: payload.sender,
      senderNormalized,
      sourceFingerprint,
      transactionId: sourceDuplicate.id
    });
    return { status: "duplicate", transactionId: sourceDuplicate.id };
  }

  const parsed = parseSmsMessage(sanitizedMessage);
  if (
    parsed.direction === "unknown" ||
    parsed.amountMinor === null ||
    !parsed.merchantOriginal ||
    !parsed.merchantNormalized ||
    parsed.confidenceScore < minConfidenceScore
  ) {
    await persistence.writeLog({
      userId,
      source: payload.source,
      status: "failed",
      reason: "low_confidence_parse",
      senderOriginal: payload.sender,
      senderNormalized,
      sourceFingerprint,
      rawMessageSanitized: sanitizedMessage
    });
    return { status: "failed", reason: "low_confidence_parse" };
  }

  const receivedAt = new Date(payload.receivedAt);
  const transactionDateIso = toDateOnly(receivedAt);
  const canonicalFingerprint = buildCanonicalFingerprint({
    userId,
    bankCode: senderNormalized,
    direction: parsed.direction,
    amountMinor: parsed.amountMinor,
    transactionDateIso,
    merchantNormalized: parsed.merchantNormalized
  });

  const canonicalDuplicate = await persistence.findByCanonicalFingerprint(userId, canonicalFingerprint);
  if (canonicalDuplicate) {
    await persistence.writeLog({
      userId,
      source: payload.source,
      status: "duplicate",
      reason: "canonical_fingerprint_match",
      senderOriginal: payload.sender,
      senderNormalized,
      sourceFingerprint,
      transactionId: canonicalDuplicate.id,
      rawMessageSanitized: sanitizedMessage
    });
    return { status: "duplicate", transactionId: canonicalDuplicate.id };
  }

  const rules = await persistence.getCategoryRules(userId);
  const categoryName = resolveCategory(parsed.merchantNormalized, rules);
  const transaction = await persistence.createTransaction({
    bankName: await persistence.resolveBankName(userId, senderNormalized),
    userId,
    amountMinor: parsed.amountMinor,
    currency: defaultCurrency,
    direction: parsed.direction,
    merchantOriginal: parsed.merchantOriginal,
    merchantNormalized: parsed.merchantNormalized,
    categoryName,
    paymentMode: detectPaymentMode(sanitizedMessage),
    bankCode: senderNormalized,
    senderOriginal: payload.sender,
    senderNormalized,
    transactionDate: receivedAt,
    month: deriveMonthKey(receivedAt, timezone),
    rawMessageSanitized: sanitizedMessage,
    canonicalFingerprint,
    sourceFingerprint,
    confidenceScore: parsed.confidenceScore,
    source: payload.source,
    receivedAt: payload.receivedAt
  });

  await persistence.writeLog({
    userId,
    source: payload.source,
    status: "created",
    senderOriginal: payload.sender,
    senderNormalized,
    sourceFingerprint,
    transactionId: transaction.id,
    rawMessageSanitized: sanitizedMessage
  });

  return { status: "created", transactionId: transaction.id };
}

export function createMongoSmsIngestionPersistence(): SmsIngestionPersistence {
  return {
    async findBySourceFingerprint(userId, sourceFingerprint) {
      await connectMongoForRouteHandler();
      const existing = await WebTransactionModel.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        sourceFingerprint
      }).lean();
      return existing ? { id: existing._id.toString() } : null;
    },
    async findByCanonicalFingerprint(userId, canonicalFingerprint) {
      await connectMongoForRouteHandler();
      const existing = await WebTransactionModel.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        canonicalFingerprint,
        isIgnored: false
      }).lean();
      return existing ? { id: existing._id.toString() } : null;
    },
    async getCategoryRules(userId) {
      await connectMongoForRouteHandler();
      const rules = await WebCategoryRuleModel.find({
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
      await connectMongoForRouteHandler();
      const created = await WebTransactionModel.create({
        userId: new mongoose.Types.ObjectId(input.userId),
        amountMinor: input.amountMinor,
        currency: input.currency,
        direction: input.direction,
        merchantOriginal: input.merchantOriginal,
        merchantNormalized: input.merchantNormalized,
        categoryName: input.categoryName,
        paymentMode: input.paymentMode,
        bankCode: input.bankCode,
        bankName: input.bankName,
        senderOriginal: input.senderOriginal,
        senderNormalized: input.senderNormalized,
        transactionDate: input.transactionDate,
        month: input.month,
        sources: [input.source],
        sourceRefs: [
          {
            source: input.source,
            sourceFingerprint: input.sourceFingerprint,
            receivedAt: input.receivedAt
          }
        ],
        rawMessageSanitized: input.rawMessageSanitized,
        canonicalFingerprint: input.canonicalFingerprint,
        sourceFingerprint: input.sourceFingerprint,
        reconciliationStatus: "unverified",
        confidenceScore: input.confidenceScore,
        isIgnored: false
      });
      return { id: created._id.toString() };
    },
    async resolveBankName(userId, senderNormalized) {
      await connectMongoForRouteHandler();
      const mapping = await WebBankMappingModel.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        senderCode: senderNormalized,
        isActive: true
      }).lean();
      return mapping?.bankName;
    },
    async writeLog(input) {
      await connectMongoForRouteHandler();
      await WebIngestionLogModel.create({
        userId: new mongoose.Types.ObjectId(input.userId),
        source: input.source,
        status: input.status,
        reason: input.reason,
        senderOriginal: input.senderOriginal,
        senderNormalized: input.senderNormalized,
        sourceFingerprint: input.sourceFingerprint,
        transactionId: input.transactionId
          ? new mongoose.Types.ObjectId(input.transactionId)
          : undefined,
        rawMessageSanitized: input.rawMessageSanitized
      });
    }
  };
}
