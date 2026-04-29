import test from "node:test";
import assert from "node:assert/strict";
import { isSensitiveMessage, sanitizeMessage } from "./sanitizer";

test("detects sensitive otp messages", () => {
  assert.equal(isSensitiveMessage("Your OTP is 348921. Do not share"), true);
});

test("masks long account-like digit sequences", () => {
  const output = sanitizeMessage("Card 1234567812345678 spent at store");
  assert.equal(output.includes("****5678"), true);
});
