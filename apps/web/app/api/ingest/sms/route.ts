import { NextResponse } from "next/server";
import { webhookIngestPayloadSchema } from "@spendsense/shared";
import mongoose from "mongoose";
import { connectMongoForRouteHandler } from "../../../../lib/mongo";
import { WebWebhookKeyModel } from "../../../../lib/ingest-models";
import { createMongoSmsIngestionPersistence, ingestSmsPayload } from "../../../../lib/sms-ingestion";
import { verifyWebhookSecret, verifyWebhookSecretAgainstHashes } from "../../../../lib/webhook-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = process.env.DEFAULT_USER_ID;
  if (!userId) {
    return NextResponse.json(
      { status: "failed", reason: "missing_default_user_id" },
      { status: 500 }
    );
  }

  const providedSecret = request.headers.get("x-webhook-secret");
  let isAuthorized = verifyWebhookSecret(providedSecret, process.env.WEBHOOK_SECRET_HASH);

  if (!isAuthorized) {
    await connectMongoForRouteHandler();
    const activeKeys = await WebWebhookKeyModel.find(
      { isActive: true, userId: new mongoose.Types.ObjectId(userId) },
      { secretHash: 1 }
    ).lean();
    const hashes = activeKeys
      .map((item) => item.secretHash)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    isAuthorized = verifyWebhookSecretAgainstHashes(providedSecret, hashes);
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { status: "unauthorized", reason: "invalid_webhook_secret" },
      { status: 401 }
    );
  }

  try {
    const json = await request.json();
    const payload = webhookIngestPayloadSchema.parse(json);
    const result = await ingestSmsPayload({
      payload,
      userId,
      timezone: process.env.APP_TIMEZONE ?? "Asia/Kolkata",
      defaultCurrency: process.env.DEFAULT_CURRENCY ?? "INR",
      persistence: createMongoSmsIngestionPersistence()
    });

    const responseStatus = result.status === "created" ? 201 : 200;
    return NextResponse.json(result, { status: responseStatus });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { status: "failed", reason: "invalid_or_failed_payload" },
      { status: 400 }
    );
  }
}
