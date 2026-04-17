import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PDFLayoutEngine } from "./pdf/engine";
import { renderElement } from "./pdf/elements";
import { ContentElementSchema, StyleSheetSchema, PageSizeSchema } from "./pdf/schemas";
import { uploadPdf, shouldReturnInline, toBase64 } from "./storage/r2";
import type { ContentElement } from "./pdf/types";

export interface Env {
  PDF_BUCKET: R2Bucket;
  MCP_OBJECT: DurableObjectNamespace;
  WORKER_URL: string;
}

export interface PDFMcpState {
  documentsGenerated: number;
}

export class PDFMcpAgent extends McpAgent<Env, PDFMcpState> {
  server = new McpServer({
    name: "pdf-mcp-server",
    version: "1.0.0",
  });

  initialState: PDFMcpState = {
    documentsGenerated: 0,
  };

  async init(): Promise<void> {
    this.server.registerTool(
      "generate_pdf",
      {
        description:
          "Generate a professional PDF document from structured content. Returns a download URL.",
        inputSchema: {
          filename: z
            .string()
            .min(1)
            .describe("Output filename (e.g. 'report.pdf')"),
          style: z
            .string()
            .optional()
            .describe(
              "Optional JSON string of style overrides. Fields: fontFamily, fontSize (title/h1/h2/h3/body), colors (title/heading/body/accent as hex), margins (top/right/bottom/left), lineHeight. All fields optional — omitted fields use professional defaults."
            ),
          pageSize: PageSizeSchema.optional()
            .default("A4")
            .describe("Page size"),
          content: z
            .string()
            .describe(
              "JSON string of content elements array. Each element has a 'type' field (title, h1, h2, h3, paragraph, image, image_url, list, table, page_break, blockquote, divider, markdown) and type-specific fields."
            ),
        },
      },
      async ({ filename, style, pageSize, content }) => {
        try {
          // Parse and validate content elements
          let parsedContent: unknown;
          try {
            parsedContent = JSON.parse(content);
          } catch {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    success: false,
                    error: "Invalid JSON in content field",
                  }),
                },
              ],
            };
          }

          if (!Array.isArray(parsedContent)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    success: false,
                    error: "Content must be a JSON array of elements",
                  }),
                },
              ],
            };
          }

          if (parsedContent.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    success: false,
                    error: "Content array must not be empty",
                  }),
                },
              ],
            };
          }

          const elements: ContentElement[] = [];
          for (let i = 0; i < parsedContent.length; i++) {
            const result = ContentElementSchema.safeParse(parsedContent[i]);
            if (!result.success) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify({
                      success: false,
                      error: `Invalid content element at index ${i}: ${result.error.message}`,
                    }),
                  },
                ],
              };
            }
            elements.push(result.data as ContentElement);
          }

          // Parse and validate style overrides
          let parsedStyle;
          if (style) {
            try {
              parsedStyle = StyleSheetSchema.parse(JSON.parse(style));
            } catch {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify({
                      success: false,
                      error: "Invalid style JSON or style validation failed",
                    }),
                  },
                ],
              };
            }
          }

          // Create engine and render
          const engine = new PDFLayoutEngine({ pageSize, style: parsedStyle });
          await engine.initialize();

          for (const element of elements) {
            await renderElement(engine, element);
          }

          const pdfBytes = await engine.save();

          // Upload to R2
          const uploadResult = await uploadPdf(
            this.env.PDF_BUCKET,
            filename,
            pdfBytes,
            { baseUrl: this.env.WORKER_URL }
          );

          // Build response
          const result: Record<string, unknown> = {
            success: true,
            filename,
            download_url: uploadResult.downloadUrl,
            expires_in: uploadResult.expiresIn,
            size_bytes: pdfBytes.byteLength,
            pages: engine.getPageCount(),
          };

          if (shouldReturnInline(pdfBytes.byteLength)) {
            result.base64 = toBase64(pdfBytes);
          }

          // Track usage
          this.setState({
            ...this.state,
            documentsGenerated: this.state.documentsGenerated + 1,
          });

          return {
            content: [
              { type: "text" as const, text: JSON.stringify(result) },
            ],
          };
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown error occurred";
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ success: false, error: message }),
              },
            ],
          };
        }
      }
    );


  }
}

