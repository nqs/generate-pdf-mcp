import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  GeneratePDFInputSchema,
  ContentElementSchema,
  StyleSheetSchema,
  validateGeneratePdfInput,
} from "../src/pdf/schemas.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validMinimalInput = {
  filename: "report.pdf",
  content: [{ type: "paragraph", text: "Hello world" }],
};

const validFullInput = {
  filename: "report.pdf",
  style: {
    fontFamily: "TimesRoman",
    fontSize: { title: 26, body: 12 },
    colors: { title: "#000000" },
    margins: { top: 72, right: 72, bottom: 72, left: 72 },
    lineHeight: 1.5,
  },
  pageSize: "Letter",
  content: [
    { type: "title", text: "My Report" },
    { type: "h1", text: "Introduction" },
    { type: "h2", text: "Background" },
    { type: "h3", text: "Details" },
    { type: "paragraph", text: "Some body text." },
    { type: "image", data: "aGVsbG8=", format: "png", caption: "Fig 1", width: 0.5 },
    { type: "image_url", url: "https://example.com/img.png", caption: "Fig 2", width: 1 },
    { type: "list", style: "bullet", items: ["one", "two"] },
    { type: "list", style: "numbered", items: ["first"] },
    { type: "table", headers: ["A", "B"], rows: [["1", "2"]] },
    { type: "page_break" },
    { type: "blockquote", text: "A wise quote." },
    { type: "divider" },
    { type: "markdown", text: "# Hello\n\nWorld" },
  ],
};

// ---------------------------------------------------------------------------
// Valid payloads
// ---------------------------------------------------------------------------

describe("GeneratePDFInputSchema — valid payloads", () => {
  it("accepts minimal input and applies defaults", () => {
    const result = GeneratePDFInputSchema.parse(validMinimalInput);
    expect(result.style).toBeUndefined();
    expect(result.pageSize).toBe("A4");
    expect(result.content).toHaveLength(1);
  });

  it("accepts a full input with style overrides and all element types", () => {
    const result = GeneratePDFInputSchema.parse(validFullInput);
    expect(result.filename).toBe("report.pdf");
    expect(result.style?.fontFamily).toBe("TimesRoman");
    expect(result.content).toHaveLength(14);
  });
});

// ---------------------------------------------------------------------------
// Invalid payloads — top-level
// ---------------------------------------------------------------------------

describe("GeneratePDFInputSchema — invalid top-level", () => {
  it("rejects missing filename", () => {
    expect(() =>
      GeneratePDFInputSchema.parse({ content: [{ type: "divider" }] })
    ).toThrow();
  });

  it("rejects empty filename", () => {
    expect(() =>
      GeneratePDFInputSchema.parse({ filename: "", content: [{ type: "divider" }] })
    ).toThrow();
  });

  it("rejects empty content array", () => {
    expect(() =>
      GeneratePDFInputSchema.parse({ filename: "a.pdf", content: [] })
    ).toThrow();
  });

  it("rejects invalid pageSize", () => {
    expect(() =>
      GeneratePDFInputSchema.parse({
        filename: "a.pdf",
        pageSize: "Tabloid",
        content: [{ type: "divider" }],
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Invalid payloads — content elements
// ---------------------------------------------------------------------------

describe("ContentElementSchema — invalid elements", () => {
  it("rejects unknown element type", () => {
    expect(() => ContentElementSchema.parse({ type: "video" })).toThrow();
  });

  it("rejects paragraph with missing text", () => {
    expect(() => ContentElementSchema.parse({ type: "paragraph" })).toThrow();
  });

  it("rejects image with missing data", () => {
    expect(() => ContentElementSchema.parse({ type: "image" })).toThrow();
  });

  it("rejects image with invalid format", () => {
    expect(() =>
      ContentElementSchema.parse({ type: "image", data: "abc", format: "gif" })
    ).toThrow();
  });

  it("rejects image width out of range", () => {
    expect(() =>
      ContentElementSchema.parse({ type: "image", data: "abc", width: 1.5 })
    ).toThrow();
    expect(() =>
      ContentElementSchema.parse({ type: "image", data: "abc", width: 0 })
    ).toThrow();
  });

  it("rejects image_url with invalid url", () => {
    expect(() =>
      ContentElementSchema.parse({ type: "image_url", url: "not-a-url" })
    ).toThrow();
  });

  it("rejects list with empty items", () => {
    expect(() =>
      ContentElementSchema.parse({ type: "list", style: "bullet", items: [] })
    ).toThrow();
  });

  it("rejects list with invalid style", () => {
    expect(() =>
      ContentElementSchema.parse({ type: "list", style: "dashed", items: ["a"] })
    ).toThrow();
  });

  it("rejects table with empty headers", () => {
    expect(() =>
      ContentElementSchema.parse({ type: "table", headers: [], rows: [["a"]] })
    ).toThrow();
  });

  it("rejects table with empty rows", () => {
    expect(() =>
      ContentElementSchema.parse({ type: "table", headers: ["A"], rows: [] })
    ).toThrow();
  });

  it("accepts valid markdown element", () => {
    const result = ContentElementSchema.parse({ type: "markdown", text: "# Hello" });
    expect(result).toEqual({ type: "markdown", text: "# Hello" });
  });

  it("rejects markdown with empty text", () => {
    expect(() =>
      ContentElementSchema.parse({ type: "markdown", text: "" })
    ).toThrow();
  });

  it("rejects markdown with missing text", () => {
    expect(() =>
      ContentElementSchema.parse({ type: "markdown" })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateGeneratePdfInput helper
// ---------------------------------------------------------------------------

describe("validateGeneratePdfInput", () => {
  it("returns typed result for valid input", () => {
    const result = validateGeneratePdfInput(validMinimalInput);
    expect(result.filename).toBe("report.pdf");
  });

  it("throws ZodError for invalid input", () => {
    expect(() => validateGeneratePdfInput({})).toThrow();
  });
});


// ---------------------------------------------------------------------------
// StyleSheet validation
// ---------------------------------------------------------------------------

describe("StyleSheetSchema", () => {
  it("accepts an empty style sheet (all optional)", () => {
    const result = StyleSheetSchema.parse({});
    expect(result).toEqual({});
  });

  it("accepts a partial style sheet", () => {
    const result = StyleSheetSchema.parse({
      fontFamily: "Courier",
      lineHeight: 1.6,
    });
    expect(result.fontFamily).toBe("Courier");
    expect(result.lineHeight).toBe(1.6);
  });

  it("accepts a full style sheet", () => {
    const result = StyleSheetSchema.parse({
      fontFamily: "Helvetica",
      fontSize: { title: 30, h1: 24, h2: 20, h3: 16, body: 12 },
      colors: { title: "#111111", heading: "#222222", body: "#333333", accent: "#444444" },
      margins: { top: 50, right: 50, bottom: 50, left: 50 },
      lineHeight: 1.5,
    });
    expect(result.fontFamily).toBe("Helvetica");
    expect(result.fontSize?.title).toBe(30);
  });

  it("rejects invalid hex color", () => {
    expect(() =>
      StyleSheetSchema.parse({ colors: { title: "red" } })
    ).toThrow();
    expect(() =>
      StyleSheetSchema.parse({ colors: { title: "#GGG000" } })
    ).toThrow();
  });

  it("rejects invalid font family", () => {
    expect(() =>
      StyleSheetSchema.parse({ fontFamily: "Comic Sans" })
    ).toThrow();
  });
});
