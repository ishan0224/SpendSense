import mongoose, { Schema } from "mongoose";

type CategoryBudget = {
  categoryName: string;
  budgetMinor: number;
};

export type BudgetDocument = {
  userId: mongoose.Types.ObjectId;
  month: string;
  monthlyBudgetMinor: number;
  categoryBudgets: CategoryBudget[];
  createdAt: Date;
  updatedAt: Date;
};

const budgetSchema = new Schema<BudgetDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    month: { type: String, required: true },
    monthlyBudgetMinor: { type: Number, required: true },
    categoryBudgets: {
      type: [
        {
          categoryName: { type: String, required: true },
          budgetMinor: { type: Number, required: true }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

budgetSchema.index({ userId: 1, month: 1 }, { unique: true, name: "uniq_user_month_budget" });

export const BudgetModel: mongoose.Model<BudgetDocument> =
  (mongoose.models.Budget as mongoose.Model<BudgetDocument> | undefined) ??
  mongoose.model<BudgetDocument>("Budget", budgetSchema);
