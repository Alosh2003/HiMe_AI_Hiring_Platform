import { promises as fs } from "fs";
import path from "path";
import mammoth from "mammoth";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Dynamic import for pdf-parse (ESM/CJS compatibility)
async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParseModule = await import("pdf-parse") as unknown as {
      PDFParse?: new (options: { data: Uint8Array }) => {
        getText: () => Promise<{ text: string }>;
        destroy: () => Promise<void>;
      };
      default?: unknown;
    };
    // v2 is class-based: new PDFParse({ data }) -> getText() -> { text }.
    // The default export is not callable, so resolve the class explicitly.
    const PDFParse = pdfParseModule.PDFParse
      ?? (pdfParseModule.default as { PDFParse?: typeof pdfParseModule.PDFParse } | undefined)?.PDFParse
      ?? (pdfParseModule.default as typeof pdfParseModule.PDFParse | undefined);
    if (!PDFParse) throw new Error("PDFParse class not found in pdf-parse module");

    // pdf.js runs its parser in a worker loaded by file path. The bundler
    // does not emit that file, so point it at the real one in node_modules.
    // (pdf-parse, pdfjs-dist and canvas are external in build.mjs.)
    // Node's ESM loader needs a file:// URL, not a bare Windows path.
    try {
      const require = createRequire(import.meta.url);
      const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
      (PDFParse as unknown as { setWorker?: (src: string) => void }).setWorker?.(
        pathToFileURL(workerPath).href,
      );
    } catch {
      // Fall back to pdf.js defaults; text extraction usually still works.
    }

    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text || "";
    } finally {
      await parser.destroy().catch(() => undefined);
    }
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
