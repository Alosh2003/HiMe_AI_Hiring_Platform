import { db } from "@workspace/db";
import { emailOutboxTable } from "@workspace/db/schema";
import { getConfig } from "../config/env";
import { logger } from "./logger";

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
  kind: string;
}

/**
 * Sends an email through the configured provider.
 *
 * No SMTP provider is configured in development, so the default "log"
 * provider stores every message in the email_outbox table and the structured
 * log. The links inside are real — a developer can click them — so flows like
 * password reset are fully exercisable without a mail server. Point
 * EMAIL_PROVIDER at a real transport (or extend this module) for production.
 *
 * Delivery failures are logged, never thrown: an email that cannot be sent
 * must not break the request that triggered it.
 */
export async function sendEmail(input: OutboundEmail): Promise<void> {
  const provider = getConfig().EMAIL_PROVIDER;

  try {
    if (provider !== "log") {
      logger.warn({ provider, kind: input.kind }, "Unknown EMAIL_PROVIDER; falling back to log outbox");
    }
    await db.insert(emailOutboxTable).values({
      toAddress: input.to,
      subject: input.subject,
      body: input.body,
      kind: input.kind,
    });
    logger.info({ to: input.to, subject: input.subject, kind: input.kind }, "Email captured in outbox");
  } catch (err) {
    logger.error({ err, to: input.to, kind: input.kind }, "Failed to store outbound email");
  }
}
