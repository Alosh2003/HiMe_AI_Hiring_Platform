import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = process.env["UPLOAD_DIR"] || path.join(process.cwd(), "uploads");

// Ensure upload directory exists
async function ensureUploadDir(): Promise<void> {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

export interface StoredFile {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
}

export async function saveFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<StoredFile> {
  await ensureUploadDir();

  const id = crypto.randomUUID();
  const ext = path.extname(originalName) || "";
  const fileName = `${id}${ext}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  await fs.writeFile(filePath, buffer);

  return {
    id,
    originalName,
    fileName,
    mimeType,
    size: buffer.length,
    path: filePath,
    url: `/files/${fileName}`,
  };
}

export async function getFile(fileName: string): Promise<Buffer> {
  const filePath = path.join(UPLOAD_DIR, fileName);
  return fs.readFile(filePath);
}

export async function deleteFile(fileName: string): Promise<void> {
  const filePath = path.join(UPLOAD_DIR, fileName);
  try {
    await fs.unlink(filePath);
  } catch {
    // File doesn't exist
  }
}

export { UPLOAD_DIR };
