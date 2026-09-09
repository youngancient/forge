import { SUPPORTING_TEXT_MAX } from "@/lib/validations";

export class ExtractionError extends Error {}

// design.md decision #18: extraction failure never silently drops or
// silently proceeds — callers surface ExtractionError as an explicit
// re-upload-or-proceed-without choice to the salesperson.
export async function extractTextFromFile(
  file: File,
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (file.type === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        if (!result.text.trim()) {
          throw new ExtractionError("No extractable text found in PDF.");
        }
        return result.text.slice(0, SUPPORTING_TEXT_MAX);
      } finally {
        await parser.destroy();
      }
    }

    if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value.trim()) {
        throw new ExtractionError("No extractable text found in document.");
      }
      return result.value.slice(0, SUPPORTING_TEXT_MAX);
    }

    if (file.type === "text/plain") {
      const text = buffer.toString("utf-8");
      if (!text.trim()) {
        throw new ExtractionError("File is empty.");
      }
      return text.slice(0, SUPPORTING_TEXT_MAX);
    }

    throw new ExtractionError(`Unsupported file type: ${file.type}`);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError(
      `Could not read file (corrupted or password-protected): ${String(error)}`,
    );
  }
}
