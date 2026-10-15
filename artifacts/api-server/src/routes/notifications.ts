import { Router, type IRouter } from "express";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { authMiddleware, type AuthRequest } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validate-params";

const router: IRouter = Router();

/** The signed-in user's own notifications, newest first. */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;

  const [items, unread] = await Promise.all([
    db.query.notificationsTable.findMany({
      where: eq(notificationsTable.userId, userId),
      orderBy: desc(notificationsTable.createdAt),
      limit: 50,
    }),
    db.select({ value: count() })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false))),
  ]);

  res.json({
    notifications: items,
    unreadCount: Number(unread[0]?.value || 0),
  });
});

router.post("/read-all", authMiddleware, async (req: AuthRequest, res) => {
  await db.update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, req.user!.userId));
  res.status(204).send();
});

router.patch("/:id/read", authMiddleware, validateUuidParam("id"), async (req: AuthRequest, res) => {
  // Scoped to the owner: another user's notification id is a 404, not a lever.
  const updated = await db.update(notificationsTable)
    .set({ read: true })
    .where(and(
      eq(notificationsTable.id, req.params.id as string),
      eq(notificationsTable.userId, req.user!.userId),
    ))
    .returning();

  if (!updated[0]) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(updated[0]);
});

export default router;
