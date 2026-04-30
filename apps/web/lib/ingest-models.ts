import mongoose, { Schema } from "mongoose";

type WebTransactionDocument = {
  userId: mongoose.Types.ObjectId;
  amountMinor: number;
  currency: string;
  direction: "debit" | "credit";
  merchantOriginal: string;
  merchantNormalized: string;
  categoryName: string;
  paymentMode: string;
  bankCode?: string;
  bankName?: string;
  senderOriginal?: string;
  senderNormalized?: string;
  transactionDate: Date;
  month: string;
  sources: Array<"sms" | "notification" | "statement" | "manual">;
  sourceRefs?: Array<Record<string, unknown>>;
  rawMessageSanitized?: string;
  canonicalFingerprint: string;
  sourceFingerprint?: string;
  reconciliationStatus: "unverified" | "verified" | "manual" | "ignored";
  confidenceScore: number;
  isIgnored: boolean;
};

type WebIngestionLogDocument = {
  userId: mongoose.Types.ObjectId;
  source: "sms" | "notification" | "statement" | "manual";
  status: "parsed" | "created" | "duplicate" | "ignored" | "failed" | "reconciled";
  reason?: string;
  senderOriginal?: string;
  senderNormalized?: string;
  sourceFingerprint?: string;
  transactionId?: mongoose.Types.ObjectId;
  rawMessageSanitized?: string;
};

type WebCategoryRuleDocument = {
  userId: mongoose.Types.ObjectId;
  keywordNormalized: string;
  categoryName: string;
  priority: number;
  isActive: boolean;
};

type WebBankMappingDocument = {
  userId: mongoose.Types.ObjectId;
  senderCode: string;
  bankName: string;
  accountLabel?: string;
  accountLast4?: string;
  isActive: boolean;
};

type WebWebhookKeyDocument = {
  userId: mongoose.Types.ObjectId;
  name: string;
  secretHash: string;
  isActive: boolean;
  lastUsedAt?: Date;
};

const transactionSchema = new Schema<WebTransactionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true, default: "INR" },
    direction: { type: String, required: true, enum: ["debit", "credit"] },
    merchantOriginal: { type: String, required: true },
    merchantNormalized: { type: String, required: true },
    categoryName: { type: String, required: true },
    paymentMode: { type: String, required: true, default: "Unknown" },
    bankCode: { type: String, required: false },
    bankName: { type: String, required: false },
    senderOriginal: { type: String, required: false },
    senderNormalized: { type: String, required: false },
    transactionDate: { type: Date, required: true },
    month: { type: String, required: true },
    sources: { type: [String], required: true },
    sourceRefs: { type: [Schema.Types.Mixed], required: false },
    rawMessageSanitized: { type: String, required: false },
    canonicalFingerprint: { type: String, required: true },
    sourceFingerprint: { type: String, required: false },
    reconciliationStatus: {
      type: String,
      required: true,
      enum: ["unverified", "verified", "manual", "ignored"]
    },
    confidenceScore: { type: Number, required: true },
    isIgnored: { type: Boolean, required: true, default: false }
  },
  { timestamps: true }
);

const ingestionLogSchema = new Schema<WebIngestionLogDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    source: { type: String, required: true, enum: ["sms", "notification", "statement", "manual"] },
    status: {
      type: String,
      required: true,
      enum: ["parsed", "created", "duplicate", "ignored", "failed", "reconciled"]
    },
    reason: { type: String, required: false },
    senderOriginal: { type: String, required: false },
    senderNormalized: { type: String, required: false },
    sourceFingerprint: { type: String, required: false },
    transactionId: { type: Schema.Types.ObjectId, required: false },
    rawMessageSanitized: { type: String, required: false }
  },
  { timestamps: true }
);

const categoryRuleSchema = new Schema<WebCategoryRuleDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    keywordNormalized: { type: String, required: true },
    categoryName: { type: String, required: true },
    priority: { type: Number, required: true, default: 100 },
    isActive: { type: Boolean, required: true, default: true }
  },
  { timestamps: true }
);

const bankMappingSchema = new Schema<WebBankMappingDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    senderCode: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    accountLabel: { type: String, required: false, trim: true },
    accountLast4: { type: String, required: false, trim: true },
    isActive: { type: Boolean, required: true, default: true }
  },
  { timestamps: true }
);

const webhookKeySchema = new Schema<WebWebhookKeyDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    secretHash: { type: String, required: true },
    isActive: { type: Boolean, required: true, default: true },
    lastUsedAt: { type: Date, required: false }
  },
  { timestamps: true }
);

export const WebTransactionModel: mongoose.Model<WebTransactionDocument> =
  (mongoose.models.Transaction as mongoose.Model<WebTransactionDocument> | undefined) ??
  mongoose.model<WebTransactionDocument>("Transaction", transactionSchema);

export const WebIngestionLogModel: mongoose.Model<WebIngestionLogDocument> =
  (mongoose.models.IngestionLog as mongoose.Model<WebIngestionLogDocument> | undefined) ??
  mongoose.model<WebIngestionLogDocument>("IngestionLog", ingestionLogSchema);

export const WebCategoryRuleModel: mongoose.Model<WebCategoryRuleDocument> =
  (mongoose.models.CategoryRule as mongoose.Model<WebCategoryRuleDocument> | undefined) ??
  mongoose.model<WebCategoryRuleDocument>("CategoryRule", categoryRuleSchema);

export const WebBankMappingModel: mongoose.Model<WebBankMappingDocument> =
  (mongoose.models.BankMapping as mongoose.Model<WebBankMappingDocument> | undefined) ??
  mongoose.model<WebBankMappingDocument>("BankMapping", bankMappingSchema);

export const WebWebhookKeyModel: mongoose.Model<WebWebhookKeyDocument> =
  (mongoose.models.WebhookKey as mongoose.Model<WebWebhookKeyDocument> | undefined) ??
  mongoose.model<WebWebhookKeyDocument>("WebhookKey", webhookKeySchema);
