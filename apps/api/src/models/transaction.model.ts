import mongoose, { Schema } from "mongoose";

export type TransactionDocument = {
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
  transactionDate: Date;
  postedDate?: Date;
  month: string;
  sources: Array<"manual" | "sms" | "notification" | "statement">;
  sourceRefs?: Array<Record<string, unknown>>;
  rawMessageSanitized?: string;
  statementDescription?: string;
  canonicalFingerprint: string;
  sourceFingerprint?: string;
  reconciliationStatus: "manual" | "unverified" | "verified" | "ignored";
  confidenceScore: number;
  isIgnored: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

const transactionSchema = new Schema<TransactionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true, default: "INR" },
    direction: { type: String, required: true, enum: ["debit", "credit"] },
    merchantOriginal: { type: String, required: true },
    merchantNormalized: { type: String, required: true },
    categoryName: { type: String, required: true, default: "Uncategorized" },
    paymentMode: { type: String, required: true, default: "Unknown" },
    bankCode: { type: String, required: false },
    bankName: { type: String, required: false },
    transactionDate: { type: Date, required: true },
    postedDate: { type: Date, required: false },
    month: { type: String, required: true },
    sources: { type: [String], required: true, default: ["manual"] },
    sourceRefs: { type: [Schema.Types.Mixed], required: false },
    rawMessageSanitized: { type: String, required: false },
    statementDescription: { type: String, required: false },
    canonicalFingerprint: { type: String, required: true },
    sourceFingerprint: { type: String, required: false },
    reconciliationStatus: {
      type: String,
      required: true,
      enum: ["manual", "unverified", "verified", "ignored"],
      default: "manual"
    },
    confidenceScore: { type: Number, required: true, default: 1 },
    isIgnored: { type: Boolean, required: true, default: false },
    notes: { type: String, required: false }
  },
  {
    timestamps: true
  }
);

transactionSchema.index(
  { userId: 1, canonicalFingerprint: 1 },
  {
    unique: true,
    name: "uniq_user_canonical_fingerprint",
    partialFilterExpression: { isIgnored: false }
  }
);
transactionSchema.index(
  { userId: 1, sourceFingerprint: 1 },
  { unique: true, sparse: true, name: "uniq_user_source_fingerprint" }
);
transactionSchema.index(
  { userId: 1, month: 1, direction: 1, isIgnored: 1 },
  { name: "idx_user_month_direction" }
);
transactionSchema.index({ userId: 1, transactionDate: -1 }, { name: "idx_user_date_desc" });
transactionSchema.index(
  { userId: 1, month: 1, categoryName: 1, direction: 1 },
  { name: "idx_user_category_month" }
);
transactionSchema.index(
  { userId: 1, month: 1, merchantNormalized: 1, direction: 1 },
  { name: "idx_user_merchant_month" }
);
transactionSchema.index(
  { userId: 1, bankCode: 1, amountMinor: 1, direction: 1, transactionDate: 1 },
  { name: "idx_user_bank_amount_date" }
);
transactionSchema.index(
  { merchantOriginal: "text", statementDescription: "text", rawMessageSanitized: "text" },
  { name: "idx_text_transaction_search" }
);

export const TransactionModel: mongoose.Model<TransactionDocument> =
  (mongoose.models.Transaction as mongoose.Model<TransactionDocument> | undefined) ??
  mongoose.model<TransactionDocument>("Transaction", transactionSchema);
