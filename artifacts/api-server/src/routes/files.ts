import { Router, type IRouter } from "express";
import { promises as fs } from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { candidatesTable } from "@workspace/db/schema";
import { authMiddleware, type AuthRequest } from "../middleware/auth";
import { UPLOAD_DIR } from "../services/file-storage";

const router: IRouter = Router();

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

/**
 * Serves an uploaded file only to someone entitled to see it.
 *
 * The previous express.static mount exposed every CV to anyone with a URL.
 * Now: the owning seeker, or an admin. Everyone else — including other
 * signed-in users — gets the same 404 as a missing file, so the endpoint
 * cannot be used to probe for other people's documents.
 */
router.get(
  "/:name",
  authMiddleware,
  async (req: AuthRequest, res) => {
    const raw = req.params.name as string;
    // Strip any directory components: only a bare file name is ever valid.
    const fileName = path.basename(raw);

    if (!fileName || fileName !== raw || fileName.includes("..")) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!CONTENT_TYPES[ext]) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const isAdmin = req.user!.role === "admin";
    if (!isAdmin) {
      const owner = await db.query.candidatesTable.findFirst({
        where: eq(candidatesTable.userId, req.user!.userId),
        columns: { cvUrl: true },
      });
      if (!owner?.cvUrl || !owner.cvUrl.endsWith(`/${fileName}`)) {
        res.status(404).json({ error: "File not found" });
        return;
      }
    }

    const filePath = path.join(UPLOAD_DIR, fileName);
    // Belt and braces: the resolved path must stay inside the upload dir.
    if (path.relative(UPLOAD_DIR, filePath).startsWith("..")) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    try {
      const data = await fs.readFile(filePath);
      res.setHeader("Content-Type", CONTENT_TYPES[ext] as string);
      res.setHeader("Content-Length", data.length);
      // Inline display; never let the browser sniff the type.
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(data);
    } catch {
      res.status(404).json({ error: "File not found" });
      return;
    }
  },
);

export default router;
