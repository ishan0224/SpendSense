import test from "node:test";
import assert from "node:assert/strict";
import {
  createBankMapping,
  createCategoryRule,
  createWebhookKey,
  deleteCategoryRule,
  listCategoryRules,
  listIngestionLogs,
  listWebhookKeys,
  resetInMemorySettingsForTests,
  rotateWebhookKey,
  seedInMemoryIngestionLogForTests,
  upsertBudget
} from "./services/settings.service";

const userId = "507f1f77bcf86cd799439011";

test.beforeEach(() => {
  resetInMemorySettingsForTests();
});

test("category rules sort by priority and support disable", async () => {
  await createCategoryRule(userId, {
    keyword: "coffee",
    categoryName: "Food",
    priority: 10,
    isActive: true
  });
  const higher = await createCategoryRule(userId, {
    keyword: "uber",
    categoryName: "Travel",
    priority: 100,
    isActive: true
  });

  const listed = await listCategoryRules(userId);
  assert.equal(listed.items[0]?.id, higher.id);

  const disabled = await deleteCategoryRule(userId, higher.id);
  assert.equal(disabled.isActive, false);
});

test("budget upsert updates same month instead of creating new record", async () => {
  const created = await upsertBudget(userId, "2026-04", {
    monthlyBudgetMajor: "50000.00",
    categoryBudgets: [{ categoryName: "Food", budgetMajor: "10000.00" }]
  });
  assert.equal(created.monthlyBudgetMajor, "50000.00");

  const updated = await upsertBudget(userId, "2026-04", {
    monthlyBudgetMajor: "65000.00",
    categoryBudgets: [{ categoryName: "Travel", budgetMajor: "12000.00" }]
  });
  assert.equal(updated.id, created.id);
  assert.equal(updated.monthlyBudgetMajor, "65000.00");
  assert.equal(updated.categoryBudgets[0]?.categoryName, "Travel");
});

test("bank mapping enforces unique sender code per user", async () => {
  await createBankMapping(userId, {
    senderCode: "ax-hdfcbk",
    bankName: "HDFC Bank",
    isActive: true
  });

  await assert.rejects(
    createBankMapping(userId, {
      senderCode: "JD-HDFCBK",
      bankName: "HDFC Alternate",
      isActive: true
    }),
    (error: unknown) =>
      error instanceof Error && error.message.includes("Sender code is already mapped")
  );
});

test("ingestion logs filters by source, status, and date", async () => {
  seedInMemoryIngestionLogForTests({
    userId,
    source: "sms",
    status: "created",
    createdAt: "2026-04-30T10:00:00.000Z"
  });
  seedInMemoryIngestionLogForTests({
    userId,
    source: "notification",
    status: "failed",
    createdAt: "2026-04-28T10:00:00.000Z"
  });

  const filtered = await listIngestionLogs(userId, {
    page: 1,
    pageSize: 20,
    source: "sms",
    status: "created",
    fromDate: "2026-04-30"
  });

  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.items[0]?.source, "sms");
  assert.equal(filtered.items[0]?.status, "created");
});

test("webhook key rotation deactivates old key and returns new plaintext once", async () => {
  const created = await createWebhookKey(userId, { name: "Tasker Phone" });
  assert.ok(created.plaintextSecret.length >= 32);

  const rotated = await rotateWebhookKey(userId, created.key.id);
  assert.ok(rotated.plaintextSecret.length >= 32);
  assert.notEqual(rotated.plaintextSecret, created.plaintextSecret);

  const listed = await listWebhookKeys(userId);
  const oldKey = listed.items.find((item) => item.id === created.key.id);
  const newKey = listed.items.find((item) => item.id === rotated.key.id);
  assert.equal(oldKey?.isActive, false);
  assert.equal(newKey?.isActive, true);
});
