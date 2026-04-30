import dotenv from "dotenv";

dotenv.config();

function readRequired(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function readOptional(key: string): string | undefined {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    return undefined;
  }
  return value;
}

function readNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function readBoolean(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (!value) {
    return fallback;
  }
  return value.toLowerCase() === "true";
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: readNumber("PORT", 10000),
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Kolkata",
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? "INR",
  mongoUri: readOptional("MONGODB_URI"),
  defaultUserId: readOptional("DEFAULT_USER_ID"),
  jwtSecret: readOptional("JWT_SECRET"),
  syncIndexesOnBoot: readBoolean("SYNC_INDEXES_ON_BOOT", false)
};

export function getDefaultUserIdOrThrow(): string {
  if (env.defaultUserId) {
    return env.defaultUserId;
  }
  return readRequired("DEFAULT_USER_ID");
}
