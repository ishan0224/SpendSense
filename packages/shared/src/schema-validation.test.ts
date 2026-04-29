import test from "node:test";
import assert from "node:assert/strict";
import {
  createTransactionSchema,
  statementPreviewRequestSchema,
  webhookIngestPayloadSchema
} from "./index";

test("transaction schema validates basic manual payload", () => {
  const parsed = createTransactionSchema.parse({
    direction: "debit",
    amountMajor: "499.99",
    merchantOriginal: "Zomato",
    categoryName: "Food",
    paymentMode: "UPI",
    transactionDate: "2026-04-29",
    currency: "INR"
  });

  assert.equal(parsed.amountMajor, "499.99");
});

test("webhook schema rejects invalid datetime", () => {
  assert.throws(() =>
    webhookIngestPayloadSchema.parse({
      source: "sms",
      sender: "AX-HDFCBK",
      message: "debited 100",
      receivedAt: "invalid-date"
    })
  );
});

test("statement preview schema validates row list", () => {
  const parsed = statementPreviewRequestSchema.parse({
    fileName: "hdfc-apr.csv",
    fileType: "csv",
    rows: [
      {
        rowNumber: 1,
        amountMajor: "1000.00",
        direction: "debit",
        transactionDate: "2026-04-01",
        merchantOriginal: "IRCTC"
      }
    ]
  });

  assert.equal(parsed.rows.length, 1);
});
