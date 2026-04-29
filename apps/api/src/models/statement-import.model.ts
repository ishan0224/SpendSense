import mongoose, { Schema } from "mongoose";

type StatementImportSummary = {
  totalRows: number;
  created: number;
  matchedWithSms: number;
  duplicatesSkipped: number;
  failed: number;
};

export type StatementImportDocument = {
  userId: mongoose.Types.ObjectId;
  fileName: string;
  fileType: "csv" | "xlsx";
  bankCode?: string;
  bankName?: string;
  statementMonth?: string;
  status: "previewed" | "imported" | "failed";
  summary: StatementImportSummary;
  createdAt: Date;
  updatedAt: Date;
};

const statementImportSchema = new Schema<StatementImportDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true, enum: ["csv", "xlsx"] },
    bankCode: { type: String, required: false },
    bankName: { type: String, required: false },
    statementMonth: { type: String, required: false },
    status: { type: String, required: true, enum: ["previewed", "imported", "failed"] },
    summary: {
      type: {
        totalRows: { type: Number, required: true, default: 0 },
        created: { type: Number, required: true, default: 0 },
        matchedWithSms: { type: Number, required: true, default: 0 },
        duplicatesSkipped: { type: Number, required: true, default: 0 },
        failed: { type: Number, required: true, default: 0 }
      },
      required: true
    }
  },
  { timestamps: true }
);

statementImportSchema.index(
  { userId: 1, createdAt: -1 },
  { name: "idx_user_imports_created_desc" }
);
statementImportSchema.index(
  { userId: 1, statementMonth: 1 },
  { name: "idx_user_statement_month" }
);

export const StatementImportModel: mongoose.Model<StatementImportDocument> =
  (mongoose.models.StatementImport as mongoose.Model<StatementImportDocument> | undefined) ??
  mongoose.model<StatementImportDocument>("StatementImport", statementImportSchema);
