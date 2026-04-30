import assert from "node:assert/strict";
import test from "node:test";
import * as apiModule from "./api";

process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:10000";
process.env.NEXT_PUBLIC_API_RETRY_BASE_DELAY_MS = "1";
process.env.NEXT_PUBLIC_API_RETRY_COUNT = "2";
process.env.NEXT_PUBLIC_API_TIMEOUT_MS = "500";

const originalFetch = global.fetch;

test("GET requests retry transient 503 and recover", async () => {
  let calls = 0;
  global.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: { message: "cold start" } }), { status: 503 });
    }
    return new Response(
      JSON.stringify({
        month: "2026-04",
        totalSpentMinor: 0,
        totalCreditedMinor: 0,
        netCashflowMinor: 0,
        dailyAverageMinor: 0,
        elapsedDays: 30,
        monthlyBudgetMinor: null,
        budgetUsedPercentage: null,
        topCategory: null
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  const result = await apiModule.fetchSummary("2026-04");
  assert.equal(calls, 2);
  assert.equal(result.month, "2026-04");
});

test("POST requests do not retry transient 503", async () => {
  let calls = 0;
  global.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { message: "temporarily unavailable" } }), {
      status: 503
    });
  }) as typeof fetch;

  await assert.rejects(
    () =>
      apiModule.createTransaction({
        amountMajor: "125.00",
        currency: "INR",
        direction: "debit",
        merchantOriginal: "Test Merchant",
        categoryName: "Food",
        paymentMode: "UPI",
        transactionDate: "2026-04-30"
      }),
    /temporarily unavailable/
  );
  assert.equal(calls, 1);
});

test.after(() => {
  global.fetch = originalFetch;
});
