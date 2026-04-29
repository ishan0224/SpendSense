export const transactionDirections = ["debit", "credit"] as const;

export const transactionSources = ["manual", "sms", "notification", "statement"] as const;

export const reconciliationStatuses = [
  "manual",
  "unverified",
  "verified",
  "ignored"
] as const;

export const paymentModes = ["UPI", "Card", "NetBanking", "Cash", "Unknown"] as const;

export const ingestionLogStatuses = [
  "parsed",
  "created",
  "duplicate",
  "ignored",
  "failed",
  "reconciled"
] as const;
