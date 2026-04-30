import { createHash, timingSafeEqual } from "node:crypto";

export function hashWebhookSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function compareHash(secret: string, expectedHash: string): boolean {
  const actualHash = hashWebhookSecret(secret);
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function verifyWebhookSecret(secret: string | null, expectedHash: string | undefined): boolean {
  if (!secret || !expectedHash) {
    return false;
  }
  return compareHash(secret, expectedHash);
}

export function verifyWebhookSecretAgainstHashes(secret: string | null, hashes: string[]): boolean {
  if (!secret || hashes.length === 0) {
    return false;
  }
  return hashes.some((hash) => compareHash(secret, hash));
}
