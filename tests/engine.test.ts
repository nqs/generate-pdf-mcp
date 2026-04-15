import { describe, it, expect, beforeEach } from "vitest";
import { PDFLayoutEngine } from "../src/pdf/engine";
import { getTheme, getPageDimensions } from "../src/pdf/themes";

describe("PDFLayoutEngine", () => {
  let engine: PDFLayoutEngine;

  beforeEach(async () => {
    engine = new PDFLayoutEngine({ pageSize: "Letter", theme: "professional" });
    await engine.initialize();
  });

  it("creates a PDF document with one page", () => {
    expect(engine.getDoc()).toBeDefined();
    expect(engine.getPageCount()).toBe(1);
    expect(engine.getCurrentPage()).toBeDefined();
  });

  it("initializes cursor at pageHeight - margins.top", () => {
    const theme = getTheme("professional");
    const [, height] = getPageDimensions("Letter");
    expect(engine.getCursorY()).toBe(height - theme.margins.top);
  });

  it("tracks cursor position when moving", () => {
    const startY = engine.getCursorY();
    engine.moveCursor(50);
    expect(engine.getCursorY()).toBe(startY - 50);
  });

  it("calculates contentWidth correctly", () => {
    const theme = getTheme("professional");
    const [width] = getPageDimensions("Letter");
    expect(engine.contentWidth).toBe(width - theme.margins.left - theme.margins.right);
  });

  it("calculates remainingSpace correctly", () => {
    const theme = getTheme("professional");
    const [, height] = getPageDimensions("Letter");
    const expectedRemaining = height - theme.margins.top - theme.margins.bottom;
    expect(engine.remainingSpace).toBe(expectedRemaining);
  });

  it("adds a new page and resets cursor", () => {
    engine.moveCursor(200);
    const cursorBefore = engine.getCursorY();
    engine.addPage();
    expect(engine.getPageCount()).toBe(2);
    expect(engine.getCursorY()).toBeGreaterThan(cursorBefore);
  });

  it("ensureSpace triggers new page when not enough room", () => {
    // Move cursor close to bottom margin
    const theme = getTheme("professional");
    const [, height] = getPageDimensions("Letter");
    const usableHeight = height - theme.margins.top - theme.margins.bottom;
    engine.moveCursor(usableHeight - 10); // only 10pt left
    expect(engine.getPageCount()).toBe(1);

    engine.ensureSpace(50); // needs 50pt, only 10pt available
    expect(engine.getPageCount()).toBe(2);
    // Cursor should be reset to top of new page
    expect(engine.getCursorY()).toBe(height - theme.margins.top);
  });

  it("ensureSpace does NOT add page when enough room", () => {
    engine.ensureSpace(50);
    expect(engine.getPageCount()).toBe(1);
  });

  it("multi-page generation produces correct page count", () => {
    const theme = getTheme("professional");
    const [, height] = getPageDimensions("Letter");
    const usableHeight = height - theme.margins.top - theme.margins.bottom;

    // Fill 5 pages worth of content
    for (let i = 0; i < 5; i++) {
      engine.ensureSpace(20);
      engine.moveCursor(usableHeight);
    }
    // First page + 4 additional pages triggered by ensureSpace
    expect(engine.getPageCount()).toBe(5);
  });

  it("embeds fonts from theme", () => {
    expect(engine.getFont()).toBeDefined();
    expect(engine.getBoldFont()).toBeDefined();
  });

  it("returns theme configuration", () => {
    const theme = engine.getTheme();
    expect(theme.name).toBe("professional");
    expect(theme.fontSize.body).toBe(11);
  });

  it("saves PDF as Uint8Array", async () => {
    const bytes = await engine.save();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });
});

describe("themes", () => {
  it("returns professional theme by default", () => {
    const theme = getTheme("unknown");
    expect(theme.name).toBe("professional");
  });

  it("returns all three theme presets", () => {
    for (const name of ["professional", "minimal", "academic"] as const) {
      const theme = getTheme(name);
      expect(theme.name).toBe(name);
      expect(theme.fontSize.body).toBeGreaterThan(0);
    }
  });

  it("returns correct page dimensions", () => {
    expect(getPageDimensions("A4")).toEqual([595.28, 841.89]);
    expect(getPageDimensions("Letter")).toEqual([612, 792]);
    expect(getPageDimensions("Legal")).toEqual([612, 1008]);
  });

  it("defaults to Letter for unknown page size", () => {
    expect(getPageDimensions("unknown")).toEqual([612, 792]);
  });
});

