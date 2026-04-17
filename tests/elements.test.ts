import { describe, it, expect, beforeEach } from "vitest";
import { PDFLayoutEngine } from "../src/pdf/engine";
import { renderElement } from "../src/pdf/elements";
import { wrapText } from "../src/utils/text";
import { decodeBase64, detectImageFormat } from "../src/utils/images";
import type { ContentElement } from "../src/pdf/types";

describe("wrapText", () => {
  let engine: PDFLayoutEngine;

  beforeEach(async () => {
    engine = new PDFLayoutEngine({ pageSize: "Letter" });
    await engine.initialize();
  });

  it("wraps long text into multiple lines", () => {
    const font = engine.getFont();
    const lines = wrapText(
      "This is a long sentence that should be wrapped into multiple lines when rendered",
      font,
      11,
      100
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 11)).toBeLessThanOrEqual(100 + 50); // allow last word overflow
    }
  });

  it("handles existing newlines", () => {
    const font = engine.getFont();
    const lines = wrapText("Line one\nLine two\nLine three", font, 11, 500);
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe("Line one");
    expect(lines[1]).toBe("Line two");
    expect(lines[2]).toBe("Line three");
  });

  it("returns single line for short text", () => {
    const font = engine.getFont();
    const lines = wrapText("Hello", font, 11, 500);
    expect(lines).toEqual(["Hello"]);
  });
});

describe("decodeBase64", () => {
  it("decodes raw base64 string", () => {
    const input = btoa("hello world");
    const result = decodeBase64(input);
    expect(new TextDecoder().decode(result)).toBe("hello world");
  });

  it("handles data URI prefix", () => {
    const input = "data:image/png;base64," + btoa("hello world");
    const result = decodeBase64(input);
    expect(new TextDecoder().decode(result)).toBe("hello world");
  });
});

describe("detectImageFormat", () => {
  it("detects PNG format", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(detectImageFormat(pngBytes)).toBe("png");
  });

  it("detects JPG format", () => {
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(detectImageFormat(jpgBytes)).toBe("jpg");
  });

  it("defaults to png for unknown format", () => {
    const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(detectImageFormat(unknownBytes)).toBe("png");
  });
});

describe("renderElement dispatch", () => {
  let engine: PDFLayoutEngine;

  beforeEach(async () => {
    engine = new PDFLayoutEngine({ pageSize: "Letter" });
    await engine.initialize();
  });

  it("renders title element", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "title", text: "My Document" });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders h1 element", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "h1", text: "Heading 1" });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders h2 element", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "h2", text: "Heading 2" });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders h3 element", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "h3", text: "Heading 3" });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders paragraph element", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "paragraph", text: "Hello world paragraph." });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders list element (bullet)", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "list", style: "bullet", items: ["Item A", "Item B"] });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders list element (numbered)", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "list", style: "numbered", items: ["First", "Second"] });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders blockquote element", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "blockquote", text: "A wise quote." });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders divider element", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "divider" });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders table element", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, {
      type: "table",
      headers: ["Name", "Age"],
      rows: [
        ["Alice", "30"],
        ["Bob", "25"],
      ],
    });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders page_break element", async () => {
    const pagesBefore = engine.getPageCount();
    await renderElement(engine, { type: "page_break" });
    expect(engine.getPageCount()).toBe(pagesBefore + 1);
  });
});

describe("integration: full PDF with all element types", () => {
  it("generates valid PDF bytes with every element type", async () => {
    const engine = new PDFLayoutEngine({ pageSize: "Letter" });
    await engine.initialize();

    const elements: ContentElement[] = [
      { type: "title", text: "Integration Test Document" },
      { type: "h1", text: "Section One" },
      { type: "paragraph", text: "This is a paragraph with enough text to test wrapping behavior in the PDF engine." },
      { type: "h2", text: "Subsection" },
      { type: "list", style: "bullet", items: ["First item", "Second item", "Third item"] },
      { type: "h3", text: "Details" },
      { type: "list", style: "numbered", items: ["Step one", "Step two"] },
      { type: "blockquote", text: "This is a blockquote with some insightful text." },
      { type: "divider" },
      { type: "table", headers: ["Col A", "Col B", "Col C"], rows: [["1", "2", "3"], ["4", "5", "6"]] },
      { type: "page_break" },
      { type: "h1", text: "Page Two" },
      { type: "paragraph", text: "Content on the second page." },
    ];

    for (const el of elements) {
      await renderElement(engine, el);
    }

    const bytes = await engine.save();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    // PDF magic bytes: %PDF
    expect(bytes[0]).toBe(0x25); // %
    expect(bytes[1]).toBe(0x50); // P
    expect(bytes[2]).toBe(0x44); // D
    expect(bytes[3]).toBe(0x46); // F
    expect(engine.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});

describe("renderElement — markdown", () => {
  let engine: PDFLayoutEngine;

  beforeEach(async () => {
    engine = new PDFLayoutEngine({ pageSize: "Letter" });
    await engine.initialize();
  });

  it("renders heading + paragraph", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "markdown", text: "# Hello\n\nWorld" });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders a list", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "markdown", text: "- Alpha\n- Beta\n- Gamma" });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders a blockquote", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "markdown", text: "> Some wise words" });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders a horizontal rule", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "markdown", text: "---" });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders a table", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, {
      type: "markdown",
      text: "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |",
    });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("renders mixed content", async () => {
    const md = [
      "# Title",
      "",
      "A paragraph here.",
      "",
      "- Item one",
      "- Item two",
      "",
      "> A quote",
      "",
      "---",
    ].join("\n");

    await renderElement(engine, { type: "markdown", text: md });
    const bytes = await engine.save();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("strips inline formatting gracefully", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, {
      type: "markdown",
      text: "This has **bold**, *italic*, `code`, and [a link](https://example.com).",
    });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("handles whitespace-only markdown without crashing", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, { type: "markdown", text: "   \n\n   " });
    // Cursor may or may not move, but it should not throw
    expect(engine.getCursorY()).toBeLessThanOrEqual(startY);
  });

  it("renders fenced code blocks as paragraphs", async () => {
    const startY = engine.getCursorY();
    await renderElement(engine, {
      type: "markdown",
      text: "```\nconst x = 1;\nconsole.log(x);\n```",
    });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });

  it("maps heading depths correctly", async () => {
    // depth 1 = title, depth 2 = h1, depth 3 = h2, depth 4+ = h3
    const startY = engine.getCursorY();
    await renderElement(engine, {
      type: "markdown",
      text: "# Title\n\n## H1\n\n### H2\n\n#### H3\n\n##### Also H3",
    });
    expect(engine.getCursorY()).toBeLessThan(startY);
  });
});

