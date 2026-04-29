import { BankMappingModel } from "./bank-mapping.model";
import { BudgetModel } from "./budget.model";
import { CategoryRuleModel } from "./category-rule.model";
import { IngestionLogModel } from "./ingestion-log.model";
import { StatementImportModel } from "./statement-import.model";
import { TransactionModel } from "./transaction.model";
import { UserModel } from "./user.model";
import { WebhookKeyModel } from "./webhook-key.model";

export const allModels = [
  UserModel,
  TransactionModel,
  CategoryRuleModel,
  BudgetModel,
  BankMappingModel,
  IngestionLogModel,
  StatementImportModel,
  WebhookKeyModel
];

export async function syncAllModelIndexes(): Promise<void> {
  for (const model of allModels) {
    await model.syncIndexes();
  }
}
