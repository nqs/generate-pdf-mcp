import { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import type { PageSize } from "./types";
import { type ThemeConfig, getPageDimensions, getTheme } from "./themes";

export interface LayoutEngineOptions {
  pageSize?: PageSize;
  theme?: string;
}

export class PDFLayoutEngine {
  private doc!: PDFDocument;
  private currentPage!: PDFPage;
  private cursorY: number = 0;
  private pageWidth: number;
  private pageHeight: number;
  private margins: { top: number; right: number; bottom: number; left: number };
  private theme: ThemeConfig;
  private font!: PDFFont;
  private boldFont!: PDFFont;

  constructor(options: LayoutEngineOptions = {}) {
    const [width, height] = getPageDimensions(options.pageSize ?? "Letter");
    this.pageWidth = width;
    this.pageHeight = height;
    this.theme = getTheme(options.theme ?? "professional");
    this.margins = { ...this.theme.margins };
  }

  async initialize(): Promise<void> {
    this.doc = await PDFDocument.create();
    this.font = await this.doc.embedFont(this.theme.fontFamily);
    this.boldFont = await this.doc.embedFont(this.theme.boldFontFamily);
    this.addPage();
  }

  get contentWidth(): number {
    return this.pageWidth - this.margins.left - this.margins.right;
  }

  get remainingSpace(): number {
    return this.cursorY - this.margins.bottom;
  }

  addPage(): PDFPage {
    this.currentPage = this.doc.addPage([this.pageWidth, this.pageHeight]);
    this.cursorY = this.pageHeight - this.margins.top;
    return this.currentPage;
  }

  ensureSpace(height: number): void {
    if (this.remainingSpace < height) {
      this.addPage();
    }
  }

  moveCursor(dy: number): void {
    this.cursorY -= dy;
  }

  getCurrentPage(): PDFPage {
    return this.currentPage;
  }

  getCursorY(): number {
    return this.cursorY;
  }

  getFont(): PDFFont {
    return this.font;
  }

  getBoldFont(): PDFFont {
    return this.boldFont;
  }

  getTheme(): ThemeConfig {
    return this.theme;
  }

  getDoc(): PDFDocument {
    return this.doc;
  }

  getMargins(): { top: number; right: number; bottom: number; left: number } {
    return this.margins;
  }

  getPageCount(): number {
    return this.doc.getPageCount();
  }

  async save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

