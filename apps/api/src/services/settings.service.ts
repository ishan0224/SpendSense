import { createHash, randomBytes } from "node:crypto";
import mongoose, { isValidObjectId } from "mongoose";
import type {
  BankMappingInput,
  BankMappingResponse,
  BudgetInput,
  BudgetResponse,
  BudgetUpsertInput,
  CategoryRuleInput,
  CategoryRuleResponse,
  IngestionLogResponse,
  IngestionLogsQuery,
  ListBankMappingsResponse,
  ListBudgetsResponse,
  ListCategoryRulesResponse,
  ListIngestionLogsResponse,
  ListWebhookKeysResponse,
  UpdateCategoryRuleInput,
  WebhookKeyCreateResponse,
  WebhookKeyResponse,
  WebhookKeyRotateResponse
} from "@spendsense/shared";
import { normalizeSender } from "@spendsense/parser";
import { BankMappingModel } from "../models/bank-mapping.model";
import { BudgetModel } from "../models/budget.model";
import { CategoryRuleModel } from "../models/category-rule.model";
import { IngestionLogModel } from "../models/ingestion-log.model";
import { WebhookKeyModel } from "../models/webhook-key.model";
import { toMinorUnits, toMajorUnits } from "../utils/fingerprint";
import { HttpError } from "../utils/http-error";
import { normalizeMerchant } from "../utils/merchant";

function usingMongo(): boolean {
  return mongoose.connection.readyState === 1;
}

type InMemoryCategoryRule = {
  _id: mongoose.Types.ObjectId;
  userId: string;
  keyword: string;
  keywordNormalized: string;
  categoryName: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type InMemoryBudget = {
  _id: mongoose.Types.ObjectId;
  userId: string;
  month: string;
  monthlyBudgetMinor: number;
  categoryBudgets: Array<{ categoryName: string; budgetMinor: number }>;
  createdAt: Date;
  updatedAt: Date;
};

type InMemoryBankMapping = {
  _id: mongoose.Types.ObjectId;
  userId: string;
  senderCode: string;
  bankName: string;
  accountLabel?: string;
  accountLast4?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type InMemoryIngestionLog = {
  _id: mongoose.Types.ObjectId;
  userId: string;
  source: "manual" | "sms" | "notification" | "statement";
  status: "parsed" | "created" | "duplicate" | "ignored" | "failed" | "reconciled";
  reason?: string;
  senderOriginal?: string;
  senderNormalized?: string;
  sourceFingerprint?: string;
  transactionId?: string;
  rawMessageSanitized?: string;
  createdAt: Date;
};

type InMemoryWebhookKey = {
  _id: mongoose.Types.ObjectId;
  userId: string;
  name: string;
  secretHash: string;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const inMemoryCategoryRules = new Map<string, InMemoryCategoryRule>();
const inMemoryBudgets = new Map<string, InMemoryBudget>();
const inMemoryBankMappings = new Map<string, InMemoryBankMapping>();
const inMemoryWebhookKeys = new Map<string, InMemoryWebhookKey>();
const inMemoryIngestionLogs = new Map<string, InMemoryIngestionLog>();

function asObjectId(id: string): mongoose.Types.ObjectId {
  if (!isValidObjectId(id)) {
    throw new HttpError(400, "INVALID_ID", "Identifier is invalid");
  }
  return new mongoose.Types.ObjectId(id);
}

function toCategoryRuleResponse(row: {
  _id: mongoose.Types.ObjectId;
  keyword: string;
  keywordNormalized: string;
  categoryName: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CategoryRuleResponse {
  return {
    id: row._id.toString(),
    keyword: row.keyword,
    keywordNormalized: row.keywordNormalized,
    categoryName: row.categoryName,
    priority: row.priority,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function toBudgetResponse(row: {
  _id: mongoose.Types.ObjectId;
  month: string;
  monthlyBudgetMinor: number;
  categoryBudgets: Array<{ categoryName: string; budgetMinor: number }>;
  createdAt: Date;
  updatedAt: Date;
}): BudgetResponse {
  return {
    id: row._id.toString(),
    month: row.month,
    monthlyBudgetMajor: toMajorUnits(row.monthlyBudgetMinor),
    categoryBudgets: row.categoryBudgets.map((item) => ({
      categoryName: item.categoryName,
      budgetMajor: toMajorUnits(item.budgetMinor)
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function toBankMappingResponse(row: {
  _id: mongoose.Types.ObjectId;
  senderCode: string;
  bankName: string;
  accountLabel?: string;
  accountLast4?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): BankMappingResponse {
  return {
    id: row._id.toString(),
    senderCode: row.senderCode,
    bankName: row.bankName,
    accountLabel: row.accountLabel ?? null,
    accountLast4: row.accountLast4 ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function toWebhookKeyResponse(row: {
  _id: mongoose.Types.ObjectId;
  name: string;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}): WebhookKeyResponse {
  return {
    id: row._id.toString(),
    name: row.name,
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function generatePlaintextSecret(): string {
  return randomBytes(32).toString("hex");
}

export async function listCategoryRules(userId: string): Promise<ListCategoryRulesResponse> {
  if (usingMongo()) {
    const rows = await CategoryRuleModel.find({
      userId: asObjectId(userId)
    }).sort({ priority: -1, createdAt: -1 });

    return { items: rows.map((row) => toCategoryRuleResponse(row)) };
  }

  const rows = [...inMemoryCategoryRules.values()]
    .filter((row) => row.userId === userId)
    .sort((a, b) => b.priority - a.priority || b.createdAt.getTime() - a.createdAt.getTime());
  return { items: rows.map((row) => toCategoryRuleResponse(row)) };
}

export async function createCategoryRule(
  userId: string,
  input: CategoryRuleInput
): Promise<CategoryRuleResponse> {
  const keywordNormalized = normalizeMerchant(input.keyword);
  if (usingMongo()) {
    const exists = await CategoryRuleModel.findOne({
      userId: asObjectId(userId),
      keywordNormalized,
      categoryName: input.categoryName.trim()
    }).lean();
    if (exists) {
      throw new HttpError(409, "CATEGORY_RULE_EXISTS", "A rule with same keyword and category already exists");
    }

    const created = await CategoryRuleModel.create({
      userId: asObjectId(userId),
      keyword: input.keyword.trim(),
      keywordNormalized,
      categoryName: input.categoryName.trim(),
      priority: input.priority,
      isActive: input.isActive
    });
    return toCategoryRuleResponse(created);
  }

  const duplicate = [...inMemoryCategoryRules.values()].find(
    (row) =>
      row.userId === userId &&
      row.keywordNormalized === keywordNormalized &&
      row.categoryName === input.categoryName.trim()
  );
  if (duplicate) {
    throw new HttpError(409, "CATEGORY_RULE_EXISTS", "A rule with same keyword and category already exists");
  }

  const now = new Date();
  const created: InMemoryCategoryRule = {
    _id: new mongoose.Types.ObjectId(),
    userId,
    keyword: input.keyword.trim(),
    keywordNormalized,
    categoryName: input.categoryName.trim(),
    priority: input.priority,
    isActive: input.isActive,
    createdAt: now,
    updatedAt: now
  };
  inMemoryCategoryRules.set(created._id.toString(), created);
  return toCategoryRuleResponse(created);
}

export async function updateCategoryRule(
  userId: string,
  id: string,
  input: UpdateCategoryRuleInput
): Promise<CategoryRuleResponse> {
  if (usingMongo()) {
    const targetId = asObjectId(id);
    const current = await CategoryRuleModel.findOne({
      _id: targetId,
      userId: asObjectId(userId)
    });
    if (!current) {
      throw new HttpError(404, "CATEGORY_RULE_NOT_FOUND", "Category rule was not found");
    }

    if (input.keyword !== undefined) {
      current.keyword = input.keyword.trim();
      current.keywordNormalized = normalizeMerchant(input.keyword);
    }
    if (input.categoryName !== undefined) {
      current.categoryName = input.categoryName.trim();
    }
    if (input.priority !== undefined) {
      current.priority = input.priority;
    }
    if (input.isActive !== undefined) {
      current.isActive = input.isActive;
    }

    const duplicate = await CategoryRuleModel.findOne({
      userId: asObjectId(userId),
      keywordNormalized: current.keywordNormalized,
      categoryName: current.categoryName,
      _id: { $ne: current._id }
    }).lean();
    if (duplicate) {
      throw new HttpError(409, "CATEGORY_RULE_EXISTS", "A rule with same keyword and category already exists");
    }

    await current.save();
    return toCategoryRuleResponse(current);
  }

  const current = inMemoryCategoryRules.get(id);
  if (!current || current.userId !== userId) {
    throw new HttpError(404, "CATEGORY_RULE_NOT_FOUND", "Category rule was not found");
  }
  const nextKeyword = input.keyword !== undefined ? input.keyword.trim() : current.keyword;
  const nextKeywordNormalized =
    input.keyword !== undefined ? normalizeMerchant(input.keyword) : current.keywordNormalized;
  const nextCategory = input.categoryName !== undefined ? input.categoryName.trim() : current.categoryName;
  const duplicate = [...inMemoryCategoryRules.values()].find(
    (row) =>
      row.userId === userId &&
      row._id.toString() !== id &&
      row.keywordNormalized === nextKeywordNormalized &&
      row.categoryName === nextCategory
  );
  if (duplicate) {
    throw new HttpError(409, "CATEGORY_RULE_EXISTS", "A rule with same keyword and category already exists");
  }

  current.keyword = nextKeyword;
  current.keywordNormalized = nextKeywordNormalized;
  current.categoryName = nextCategory;
  if (input.priority !== undefined) {
    current.priority = input.priority;
  }
  if (input.isActive !== undefined) {
    current.isActive = input.isActive;
  }
  current.updatedAt = new Date();
  inMemoryCategoryRules.set(id, current);
  return toCategoryRuleResponse(current);
}

export async function deleteCategoryRule(userId: string, id: string): Promise<CategoryRuleResponse> {
  if (usingMongo()) {
    const updated = await CategoryRuleModel.findOneAndUpdate(
      { _id: asObjectId(id), userId: asObjectId(userId) },
      { isActive: false },
      { new: true }
    );
    if (!updated) {
      throw new HttpError(404, "CATEGORY_RULE_NOT_FOUND", "Category rule was not found");
    }
    return toCategoryRuleResponse(updated);
  }

  const current = inMemoryCategoryRules.get(id);
  if (!current || current.userId !== userId) {
    throw new HttpError(404, "CATEGORY_RULE_NOT_FOUND", "Category rule was not found");
  }
  current.isActive = false;
  current.updatedAt = new Date();
  inMemoryCategoryRules.set(id, current);
  return toCategoryRuleResponse(current);
}

export async function listBudgets(userId: string, month?: string): Promise<ListBudgetsResponse> {
  if (usingMongo()) {
    const rows = await BudgetModel.find({
      userId: asObjectId(userId),
      ...(month ? { month } : {})
    }).sort({ month: -1 });

    return { items: rows.map((row) => toBudgetResponse(row)) };
  }

  const rows = [...inMemoryBudgets.values()]
    .filter((row) => row.userId === userId)
    .filter((row) => (month ? row.month === month : true))
    .sort((a, b) => b.month.localeCompare(a.month));
  return { items: rows.map((row) => toBudgetResponse(row)) };
}

export async function upsertBudget(
  userId: string,
  month: string,
  input: BudgetUpsertInput | BudgetInput
): Promise<BudgetResponse> {
  const monthlyBudgetMinor = toMinorUnits(input.monthlyBudgetMajor);
  const categoryBudgets = input.categoryBudgets.map((item) => ({
    categoryName: item.categoryName.trim(),
    budgetMinor: toMinorUnits(item.budgetMajor)
  }));

  if (usingMongo()) {
    const updated = await BudgetModel.findOneAndUpdate(
      { userId: asObjectId(userId), month },
      {
        month,
        monthlyBudgetMinor,
        categoryBudgets
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return toBudgetResponse(updated);
  }

  const existing = [...inMemoryBudgets.values()].find(
    (row) => row.userId === userId && row.month === month
  );
  if (existing) {
    existing.monthlyBudgetMinor = monthlyBudgetMinor;
    existing.categoryBudgets = categoryBudgets;
    existing.updatedAt = new Date();
    inMemoryBudgets.set(existing._id.toString(), existing);
    return toBudgetResponse(existing);
  }

  const now = new Date();
  const created: InMemoryBudget = {
    _id: new mongoose.Types.ObjectId(),
    userId,
    month,
    monthlyBudgetMinor,
    categoryBudgets,
    createdAt: now,
    updatedAt: now
  };
  inMemoryBudgets.set(created._id.toString(), created);
  return toBudgetResponse(created);
}

export async function listBankMappings(userId: string): Promise<ListBankMappingsResponse> {
  if (usingMongo()) {
    const rows = await BankMappingModel.find({ userId: asObjectId(userId) }).sort({
      isActive: -1,
      senderCode: 1
    });
    return { items: rows.map((row) => toBankMappingResponse(row)) };
  }

  const rows = [...inMemoryBankMappings.values()]
    .filter((row) => row.userId === userId)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.senderCode.localeCompare(b.senderCode));
  return { items: rows.map((row) => toBankMappingResponse(row)) };
}

export async function createBankMapping(
  userId: string,
  input: BankMappingInput
): Promise<BankMappingResponse> {
  const senderCode = normalizeSender(input.senderCode);
  if (usingMongo()) {
    const exists = await BankMappingModel.findOne({
      userId: asObjectId(userId),
      senderCode
    }).lean();
    if (exists) {
      throw new HttpError(409, "BANK_MAPPING_EXISTS", "Sender code is already mapped");
    }

    const created = await BankMappingModel.create({
      userId: asObjectId(userId),
      senderCode,
      bankName: input.bankName.trim(),
      accountLabel: input.accountLabel?.trim(),
      accountLast4: input.accountLast4?.trim(),
      isActive: input.isActive
    });
    return toBankMappingResponse(created);
  }

  const exists = [...inMemoryBankMappings.values()].find(
    (row) => row.userId === userId && row.senderCode === senderCode
  );
  if (exists) {
    throw new HttpError(409, "BANK_MAPPING_EXISTS", "Sender code is already mapped");
  }
  const now = new Date();
  const created: InMemoryBankMapping = {
    _id: new mongoose.Types.ObjectId(),
    userId,
    senderCode,
    bankName: input.bankName.trim(),
    accountLabel: input.accountLabel?.trim(),
    accountLast4: input.accountLast4?.trim(),
    isActive: input.isActive,
    createdAt: now,
    updatedAt: now
  };
  inMemoryBankMappings.set(created._id.toString(), created);
  return toBankMappingResponse(created);
}

export async function updateBankMapping(
  userId: string,
  id: string,
  input: Partial<BankMappingInput>
): Promise<BankMappingResponse> {
  if (usingMongo()) {
    const targetId = asObjectId(id);
    const current = await BankMappingModel.findOne({
      _id: targetId,
      userId: asObjectId(userId)
    });
    if (!current) {
      throw new HttpError(404, "BANK_MAPPING_NOT_FOUND", "Bank mapping was not found");
    }

    if (input.senderCode !== undefined) {
      const senderCode = normalizeSender(input.senderCode);
      const exists = await BankMappingModel.findOne({
        userId: asObjectId(userId),
        senderCode,
        _id: { $ne: targetId }
      }).lean();
      if (exists) {
        throw new HttpError(409, "BANK_MAPPING_EXISTS", "Sender code is already mapped");
      }
      current.senderCode = senderCode;
    }
    if (input.bankName !== undefined) {
      current.bankName = input.bankName.trim();
    }
    if (input.accountLabel !== undefined) {
      current.accountLabel = input.accountLabel.trim();
    }
    if (input.accountLast4 !== undefined) {
      current.accountLast4 = input.accountLast4.trim();
    }
    if (input.isActive !== undefined) {
      current.isActive = input.isActive;
    }

    await current.save();
    return toBankMappingResponse(current);
  }

  const current = inMemoryBankMappings.get(id);
  if (!current || current.userId !== userId) {
    throw new HttpError(404, "BANK_MAPPING_NOT_FOUND", "Bank mapping was not found");
  }
  if (input.senderCode !== undefined) {
    const senderCode = normalizeSender(input.senderCode);
    const duplicate = [...inMemoryBankMappings.values()].find(
      (row) => row.userId === userId && row._id.toString() !== id && row.senderCode === senderCode
    );
    if (duplicate) {
      throw new HttpError(409, "BANK_MAPPING_EXISTS", "Sender code is already mapped");
    }
    current.senderCode = senderCode;
  }
  if (input.bankName !== undefined) {
    current.bankName = input.bankName.trim();
  }
  if (input.accountLabel !== undefined) {
    current.accountLabel = input.accountLabel.trim();
  }
  if (input.accountLast4 !== undefined) {
    current.accountLast4 = input.accountLast4.trim();
  }
  if (input.isActive !== undefined) {
    current.isActive = input.isActive;
  }
  current.updatedAt = new Date();
  inMemoryBankMappings.set(id, current);
  return toBankMappingResponse(current);
}

export async function listIngestionLogs(
  userId: string,
  query: IngestionLogsQuery
): Promise<ListIngestionLogsResponse> {
  if (usingMongo()) {
    const filter: Record<string, unknown> = {
      userId: asObjectId(userId)
    };

    if (query.source) {
      filter.source = query.source;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.fromDate || query.toDate) {
      const createdAt: Record<string, Date> = {};
      if (query.fromDate) {
        createdAt.$gte = new Date(`${query.fromDate}T00:00:00.000Z`);
      }
      if (query.toDate) {
        createdAt.$lte = new Date(`${query.toDate}T23:59:59.999Z`);
      }
      filter.createdAt = createdAt;
    }

    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      IngestionLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.pageSize),
      IngestionLogModel.countDocuments(filter)
    ]);

    const items: IngestionLogResponse[] = rows.map((row) => ({
      id: row._id.toString(),
      source: row.source,
      status: row.status,
      reason: row.reason ?? null,
      senderOriginal: row.senderOriginal ?? null,
      senderNormalized: row.senderNormalized ?? null,
      sourceFingerprint: row.sourceFingerprint ?? null,
      transactionId: row.transactionId?.toString() ?? null,
      rawMessageSanitized: row.rawMessageSanitized ?? null,
      createdAt: row.createdAt.toISOString()
    }));

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize))
      }
    };
  }

  const from = query.fromDate ? new Date(`${query.fromDate}T00:00:00.000Z`) : null;
  const to = query.toDate ? new Date(`${query.toDate}T23:59:59.999Z`) : null;
  const filtered = [...inMemoryIngestionLogs.values()]
    .filter((row) => row.userId === userId)
    .filter((row) => (query.source ? row.source === query.source : true))
    .filter((row) => (query.status ? row.status === query.status : true))
    .filter((row) => (from ? row.createdAt >= from : true))
    .filter((row) => (to ? row.createdAt <= to : true))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = filtered.length;
  const start = (query.page - 1) * query.pageSize;
  const pageItems = filtered.slice(start, start + query.pageSize);

  return {
    items: pageItems.map((row) => ({
      id: row._id.toString(),
      source: row.source,
      status: row.status,
      reason: row.reason ?? null,
      senderOriginal: row.senderOriginal ?? null,
      senderNormalized: row.senderNormalized ?? null,
      sourceFingerprint: row.sourceFingerprint ?? null,
      transactionId: row.transactionId ?? null,
      rawMessageSanitized: row.rawMessageSanitized ?? null,
      createdAt: row.createdAt.toISOString()
    })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize))
    }
  };
}

export async function listWebhookKeys(userId: string): Promise<ListWebhookKeysResponse> {
  if (usingMongo()) {
    const rows = await WebhookKeyModel.find({ userId: asObjectId(userId) }).sort({
      isActive: -1,
      createdAt: -1
    });
    return { items: rows.map((row) => toWebhookKeyResponse(row)) };
  }
  const rows = [...inMemoryWebhookKeys.values()]
    .filter((row) => row.userId === userId)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.createdAt.getTime() - a.createdAt.getTime());
  return { items: rows.map((row) => toWebhookKeyResponse(row)) };
}

export async function createWebhookKey(
  userId: string,
  input: { name: string }
): Promise<WebhookKeyCreateResponse> {
  const name = input.name.trim();
  if (usingMongo()) {
    const exists = await WebhookKeyModel.findOne({
      userId: asObjectId(userId),
      name
    }).lean();
    if (exists) {
      throw new HttpError(409, "WEBHOOK_KEY_EXISTS", "Webhook key name already exists");
    }

    const plaintextSecret = generatePlaintextSecret();
    const created = await WebhookKeyModel.create({
      userId: asObjectId(userId),
      name,
      secretHash: hashSecret(plaintextSecret),
      isActive: true
    });
    return {
      key: toWebhookKeyResponse(created),
      plaintextSecret
    };
  }

  const exists = [...inMemoryWebhookKeys.values()].find(
    (row) => row.userId === userId && row.name === name
  );
  if (exists) {
    throw new HttpError(409, "WEBHOOK_KEY_EXISTS", "Webhook key name already exists");
  }
  const plaintextSecret = generatePlaintextSecret();
  const now = new Date();
  const created: InMemoryWebhookKey = {
    _id: new mongoose.Types.ObjectId(),
    userId,
    name,
    secretHash: hashSecret(plaintextSecret),
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
  inMemoryWebhookKeys.set(created._id.toString(), created);
  return {
    key: toWebhookKeyResponse(created),
    plaintextSecret
  };
}

export async function rotateWebhookKey(
  userId: string,
  id: string
): Promise<WebhookKeyRotateResponse> {
  if (usingMongo()) {
    const current = await WebhookKeyModel.findOne({
      _id: asObjectId(id),
      userId: asObjectId(userId)
    });
    if (!current) {
      throw new HttpError(404, "WEBHOOK_KEY_NOT_FOUND", "Webhook key was not found");
    }
    if (!current.isActive) {
      throw new HttpError(409, "WEBHOOK_KEY_INACTIVE", "Only active webhook keys can be rotated");
    }

    current.isActive = false;
    await current.save();

    const plaintextSecret = generatePlaintextSecret();
    const created = await WebhookKeyModel.create({
      userId: asObjectId(userId),
      name: `${current.name} (rotated ${new Date().toISOString().slice(0, 10)})`,
      secretHash: hashSecret(plaintextSecret),
      isActive: true
    });

    return {
      key: toWebhookKeyResponse(created),
      plaintextSecret
    };
  }

  const current = inMemoryWebhookKeys.get(id);
  if (!current || current.userId !== userId) {
    throw new HttpError(404, "WEBHOOK_KEY_NOT_FOUND", "Webhook key was not found");
  }
  if (!current.isActive) {
    throw new HttpError(409, "WEBHOOK_KEY_INACTIVE", "Only active webhook keys can be rotated");
  }
  current.isActive = false;
  current.updatedAt = new Date();
  inMemoryWebhookKeys.set(id, current);

  const plaintextSecret = generatePlaintextSecret();
  const now = new Date();
  const created: InMemoryWebhookKey = {
    _id: new mongoose.Types.ObjectId(),
    userId,
    name: `${current.name} (rotated ${new Date().toISOString().slice(0, 10)})`,
    secretHash: hashSecret(plaintextSecret),
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
  inMemoryWebhookKeys.set(created._id.toString(), created);
  return {
    key: toWebhookKeyResponse(created),
    plaintextSecret
  };
}

export async function disableWebhookKey(userId: string, id: string): Promise<WebhookKeyResponse> {
  if (usingMongo()) {
    const updated = await WebhookKeyModel.findOneAndUpdate(
      { _id: asObjectId(id), userId: asObjectId(userId) },
      { isActive: false },
      { new: true }
    );
    if (!updated) {
      throw new HttpError(404, "WEBHOOK_KEY_NOT_FOUND", "Webhook key was not found");
    }
    return toWebhookKeyResponse(updated);
  }

  const current = inMemoryWebhookKeys.get(id);
  if (!current || current.userId !== userId) {
    throw new HttpError(404, "WEBHOOK_KEY_NOT_FOUND", "Webhook key was not found");
  }
  current.isActive = false;
  current.updatedAt = new Date();
  inMemoryWebhookKeys.set(id, current);
  return toWebhookKeyResponse(current);
}

export function resetInMemorySettingsForTests(): void {
  inMemoryCategoryRules.clear();
  inMemoryBudgets.clear();
  inMemoryBankMappings.clear();
  inMemoryWebhookKeys.clear();
  inMemoryIngestionLogs.clear();
}

export function seedInMemoryIngestionLogForTests(input: {
  userId: string;
  source: "manual" | "sms" | "notification" | "statement";
  status: "parsed" | "created" | "duplicate" | "ignored" | "failed" | "reconciled";
  createdAt: string;
  reason?: string;
}): void {
  const id = new mongoose.Types.ObjectId();
  inMemoryIngestionLogs.set(id.toString(), {
    _id: id,
    userId: input.userId,
    source: input.source,
    status: input.status,
    reason: input.reason,
    createdAt: new Date(input.createdAt)
  });
}
