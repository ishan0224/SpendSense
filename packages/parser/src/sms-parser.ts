import { amountMajorToMinor, normalizeMerchant } from "./normalizers";

const amountRegex = /(?:INR|Rs\.?|₹)\s?([\d,]+(?:\.\d{1,2})?)/i;
const debitRegex = /(debited|spent|paid|withdrawn|deducted|purchase|sent|used)/i;
const creditRegex = /(credited|received|deposited|refund|cashback)/i;
const merchantRegex = /(?:at|to)\s+([A-Za-z0-9 _.-]{2,80})/i;

export type ParsedSms = {
  amountMinor: number | null;
  direction: "debit" | "credit" | "unknown";
  merchantOriginal: string | null;
  merchantNormalized: string | null;
  confidenceScore: number;
};

export function parseSmsMessage(message: string): ParsedSms {
  const amountMatch = message.match(amountRegex);
  const debitMatch = debitRegex.test(message);
  const creditMatch = creditRegex.test(message);
  const merchantMatch = message.match(merchantRegex);

  const amountValue = amountMatch?.[1];
  const amountMinor = amountValue
    ? amountMajorToMinor(amountValue.replace(/,/g, ""))
    : null;
  const merchantOriginal = merchantMatch?.[1]?.trim() ?? null;
  const merchantNormalized = merchantOriginal ? normalizeMerchant(merchantOriginal) : null;

  let direction: ParsedSms["direction"] = "unknown";
  if (debitMatch && !creditMatch) {
    direction = "debit";
  } else if (creditMatch && !debitMatch) {
    direction = "credit";
  }

  let confidenceScore = 0;
  if (amountMinor !== null) {
    confidenceScore += 0.3;
  }
  if (direction !== "unknown") {
    confidenceScore += 0.25;
  }
  if (merchantOriginal) {
    confidenceScore += 0.2;
  }
  if (/upi|imps|neft|rtgs/i.test(message)) {
    confidenceScore += 0.15;
  }
  if (/\d{1,2}[-/ ][A-Za-z]{3}[-/ ]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(message)) {
    confidenceScore += 0.1;
  }

  return {
    amountMinor,
    direction,
    merchantOriginal,
    merchantNormalized,
    confidenceScore: Math.min(1, Number(confidenceScore.toFixed(2)))
  };
}
