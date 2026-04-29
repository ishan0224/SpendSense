import { createHash } from "node:crypto";

type CanonicalFingerprintInput = {
  userId: string;
  bankCode: string | null;
  direction: "debit" | "credit";
  amountMinor: number;
  transactionDateIso: string;
  merchantNormalized: string;
};

export function buildSourceFingerprint(input: {
  source: "sms" | "notification" | "statement" | "manual";
  sender: string;
  sanitizedMessage: string;
  receivedAt: string;
}): string {
  const dayBucket = input.receivedAt.slice(0, 10);
  const payload = [input.source, input.sender, input.sanitizedMessage, dayBucket].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export function buildCanonicalFingerprint(input: CanonicalFingerprintInput): string {
  const payload = [
    input.userId,
    input.bankCode ?? "UNKNOWN_BANK",
    input.direction,
    String(input.amountMinor),
    input.transactionDateIso,
    input.merchantNormalized
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}

type FuzzyCandidate = {
  userId: string;
  bankCode?: string | null;
  direction: "debit" | "credit";
  amountMinor: number;
  transactionDate: Date;
  merchantNormalized: string;
};

export function fuzzyMatchTransactions(left: FuzzyCandidate, right: FuzzyCandidate): boolean {
  if (left.userId !== right.userId) {
    return false;
  }
  if (left.direction !== right.direction) {
    return false;
  }
  if (left.amountMinor !== right.amountMinor) {
    return false;
  }
  if (left.bankCode && right.bankCode && left.bankCode !== right.bankCode) {
    return false;
  }

  const daysDiff = Math.abs(left.transactionDate.getTime() - right.transactionDate.getTime()) / 86400000;
  if (daysDiff > 1) {
    return false;
  }

  return (
    left.merchantNormalized === right.merchantNormalized ||
    left.merchantNormalized.includes(right.merchantNormalized) ||
    right.merchantNormalized.includes(left.merchantNormalized)
  );
}
