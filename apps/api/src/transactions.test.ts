import test from "node:test";
import assert from "node:assert/strict";
import {
  createTransaction,
  ignoreTransaction,
  listTransactions,
  resetInMemoryTransactionsForTests,
  restoreTransaction,
  updateTransaction
} from "./services/transaction.service";

const userId = "507f1f77bcf86cd799439011";

test.beforeEach(() => {
  resetInMemoryTransactionsForTests();
});

test("creates and lists a manual transaction", async () => {
  const created = await createTransaction(userId, {
    direction: "debit",
    amountMajor: "500.50",
    currency: "INR",
    merchantOriginal: "Zomato",
    categoryName: "Food",
    paymentMode: "UPI",
    transactionDate: "2026-04-29",
    notes: "Lunch"
  });

  assert.equal(created.direction, "debit");
  assert.equal(created.amountMinor, 50050);

  const listed = await listTransactions(userId, {
    page: 1,
    pageSize: 20,
    month: "2026-04",
    includeIgnored: false
  });

  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0]?.merchantOriginal, "Zomato");
});

test("returns duplicate conflict for same canonical transaction", async () => {
  const payload = {
    direction: "debit" as const,
    amountMajor: "250.00",
    currency: "INR",
    merchantOriginal: "Cafe Coffee Day",
    categoryName: "Food",
    paymentMode: "Card",
    transactionDate: "2026-04-28"
  };

  await createTransaction(userId, payload);

  await assert.rejects(
    createTransaction(userId, payload),
    (error: unknown) =>
      error instanceof Error && error.message.includes("A similar transaction already exists")
  );
});

test("updates, ignores, and restores a transaction", async () => {
  const created = await createTransaction(userId, {
    direction: "credit",
    amountMajor: "1000.00",
    currency: "INR",
    merchantOriginal: "Acme Corp",
    categoryName: "Salary",
    paymentMode: "NetBanking",
    transactionDate: "2026-04-20"
  });

  const updated = await updateTransaction(userId, created.id, {
    merchantOriginal: "Acme Payroll",
    notes: "Updated"
  });
  assert.equal(updated.merchantOriginal, "Acme Payroll");

  const ignored = await ignoreTransaction(userId, created.id);
  assert.equal(ignored.isIgnored, true);

  const restored = await restoreTransaction(userId, created.id);
  assert.equal(restored.isIgnored, false);
});
