const sensitiveKeywords = [
  "otp",
  "one time password",
  "cvv",
  "pin",
  "password",
  "do not share"
];

export function isSensitiveMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return sensitiveKeywords.some((keyword) => lower.includes(keyword));
}

export function sanitizeMessage(message: string): string {
  let sanitized = message;

  sanitized = sanitized.replace(/\b\d{10,19}\b/g, (match) => {
    const tail = match.slice(-4);
    return `****${tail}`;
  });

  sanitized = sanitized.replace(/\s+/g, " ").trim();
  return sanitized;
}
