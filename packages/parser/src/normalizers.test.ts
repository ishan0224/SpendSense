import test from "node:test";
import assert from "node:assert/strict";
import { amountMajorToMinor, deriveMonthKey, normalizeMerchant, normalizeSender } from "./normalizers";

test("normalizeSender strips route prefixes", () => {
  assert.equal(normalizeSender("AX-HDFCBK"), "HDFCBK");
});

test("normalizeMerchant produces uppercase stable merchant", () => {
  assert.equal(normalizeMerchant("Zomato, Pvt. Ltd"), "ZOMATO PVT LTD");
});

test("amountMajorToMinor keeps integer minor units", () => {
  assert.equal(amountMajorToMinor("500.75"), 50075);
});

test("deriveMonthKey uses timezone boundary", () => {
  const value = deriveMonthKey(new Date("2026-04-30T20:00:00.000Z"), "Asia/Kolkata");
  assert.equal(value, "2026-05");
});
