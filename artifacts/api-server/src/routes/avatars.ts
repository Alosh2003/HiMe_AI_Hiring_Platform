import { Router, type IRouter } from "express";
import { promises as fs } from "fs";
import path from "path";
import { like } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, candidatesTable } from "@workspace/db/schema";
import { UPLOAD_DIR } from "../services/file-storage";

const router: IRouter = Router();

const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Serves profile photos.
 *
 * Public on purpose: an <img> tag cannot carry an Authorization header, and a
 * profile photo is meant to be seen (unlike a CV, which stays behind the
 * auth-checked /files route). A file is only served when some account's
 * avatar_url actually points at it, so this route cannot be used to browse
 * the upload directory.
 */
router.get("/:name", async (req, res) => {
  const raw = req.params.name as string;
  // Strip any directory components: only a bare file name is ever valid.
  const fileName = path.basename(raw);

  if (!fileName || fileName !== raw || fileName.includes("..")) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentType = IMAGE_TYPES[ext];
  if (!contentType) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const owner = await db.query.usersTable.findFirst({
    columns: { id: true },
    where: like(usersTable.avatarUrl, `%/${fileName}`),
  });
  if (!owner) {
    // Cover photos live on the candidate row and are served through this
    // same public route; a file is served only when something actually
    // points at it.
    const coverOwner = await db.query.candidatesTable.findFirst({
      columns: { id: true },
      where: like(candidatesTable.coverUrl, `%/${fileName}`),
    });
    if (!coverOwner) {
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
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", data.length);
    // Inline display; never let the browser sniff the type.
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Revocable: the owner can replace or delete the photo at any time.
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(data);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

export default router;
