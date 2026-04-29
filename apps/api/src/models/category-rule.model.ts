import mongoose, { Schema } from "mongoose";

export type CategoryRuleDocument = {
  userId: mongoose.Types.ObjectId;
  keyword: string;
  keywordNormalized: string;
  categoryName: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const categoryRuleSchema = new Schema<CategoryRuleDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    keyword: { type: String, required: true, trim: true },
    keywordNormalized: { type: String, required: true, trim: true },
    categoryName: { type: String, required: true, trim: true },
    priority: { type: Number, required: true, default: 100 },
    isActive: { type: Boolean, required: true, default: true }
  },
  { timestamps: true }
);

categoryRuleSchema.index(
  { userId: 1, keywordNormalized: 1, categoryName: 1 },
  { unique: true, name: "uniq_user_keyword_category" }
);
categoryRuleSchema.index(
  { userId: 1, isActive: 1, priority: -1 },
  { name: "idx_user_active_rules" }
);

export const CategoryRuleModel: mongoose.Model<CategoryRuleDocument> =
  (mongoose.models.CategoryRule as mongoose.Model<CategoryRuleDocument> | undefined) ??
  mongoose.model<CategoryRuleDocument>("CategoryRule", categoryRuleSchema);
