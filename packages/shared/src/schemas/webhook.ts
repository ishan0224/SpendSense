import { z } from "zod";
import { transactionSources } from "../constants/domain";

export const webhookSourceSchema = z.enum(transactionSources);

export const webhookIngestPayloadSchema = z.object({
  source: webhookSourceSchema,
  sender: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(2000),
  receivedAt: z.string().datetime()
});

export type WebhookIngestPayload = z.infer<typeof webhookIngestPayloadSchema>;
