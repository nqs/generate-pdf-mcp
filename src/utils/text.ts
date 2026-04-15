import type { PDFFont } from "pdf-lib";

/**
 * Split text into lines that fit within maxWidth using font metrics.
 * Handles existing newlines in the input text.
 */
export function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const result: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      result.push("");
      continue;
    }

    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      result.push("");
      continue;
    }

    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + " " + words[i];
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        result.push(currentLine);
        currentLine = words[i];
      }
    }

    result.push(currentLine);
  }

  return result;
}

