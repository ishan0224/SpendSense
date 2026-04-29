export function normalizeSender(sender: string): string {
  const cleaned = sender.trim().toUpperCase();
  const segments = cleaned.split("-");
  const candidate = segments[segments.length - 1] ?? cleaned;
  return candidate.replace(/[^A-Z0-9]/g, "");
}

export function normalizeMerchant(merchant: string): string {
  return merchant
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function amountMajorToMinor(amountMajor: string | number): number {
  const raw = typeof amountMajor === "number" ? amountMajor.toFixed(2) : amountMajor;
  const [whole = "0", decimals = ""] = raw.trim().split(".");
  const minorPart = Number((decimals + "00").slice(0, 2));
  return Number(whole) * 100 + minorPart;
}

export function deriveMonthKey(date: Date, timezone = "Asia/Kolkata"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}
