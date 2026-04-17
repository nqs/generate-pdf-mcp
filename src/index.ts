// Worker entry point — routes MCP and download requests
export { PDFMcpAgent } from "./mcp-server";
import { PDFMcpAgent } from "./mcp-server";
import { handleDownload } from "./storage/r2";
import type { Env } from "./mcp-server";

const mcpHandler = PDFMcpAgent.serve("/mcp");

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    console.log(`[${request.method}] ${url.pathname}`);

    try {
      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.pathname === "/") {
        return new Response(
          JSON.stringify({ service: "pdf-mcp-server", version: "1.0.0", mcp_endpoint: "/mcp" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.pathname.startsWith("/download/")) {
        const key = decodeURIComponent(url.pathname.slice("/download/".length));
        if (!key) {
          return new Response("Missing key", { status: 400 });
        }
        return handleDownload(env.PDF_BUCKET, key);
      }

      // Fall through to MCP agent handler
      return mcpHandler.fetch(request, env, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.log(`[ERROR] ${request.method} ${url.pathname}: ${message}`);
      return new Response(
        JSON.stringify({ error: "Internal server error", message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};

