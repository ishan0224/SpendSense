import { createHash } from "node:crypto";

type CanonicalFingerprintInput = {
  userId: string;
  bankCode: string | null;
  direction: "debit" | "credit";
  amountMinor: number;
  transactionDateIso: string;
  merchantNormalized: string;
};

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

export function toMinorUnits(amountMajor: string): number {
  const [wholePart, decimalPart = ""] = amountMajor.split(".");
  const whole = Number(wholePart);
  const normalizedDecimal = Number((decimalPart + "00").slice(0, 2));
  return whole * 100 + normalizedDecimal;
}

export function toMajorUnits(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}
