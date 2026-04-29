import mongoose, { Schema } from "mongoose";

export type UserDocument = {
  email: string;
  name: string;
  timezone: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    timezone: { type: String, required: true, default: "Asia/Kolkata" },
    currency: { type: String, required: true, default: "INR" }
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, name: "uniq_user_email" });

export const UserModel: mongoose.Model<UserDocument> =
  (mongoose.models.User as mongoose.Model<UserDocument> | undefined) ??
  mongoose.model<UserDocument>("User", userSchema);
