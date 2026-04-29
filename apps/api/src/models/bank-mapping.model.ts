import mongoose, { Schema } from "mongoose";

export type BankMappingDocument = {
  userId: mongoose.Types.ObjectId;
  senderCode: string;
  bankName: string;
  accountLabel?: string;
  accountLast4?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const bankMappingSchema = new Schema<BankMappingDocument>(
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

bankMappingSchema.index(
  { userId: 1, senderCode: 1 },
  { unique: true, name: "uniq_user_sender_code" }
);
bankMappingSchema.index({ userId: 1, isActive: 1 }, { name: "idx_user_active_bank_mappings" });

export const BankMappingModel: mongoose.Model<BankMappingDocument> =
  (mongoose.models.BankMapping as mongoose.Model<BankMappingDocument> | undefined) ??
  mongoose.model<BankMappingDocument>("BankMapping", bankMappingSchema);
