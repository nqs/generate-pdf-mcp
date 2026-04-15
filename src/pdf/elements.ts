import { rgb } from "pdf-lib";
import type { PDFLayoutEngine } from "./engine";
import type {
  ContentElement,
  TitleElement,
  H1Element,
  H2Element,
  H3Element,
  ParagraphElement,
  ImageElement,
  ImageUrlElement,
  ListElement,
  TableElement,
  BlockquoteElement,
} from "./types";
import { wrapText } from "../utils/text";
import { decodeBase64, detectImageFormat, fetchImageAsBytes } from "../utils/images";

/** Convert a hex color string (e.g. "#1a1a2e") to pdf-lib rgb(). */
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

export async function renderElement(
  engine: PDFLayoutEngine,
  element: ContentElement
): Promise<void> {
  switch (element.type) {
    case "title":
      return renderTitle(engine, element);
    case "h1":
    case "h2":
    case "h3":
      return renderHeading(engine, element);
    case "paragraph":
      return renderParagraph(engine, element);
    case "image":
      return renderImage(engine, element);
    case "image_url":
      return renderImageUrl(engine, element);
    case "list":
      return renderList(engine, element);
    case "table":
      return renderTable(engine, element);
    case "page_break":
      return renderPageBreak(engine);
    case "blockquote":
      return renderBlockquote(engine, element);
    case "divider":
      return renderDivider(engine);
  }
}

function renderTitle(engine: PDFLayoutEngine, element: TitleElement): void {
  const theme = engine.getTheme();
  const fontSize = theme.fontSize.title;
  const font = engine.getBoldFont();
  const color = hexToRgb(theme.colors.title);
  const totalHeight = fontSize + fontSize * 1.5;

  engine.ensureSpace(totalHeight);

  const textWidth = font.widthOfTextAtSize(element.text, fontSize);
  const x = engine.getMargins().left + (engine.contentWidth - textWidth) / 2;

  engine.getCurrentPage().drawText(element.text, {
    x,
    y: engine.getCursorY(),
    size: fontSize,
    font,
    color,
  });

  engine.moveCursor(fontSize + fontSize * 1.5);
}

function renderHeading(
  engine: PDFLayoutEngine,
  element: H1Element | H2Element | H3Element
): void {
  const theme = engine.getTheme();
  const sizeMap = { h1: theme.fontSize.h1, h2: theme.fontSize.h2, h3: theme.fontSize.h3 };
  const fontSize = sizeMap[element.type];
  const font = engine.getBoldFont();
  const color = hexToRgb(theme.colors.heading);
  const spacingAbove = fontSize * 0.8;
  const spacingBelow = fontSize * 0.4;

  engine.ensureSpace(spacingAbove + fontSize + spacingBelow);
  engine.moveCursor(spacingAbove);

  engine.getCurrentPage().drawText(element.text, {
    x: engine.getMargins().left,
    y: engine.getCursorY(),
    size: fontSize,
    font,
    color,
  });

  engine.moveCursor(fontSize + spacingBelow);
}

function renderParagraph(engine: PDFLayoutEngine, element: ParagraphElement): void {
  const theme = engine.getTheme();
  const fontSize = theme.fontSize.body;
  const font = engine.getFont();
  const color = hexToRgb(theme.colors.body);
  const lineH = fontSize * theme.lineHeight;

  const lines = wrapText(element.text, font, fontSize, engine.contentWidth);

  // Ensure space for at least one line
  engine.ensureSpace(lineH);

  for (const line of lines) {
    engine.ensureSpace(lineH);
    engine.getCurrentPage().drawText(line, {
      x: engine.getMargins().left,
      y: engine.getCursorY(),
      size: fontSize,
      font,
      color,
    });
    engine.moveCursor(lineH);
  }

  engine.moveCursor(fontSize * 0.5);
}

async function renderImage(engine: PDFLayoutEngine, element: ImageElement): Promise<void> {
  const bytes = decodeBase64(element.data);
  const format = element.format ?? detectImageFormat(bytes);
  await embedAndDrawImage(engine, bytes, format, element.width, element.caption);
}

async function renderImageUrl(engine: PDFLayoutEngine, element: ImageUrlElement): Promise<void> {
  const bytes = await fetchImageAsBytes(element.url);
  const format = detectImageFormat(bytes);
  await embedAndDrawImage(engine, bytes, format, element.width, element.caption);
}

async function embedAndDrawImage(
  engine: PDFLayoutEngine,
  bytes: Uint8Array,
  format: "png" | "jpg",
  widthRatio?: number,
  caption?: string
): Promise<void> {
  const doc = engine.getDoc();
  const image = format === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

  const maxWidth = widthRatio ? engine.contentWidth * widthRatio : engine.contentWidth;
  const scale = Math.min(1, maxWidth / image.width);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  const theme = engine.getTheme();
  const captionHeight = caption ? theme.fontSize.body * 1.5 : 0;

  engine.ensureSpace(drawHeight + captionHeight);

  // Draw image (pdf-lib y is bottom-left, so y is bottom of image)
  const x = engine.getMargins().left + (engine.contentWidth - drawWidth) / 2;
  engine.getCurrentPage().drawImage(image, {
    x,
    y: engine.getCursorY() - drawHeight,
    width: drawWidth,
    height: drawHeight,
  });

  engine.moveCursor(drawHeight);

  if (caption) {
    const captionSize = theme.fontSize.body - 1;
    const font = engine.getFont();
    const color = hexToRgb(theme.colors.body);
    const captionWidth = font.widthOfTextAtSize(caption, captionSize);
    const cx = engine.getMargins().left + (engine.contentWidth - captionWidth) / 2;

    engine.moveCursor(4);
    engine.getCurrentPage().drawText(caption, {
      x: cx,
      y: engine.getCursorY(),
      size: captionSize,
      font,
      color,
    });
    engine.moveCursor(captionSize + 8);
  } else {
    engine.moveCursor(8);
  }
}

function renderList(engine: PDFLayoutEngine, element: ListElement): void {
  const theme = engine.getTheme();
  const fontSize = theme.fontSize.body;
  const font = engine.getFont();
  const color = hexToRgb(theme.colors.body);
  const lineH = fontSize * theme.lineHeight;
  const indent = 20;
  const leftX = engine.getMargins().left + indent;
  const wrapWidth = engine.contentWidth - indent;

  for (let i = 0; i < element.items.length; i++) {
    const prefix = element.style === "bullet" ? "•  " : `${i + 1}. `;
    const prefixWidth = font.widthOfTextAtSize(prefix, fontSize);
    const lines = wrapText(element.items[i], font, fontSize, wrapWidth - prefixWidth);

    engine.ensureSpace(lineH);

    for (let j = 0; j < lines.length; j++) {
      engine.ensureSpace(lineH);
      const text = j === 0 ? prefix + lines[j] : " ".repeat(prefix.length) + lines[j];
      engine.getCurrentPage().drawText(text, {
        x: leftX,
        y: engine.getCursorY(),
        size: fontSize,
        font,
        color,
      });
      engine.moveCursor(lineH);
    }
  }

  engine.moveCursor(fontSize * 0.5);
}

function renderTable(engine: PDFLayoutEngine, element: TableElement): void {
  const theme = engine.getTheme();
  const fontSize = theme.fontSize.body;
  const font = engine.getFont();
  const boldFont = engine.getBoldFont();
  const bodyColor = hexToRgb(theme.colors.body);
  const accentColor = hexToRgb(theme.colors.accent);
  const cellPadding = 5;
  const colCount = element.headers.length;
  const colWidth = engine.contentWidth / colCount;
  const rowHeight = fontSize + cellPadding * 2;
  const margins = engine.getMargins();

  const drawHeaderRow = () => {
    engine.ensureSpace(rowHeight);
    const y = engine.getCursorY();

    // Header background
    engine.getCurrentPage().drawRectangle({
      x: margins.left,
      y: y - rowHeight + cellPadding,
      width: engine.contentWidth,
      height: rowHeight,
      color: accentColor,
      opacity: 0.15,
    });

    for (let c = 0; c < colCount; c++) {
      const text = element.headers[c] ?? "";
      engine.getCurrentPage().drawText(text, {
        x: margins.left + c * colWidth + cellPadding,
        y: y - fontSize,
        size: fontSize,
        font: boldFont,
        color: bodyColor,
        maxWidth: colWidth - cellPadding * 2,
      });
    }

    // Header bottom border
    engine.getCurrentPage().drawLine({
      start: { x: margins.left, y: y - rowHeight + cellPadding },
      end: { x: margins.left + engine.contentWidth, y: y - rowHeight + cellPadding },
      thickness: 1,
      color: bodyColor,
      opacity: 0.3,
    });

    engine.moveCursor(rowHeight);
  };

  // Draw header
  drawHeaderRow();

  // Draw data rows
  for (const row of element.rows) {
    if (engine.remainingSpace < rowHeight) {
      engine.addPage();
      drawHeaderRow();
    }

    const y = engine.getCursorY();

    for (let c = 0; c < colCount; c++) {
      const text = row[c] ?? "";
      engine.getCurrentPage().drawText(text, {
        x: margins.left + c * colWidth + cellPadding,
        y: y - fontSize,
        size: fontSize,
        font,
        color: bodyColor,
        maxWidth: colWidth - cellPadding * 2,
      });
    }

    // Row bottom border
    engine.getCurrentPage().drawLine({
      start: { x: margins.left, y: y - rowHeight + cellPadding },
      end: { x: margins.left + engine.contentWidth, y: y - rowHeight + cellPadding },
      thickness: 0.5,
      color: bodyColor,
      opacity: 0.2,
    });

    engine.moveCursor(rowHeight);
  }

  engine.moveCursor(fontSize * 0.5);
}

function renderPageBreak(engine: PDFLayoutEngine): void {
  engine.addPage();
}

function renderBlockquote(engine: PDFLayoutEngine, element: BlockquoteElement): void {
  const theme = engine.getTheme();
  const fontSize = theme.fontSize.body;
  const font = engine.getFont();
  const color = hexToRgb(theme.colors.body);
  const accentColor = hexToRgb(theme.colors.accent);
  const lineH = fontSize * theme.lineHeight;
  const indent = 20;
  const borderX = engine.getMargins().left + 5;
  const textX = engine.getMargins().left + indent;
  const wrapWidth = engine.contentWidth - indent;

  const lines = wrapText(element.text, font, fontSize, wrapWidth);
  const totalHeight = lines.length * lineH;

  engine.ensureSpace(Math.min(totalHeight, lineH * 2));

  const startY = engine.getCursorY();

  for (const line of lines) {
    engine.ensureSpace(lineH);
    engine.getCurrentPage().drawText(line, {
      x: textX,
      y: engine.getCursorY(),
      size: fontSize,
      font,
      color,
    });
    engine.moveCursor(lineH);
  }

  // Draw left border for the portion on the current page
  const endY = engine.getCursorY();
  if (startY > endY) {
    engine.getCurrentPage().drawLine({
      start: { x: borderX, y: startY + fontSize * 0.3 },
      end: { x: borderX, y: endY + lineH * 0.5 },
      thickness: 2,
      color: accentColor,
    });
  }

  engine.moveCursor(fontSize * 0.5);
}

function renderDivider(engine: PDFLayoutEngine): void {
  const margins = engine.getMargins();
  const spacingAbove = 10;
  const spacingBelow = 10;

  engine.ensureSpace(spacingAbove + spacingBelow + 1);
  engine.moveCursor(spacingAbove);

  engine.getCurrentPage().drawLine({
    start: { x: margins.left, y: engine.getCursorY() },
    end: { x: margins.left + engine.contentWidth, y: engine.getCursorY() },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  engine.moveCursor(spacingBelow);
}
