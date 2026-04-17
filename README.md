# PDF Generation MCP Server

MCP server on Cloudflare Workers that generates PDF documents from structured JSON content. Built with [pdf-lib](https://pdf-lib.js.org/), the [Model Context Protocol](https://modelcontextprotocol.io/), and deployed on [Cloudflare Workers](https://workers.cloudflare.com/).

## Features

- **12 content element types** — title, h1–h3, paragraph, image, image\_url, list, table, page\_break, blockquote, divider, markdown
- **Fully customizable style sheets** — override fonts, sizes, colors, margins, and line height
- **3 page sizes** — A4, Letter, Legal
- **Image support** — base64 image embedding and remote URL image fetching
- **R2 storage** — generated PDFs stored in Cloudflare R2 with signed download URLs
- **Edge deployment** — runs on Cloudflare Workers globally

## Quick Start

### Prerequisites

- Node.js 22+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

### Setup

```bash
git clone <repo-url>
cd pdf-mcp-worker
npm install
npx wrangler r2 bucket create pdf-mcp-storage
npm run dev
```

The MCP server is available at `http://localhost:8787/mcp`.

## MCP Tools

### `generate_pdf`

Generate a PDF document from structured content. Returns a download URL.

| Parameter  | Type   | Required | Default | Description                                    |
|------------|--------|----------|---------|------------------------------------------------|
| `filename` | string | yes      | —       | Output filename (e.g. `"report.pdf"`)          |
| `style`    | string | no       | —       | JSON string of style overrides (see below)     |
| `pageSize` | string | no       | `"A4"` | `"A4"`, `"Letter"`, or `"Legal"`               |
| `content`  | string | yes      | —       | JSON string of content elements array          |

#### Style Overrides

All fields are optional — omitted fields use professional defaults.

```json
{
  "fontFamily": "Helvetica",
  "fontSize": { "title": 28, "h1": 22, "h2": 18, "h3": 15, "body": 11 },
  "colors": { "title": "#1a1a2e", "heading": "#1a1a2e", "body": "#333333", "accent": "#2563eb" },
  "margins": { "top": 60, "right": 60, "bottom": 60, "left": 60 },
  "lineHeight": 1.4
}
```

- `fontFamily` — `"Helvetica"`, `"TimesRoman"`, or `"Courier"`
- `colors` — hex color strings (e.g. `"#2563eb"`)

## Content Elements Reference

The `content` parameter accepts a JSON array of elements. Each element has a `type` field and type-specific properties.

### Text Elements

```json
{ "type": "title", "text": "Document Title" }
```

```json
{ "type": "h1", "text": "Section Heading" }
{ "type": "h2", "text": "Subsection Heading" }
{ "type": "h3", "text": "Sub-subsection Heading" }
```

```json
{ "type": "paragraph", "text": "Body text content goes here." }
```

```json
{ "type": "blockquote", "text": "Quoted text rendered with an accent bar." }
```

### Images

**Base64 image:**

```json
{
  "type": "image",
  "data": "<base64-encoded-data>",
  "format": "png",
  "caption": "Optional caption",
  "width": 0.5
}
```

- `format` — `"png"` (default) or `"jpg"`
- `caption` — optional text below the image
- `width` — display width as a ratio of page width (0–1, e.g. `0.5` = 50%)

**Remote URL image:**

```json
{
  "type": "image_url",
  "url": "https://example.com/image.png",
  "caption": "Optional caption",
  "width": 0.5
}
```

### Lists

```json
{
  "type": "list",
  "style": "bullet",
  "items": ["First item", "Second item", "Third item"]
}
```

`style` — `"bullet"` or `"numbered"`

### Tables

```json
{
  "type": "table",
  "headers": ["Name", "Role", "Status"],
  "rows": [
    ["Alice", "Engineer", "Active"],
    ["Bob", "Designer", "On Leave"]
  ]
}
```

### Markdown

Accepts raw Markdown text and renders it using the existing element types (headings, paragraphs, lists, blockquotes, dividers, tables). Inline formatting (bold, italic, code, links) is stripped to plain text.

```json
{ "type": "markdown", "text": "# Introduction\n\nThis is a **paragraph**.\n\n- Item one\n- Item two\n\n> A blockquote\n\n---" }
```

### Layout

```json
{ "type": "page_break" }
```

```json
{ "type": "divider" }
```

## Example — Full Tool Call

### Input

```json
{
  "filename": "quarterly-report.pdf",
  "pageSize": "A4",
  "content": "[{\"type\":\"title\",\"text\":\"Q1 2026 Report\"},{\"type\":\"paragraph\",\"text\":\"This report summarizes key metrics and milestones from the first quarter.\"},{\"type\":\"h1\",\"text\":\"Highlights\"},{\"type\":\"list\",\"style\":\"bullet\",\"items\":[\"Revenue up 15% quarter-over-quarter\",\"Launched 3 new product features\",\"Customer satisfaction score: 4.8/5\"]},{\"type\":\"h1\",\"text\":\"Team Overview\"},{\"type\":\"table\",\"headers\":[\"Department\",\"Headcount\",\"Budget\"],\"rows\":[[\"Engineering\",\"42\",\"$2.1M\"],[\"Design\",\"12\",\"$600K\"],[\"Marketing\",\"18\",\"$1.2M\"]]},{\"type\":\"page_break\"},{\"type\":\"h1\",\"text\":\"Next Steps\"},{\"type\":\"paragraph\",\"text\":\"Focus areas for Q2 include international expansion and platform reliability improvements.\"}]"
}
```

### Response

```json
{
  "success": true,
  "filename": "quarterly-report.pdf",
  "download_url": "https://your-worker.workers.dev/download/quarterly-report.pdf",
  "expires_in": 3600,
  "size_bytes": 24530,
  "pages": 2
}
```

## Connecting to MCP Clients

### Claude Desktop

Add to your Claude Desktop MCP configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pdf-generator": {
      "url": "http://localhost:8787/mcp"
    }
  }
}
```

### LibreChat

Add the MCP server URL (`http://localhost:8787/mcp`) as an MCP tool server in your LibreChat configuration.

### Other MCP Clients

Any MCP client that supports Streamable HTTP transport can connect to the `/mcp` endpoint.

## Deployment

### Manual Deploy

```bash
npm run deploy
```

### Production Setup

1. Deploy the Worker with `npm run deploy` or push to `main` for CI/CD
2. Create the R2 bucket in production:
   ```bash
   npx wrangler r2 bucket create pdf-mcp-storage
   ```
3. Set `WORKER_URL` to your production Worker URL in the Cloudflare dashboard (Settings → Variables)

### CI/CD

GitHub Actions auto-deploys on push to `main`. Add these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Development

```bash
npm run dev          # Local dev server (http://localhost:8787)
npm test             # Run tests (vitest)
npx tsc --noEmit     # Type check
```

### Project Structure

```
├── .github/
│   └── workflows/
│       └── deploy.yml      # CI/CD — deploy on push to main
├── src/
│   ├── index.ts            # Worker entry point, routes MCP and download requests
│   ├── mcp-server.ts       # MCP tool definitions (generate_pdf)
│   ├── pdf/
│   │   ├── elements.ts     # Content element renderers
│   │   ├── engine.ts       # PDF layout engine (page management, text wrapping)
│   │   ├── schemas.ts      # Zod validation schemas for content elements
│   │   ├── themes.ts       # Default style and style resolution
│   │   └── types.ts        # TypeScript type definitions
│   ├── storage/
│   │   └── r2.ts           # R2 upload/download helpers
│   └── utils/
│       ├── images.ts       # Image loading and embedding
│       └── text.ts         # Text measurement and wrapping
├── tests/
│   ├── elements.test.ts
│   ├── engine.test.ts
│   ├── schemas.test.ts
│   └── storage.test.ts
├── wrangler.jsonc           # Cloudflare Workers configuration
├── tsconfig.json
└── package.json
```

## Architecture

The server runs on **Cloudflare Workers** using the **Agents SDK** (`McpAgent`) to handle MCP protocol sessions via Streamable HTTP transport. Each session is backed by a **Durable Object** for state management. PDF documents are rendered with **pdf-lib** and stored in **Cloudflare R2**, with time-limited download URLs returned to the client.

## License

ISC
