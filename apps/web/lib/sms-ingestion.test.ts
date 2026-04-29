import test from "node:test";
import assert from "node:assert/strict";
import type { WebhookIngestPayload } from "@spendsense/shared";
import {
  ingestSmsPayload,
  type SmsIngestionPersistence
} from "./sms-ingestion";
import { hashWebhookSecret, verifyWebhookSecret } from "./webhook-security";

function createMemoryPersistence(): SmsIngestionPersistence & {
  logs: unknown[];
  transactions: Array<{ id: string; sourceFingerprint: string; canonicalFingerprint: string }>;
} {
  const transactions: Array<{ id: string; sourceFingerprint: string; canonicalFingerprint: string }> = [];
  const logs: unknown[] = [];

  return {
    transactions,
    logs,
    async findBySourceFingerprint(_userId, sourceFingerprint) {
      return transactions.find((item) => item.sourceFingerprint === sourceFingerprint) ?? null;
    },
    async findByCanonicalFingerprint(_userId, canonicalFingerprint) {
      return transactions.find((item) => item.canonicalFingerprint === canonicalFingerprint) ?? null;
    },
    async getCategoryRules() {
      return [{ keywordNormalized: "ZOMATO", categoryName: "Food", priority: 100 }];
    },
    async createTransaction(input) {
      const transaction = {
        id: `tx_${transactions.length + 1}`,
        sourceFingerprint: input.sourceFingerprint,
        canonicalFingerprint: input.canonicalFingerprint
      };
      transactions.push(transaction);
      return { id: transaction.id };
    },
    async writeLog(input) {
      logs.push(input);
    }
  };
}

const basePayload: WebhookIngestPayload = {
  source: "sms",
  sender: "AX-HDFCBK",
  message: "Rs. 500.00 debited from your account at ZOMATO via UPI on 29-Apr-2026.",
  receivedAt: "2026-04-29T10:15:00.000Z"
};

test("valid SMS payload creates an unverified transaction candidate", async () => {
  const persistence = createMemoryPersistence();
  const result = await ingestSmsPayload({
    payload: basePayload,
    userId: "507f1f77bcf86cd799439011",
    timezone: "Asia/Kolkata",
    defaultCurrency: "INR",
    persistence
  });

  assert.equal(result.status, "created");
  assert.equal(result.transactionId, "tx_1");
  assert.equal(persistence.transactions.length, 1);
});

test("retrying the same payload returns duplicate", async () => {
  const persistence = createMemoryPersistence();
  const options = {
    payload: basePayload,
    userId: "507f1f77bcf86cd799439011",
    timezone: "Asia/Kolkata",
    defaultCurrency: "INR",
    persistence
  };

  await ingestSmsPayload(options);
  const duplicate = await ingestSmsPayload(options);

  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.transactionId, "tx_1");
  assert.equal(persistence.transactions.length, 1);
});

test("sensitive OTP payload is ignored without creating a transaction", async () => {
  const persistence = createMemoryPersistence();
  const result = await ingestSmsPayload({
    payload: {
      ...basePayload,
      message: "Your OTP is 123456. Do not share it with anyone."
    },
    userId: "507f1f77bcf86cd799439011",
    timezone: "Asia/Kolkata",
    defaultCurrency: "INR",
    persistence
  });

  assert.equal(result.status, "ignored");
  assert.equal(persistence.transactions.length, 0);
});

test("low-confidence payload is failed and logged", async () => {
  const persistence = createMemoryPersistence();
  const result = await ingestSmsPayload({
    payload: {
      ...basePayload,
      message: "Hello from bank"
    },
    userId: "507f1f77bcf86cd799439011",
    timezone: "Asia/Kolkata",
    defaultCurrency: "INR",
    persistence
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reason, "low_confidence_parse");
  assert.equal(persistence.transactions.length, 0);
});

test("webhook secret validates against SHA-256 hash", () => {
  const secret = "local-phone-secret";
  const hash = hashWebhookSecret(secret);

  assert.equal(verifyWebhookSecret(secret, hash), true);
  assert.equal(verifyWebhookSecret("wrong", hash), false);
});
