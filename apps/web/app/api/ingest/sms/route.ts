import { NextResponse } from "next/server";
import { webhookIngestPayloadSchema } from "@spendsense/shared";
import { createMongoSmsIngestionPersistence, ingestSmsPayload } from "../../../../lib/sms-ingestion";
import { verifyWebhookSecret } from "../../../../lib/webhook-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const isAuthorized = verifyWebhookSecret(
    request.headers.get("x-webhook-secret"),
    process.env.WEBHOOK_SECRET_HASH
  );

  if (!isAuthorized) {
    return NextResponse.json(
      { status: "unauthorized", reason: "invalid_webhook_secret" },
      { status: 401 }
    );
  }

  const userId = process.env.DEFAULT_USER_ID;
  if (!userId) {
    return NextResponse.json(
      { status: "failed", reason: "missing_default_user_id" },
      { status: 500 }
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
