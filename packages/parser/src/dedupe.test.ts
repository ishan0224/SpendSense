import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanonicalFingerprint,
  buildSourceFingerprint,
  fuzzyMatchTransactions
} from "./dedupe";

test("source fingerprint is deterministic", () => {
  const one = buildSourceFingerprint({
    source: "sms",
    sender: "HDFCBK",
    sanitizedMessage: "Rs 1000 debited",
    receivedAt: "2026-04-29T10:15:00+05:30"
  });
  const two = buildSourceFingerprint({
    source: "sms",
    sender: "HDFCBK",
    sanitizedMessage: "Rs 1000 debited",
    receivedAt: "2026-04-29T23:45:00+05:30"
  });
  assert.equal(one, two);
});

test("canonical fingerprint changes when merchant changes", () => {
  const base = {
    userId: "507f1f77bcf86cd799439011",
    bankCode: "HDFCBK",
    direction: "debit" as const,
    amountMinor: 100000,
    transactionDateIso: "2026-04-29"
  };
  const a = buildCanonicalFingerprint({ ...base, merchantNormalized: "ZOMATO" });
  const b = buildCanonicalFingerprint({ ...base, merchantNormalized: "SWIGGY" });
  assert.notEqual(a, b);
});

test("fuzzy match allows date drift up to one day", () => {
  const matched = fuzzyMatchTransactions(
    {
      userId: "u1",
      bankCode: "HDFCBK",
      direction: "debit",
      amountMinor: 50000,
      transactionDate: new Date("2026-04-29T00:00:00.000Z"),
      merchantNormalized: "ZOMATO"
    },
    {
      userId: "u1",
      bankCode: "HDFCBK",
      direction: "debit",
      amountMinor: 50000,
      transactionDate: new Date("2026-04-30T00:00:00.000Z"),
      merchantNormalized: "ZOMATO"
    }
  );
  assert.equal(matched, true);
});
