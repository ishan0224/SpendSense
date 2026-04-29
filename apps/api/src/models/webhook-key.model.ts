import mongoose, { Schema } from "mongoose";

export type WebhookKeyDocument = {
  userId: mongoose.Types.ObjectId;
  name: string;
  secretHash: string;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const webhookKeySchema = new Schema<WebhookKeyDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    secretHash: { type: String, required: true },
    isActive: { type: Boolean, required: true, default: true },
    lastUsedAt: { type: Date, required: false }
  },
  { timestamps: true }
);

webhookKeySchema.index(
  { userId: 1, name: 1 },
  { unique: true, name: "uniq_user_webhook_key_name" }
);
webhookKeySchema.index(
  { userId: 1, isActive: 1 },
  { name: "idx_user_active_webhook_keys" }
);

export const WebhookKeyModel: mongoose.Model<WebhookKeyDocument> =
  (mongoose.models.WebhookKey as mongoose.Model<WebhookKeyDocument> | undefined) ??
  mongoose.model<WebhookKeyDocument>("WebhookKey", webhookKeySchema);
