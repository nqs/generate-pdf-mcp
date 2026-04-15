import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PDFLayoutEngine } from "./pdf/engine";
import { renderElement } from "./pdf/elements";
import { ContentElementSchema, ThemeNameSchema, PageSizeSchema } from "./pdf/schemas";
import { uploadPdf, shouldReturnInline, toBase64 } from "./storage/r2";
import type { ContentElement } from "./pdf/types";

export interface Env {
  PDF_BUCKET: R2Bucket;
  PDF_MCP: DurableObjectNamespace;
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
          theme: ThemeNameSchema.optional()
            .default("professional")
            .describe("Visual theme"),
          pageSize: PageSizeSchema.optional()
            .default("A4")
            .describe("Page size"),
          content: z
            .string()
            .describe(
              "JSON string of content elements array. Each element has a 'type' field (title, h1, h2, h3, paragraph, image, image_url, list, table, page_break, blockquote, divider) and type-specific fields."
            ),
        },
      },
      async ({ filename, theme, pageSize, content }) => {
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

          // Create engine and render
          const engine = new PDFLayoutEngine({ pageSize, theme });
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
            { baseUrl: "" }
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

    this.server.registerTool(
      "list_themes",
      {
        description: "List available PDF themes with their descriptions",
        inputSchema: {},
      },
      async () => ({
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              themes: [
                {
                  name: "professional",
                  description:
                    "Clean Helvetica design with blue accents. Best for business reports and proposals.",
                },
                {
                  name: "minimal",
                  description:
                    "Compact layout with muted colors. Best for simple documents and notes.",
                },
                {
                  name: "academic",
                  description:
                    "Times Roman font with generous margins. Best for research papers and essays.",
                },
              ],
            }),
          },
        ],
      })
    );
  }
}

