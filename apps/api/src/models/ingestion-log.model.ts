import mongoose, { Schema } from "mongoose";

export type IngestionLogDocument = {
  userId: mongoose.Types.ObjectId;
  source: "sms" | "notification" | "statement" | "manual";
  status: "parsed" | "created" | "duplicate" | "ignored" | "failed" | "reconciled";
  reason?: string;
  senderOriginal?: string;
  senderNormalized?: string;
  sourceFingerprint?: string;
  transactionId?: mongoose.Types.ObjectId;
  rawMessageSanitized?: string;
  createdAt: Date;
  updatedAt: Date;
};

const ingestionLogSchema = new Schema<IngestionLogDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    source: {
      type: String,
      required: true,
      enum: ["sms", "notification", "statement", "manual"]
    },
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

ingestionLogSchema.index(
  { userId: 1, createdAt: -1 },
  { name: "idx_user_logs_created_desc" }
);
ingestionLogSchema.index(
  { userId: 1, status: 1, createdAt: -1 },
  { name: "idx_user_logs_status" }
);
ingestionLogSchema.index(
  { userId: 1, sourceFingerprint: 1 },
  { sparse: true, name: "idx_logs_source_fingerprint" }
);

export const IngestionLogModel: mongoose.Model<IngestionLogDocument> =
  (mongoose.models.IngestionLog as mongoose.Model<IngestionLogDocument> | undefined) ??
  mongoose.model<IngestionLogDocument>("IngestionLog", ingestionLogSchema);
