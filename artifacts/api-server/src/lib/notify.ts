import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { logger } from "./logger";

/**
 * Writes an in-app notification. Like the audit log, a failure here is
 * logged and swallowed — the notification is never the point of the request.
 */
export async function notify(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    });
  } catch (err) {
    logger.error({ err, ...input }, "Failed to write notification");
  }
}
