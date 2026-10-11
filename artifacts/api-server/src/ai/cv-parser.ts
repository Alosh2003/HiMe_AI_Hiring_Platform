// ─── CV/Resume text extraction ────────────────────────────────────────────
// Uses LLM to parse CV content since we don't have file upload storage yet.
// When a user uploads a CV, the file content is extracted and sent to the LLM.

export async function parseCvText(cvText: string): Promise<{
  headline: string;
  summary: string;
  skills: string[];
  experiences: { role: string; company: string; description: string; startDate?: string; endDate?: string }[];
}> {
  // Import dynamically to avoid issues
  const { parseCvWithLLM } = await import("./llm");
  return parseCvWithLLM(cvText);
}

// ─── Extract text from uploaded file (basic text extraction) ───────────────

export function extractTextFromFile(buffer: Buffer, mimeType: string): string {
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return buffer.toString("utf-8");
  }
  if (mimeType === "application/json") {
    return buffer.toString("utf-8");
  }
  // For PDF/DOCX, we'd need a proper parser library
  // For now, return empty string and rely on LLM to handle raw text
  return "";
}

// ─── Validate CV file ──────────────────────────────────────────────────────

export function validateCvFile(file: { name: string; size?: number }): string | null {
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (file.size && file.size > maxSize) {
    return "حجم الملف يتجاوز 10 ميجابايت";
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  const allowed = ["pdf", "docx", "txt", "md"];

  if (!ext || !allowed.includes(ext)) {
    return "نوع الملف غير مدعوم. الأنواع المسموحة: PDF, DOCX, TXT";
  }

  return null;
}
