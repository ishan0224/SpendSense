import { createHash, timingSafeEqual } from "node:crypto";

export function hashWebhookSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function verifyWebhookSecret(secret: string | null, expectedHash: string | undefined): boolean {
  if (!secret || !expectedHash) {
    return false;
  }

  const actualHash = hashWebhookSecret(secret);
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
