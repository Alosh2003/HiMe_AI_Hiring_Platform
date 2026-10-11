import { promises as fs } from "fs";
import path from "path";
import mammoth from "mammoth";

// Dynamic import for pdf-parse (ESM/CJS compatibility)
async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as { default?: unknown }).default ?? pdfParseModule;
    const data = await (pdfParse as unknown as (buf: Buffer) => Promise<{ text: string }>)(buffer);
    return data.text || "";
  } catch (error) {
    console.error("PDF parsing error:", error);
    return "";
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (error) {
    console.error("DOCX parsing error:", error);
    return "";
  }
}

async function parseDoc(buffer: Buffer): Promise<string> {
  // .doc files are harder to parse — try as text or return empty
  return "";
}

export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  switch (mimeType) {
    case "application/pdf":
      return parsePdf(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return parseDocx(buffer);
    case "application/msword":
      return parseDoc(buffer);
    case "text/plain":
    case "text/markdown":
      return buffer.toString("utf-8");
    default:
      return "";
  }
}

export function getExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}
