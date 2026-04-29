import test from "node:test";
import assert from "node:assert/strict";
import {
  getCategoryAnalytics,
  getDailyAnalytics,
  getImpactAnalytics,
  getMerchantAnalytics,
  getSummaryAnalytics
} from "./services/analytics.service";
import {
  createTransaction,
  ignoreTransaction,
  resetInMemoryTransactionsForTests
} from "./services/transaction.service";

const userId = "507f1f77bcf86cd799439011";

test.beforeEach(() => {
  resetInMemoryTransactionsForTests();
});

test("summary totals debit, credit, net, daily average, and top category", async () => {
  await createTransaction(userId, {
    direction: "debit",
    amountMajor: "1000.00",
    currency: "INR",
    merchantOriginal: "Zomato",
    categoryName: "Food",
    paymentMode: "UPI",
    transactionDate: "2026-02-05"
  });
  await createTransaction(userId, {
    direction: "debit",
    amountMajor: "500.00",
    currency: "INR",
    merchantOriginal: "Uber",
    categoryName: "Travel",
    paymentMode: "Card",
    transactionDate: "2026-02-10"
  });
  await createTransaction(userId, {
    direction: "credit",
    amountMajor: "2000.00",
    currency: "INR",
    merchantOriginal: "Acme Payroll",
    categoryName: "Salary",
    paymentMode: "NetBanking",
    transactionDate: "2026-02-01"
  });

  const summary = await getSummaryAnalytics(userId, "2026-02");

  assert.equal(summary.totalSpentMinor, 150000);
  assert.equal(summary.totalCreditedMinor, 200000);
  assert.equal(summary.netCashflowMinor, 50000);
  assert.equal(summary.dailyAverageMinor, Math.round(150000 / 28));
  assert.equal(summary.topCategory?.categoryName, "Food");
});

test("ignored transactions do not affect analytics", async () => {
  const created = await createTransaction(userId, {
    direction: "debit",
    amountMajor: "900.00",
    currency: "INR",
    merchantOriginal: "Amazon",
    categoryName: "Shopping",
    paymentMode: "Card",
    transactionDate: "2026-04-12"
  });

  await ignoreTransaction(userId, created.id);
  const summary = await getSummaryAnalytics(userId, "2026-04");

  assert.equal(summary.totalSpentMinor, 0);
});

test("category, daily, merchant, and impact analytics use known data", async () => {
  await createTransaction(userId, {
    direction: "debit",
    amountMajor: "300.00",
    currency: "INR",
    merchantOriginal: "Swiggy",
    categoryName: "Food",
    paymentMode: "UPI",
    transactionDate: "2026-04-15"
  });
  await createTransaction(userId, {
    direction: "debit",
    amountMajor: "700.00",
    currency: "INR",
    merchantOriginal: "Swiggy Instamart",
    categoryName: "Food",
    paymentMode: "UPI",
    transactionDate: "2026-04-15"
  });

  const categories = await getCategoryAnalytics(userId, "2026-04");
  const daily = await getDailyAnalytics(userId, "2026-04");
  const merchants = await getMerchantAnalytics(userId, "2026-04");
  const impact = await getImpactAnalytics(userId, "2026-04");

  assert.equal(categories.items[0]?.totalMinor, 100000);
  assert.equal(daily.items.find((item) => item.date === "2026-04-15")?.totalMinor, 100000);
  assert.equal(merchants.items.length, 2);
  assert.equal(impact.items[0]?.amountMinor, 70000);
});
