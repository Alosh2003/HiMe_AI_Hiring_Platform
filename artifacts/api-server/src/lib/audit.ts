import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import { logger } from "./logger";

export type AuditAction =
  | "company.verify"
  | "company.reject"
  | "company.suspend"
  | "company.verification.request"
  | "job.delete"
  | "job.create"
  | "user.password.reset";

/**
 * Records a privileged action. Logging must never break the request it
 * describes, so failures are logged and swallowed.
 */
export async function writeAudit(input: {
  actorId?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      meta: input.meta,
    });
  } catch (err) {
    logger.error({ err, ...input }, "Failed to write audit log");
  }
}
