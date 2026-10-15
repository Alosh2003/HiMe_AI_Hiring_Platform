import crypto from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import { authTokensTable } from "@workspace/db/schema";

export type AuthTokenType = "password-reset" | "email-verification";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a single-use token. The raw value goes to the user (by email);
 * only its hash is stored, so the database never holds a usable link.
 */
export async function issueAuthToken(
  userId: string,
  type: AuthTokenType,
  ttlMinutes: number,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(authTokensTable).values({
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
  });
  return token;
}

/**
 * Consumes a token: valid, unused, unexpired and of the expected type.
 * Returns the owning user id, or null for any failure. Consumption is
 * atomic — the usedAt update only succeeds for the first caller.
 */
export async function consumeAuthToken(
  token: string,
  type: AuthTokenType,
): Promise<string | null> {
  const updated = await db.update(authTokensTable)
    .set({ usedAt: new Date() })
    .where(and(
      eq(authTokensTable.tokenHash, hashToken(token)),
      eq(authTokensTable.type, type),
      isNull(authTokensTable.usedAt),
      gt(authTokensTable.expiresAt, new Date()),
    ))
    .returning({ userId: authTokensTable.userId });

  return updated[0]?.userId ?? null;
}
