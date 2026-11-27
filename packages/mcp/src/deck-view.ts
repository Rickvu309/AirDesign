import { viewTools } from "@airdesign/catalog"
import type { McpServer } from "@modelcontextprotocol/server"

export type ViewHost = {
  readonly origin: string
  readonly open: (body: unknown) => Promise<unknown>
  readonly since: (body: unknown, signal: AbortSignal) => Promise<unknown>
  readonly screenshots: (body: unknown) => Promise<unknown>
  readonly media: (body: unknown) => Promise<unknown>
}

export const deckViewUri = "ui://airdesign/deck.html"

export const viewMimeType = "text/html;profile=mcp-app"

export const appsExtension = "io.modelcontextprotocol/ui"

export const shownInView = { ui: { resourceUri: deckViewUri }, "ui/resourceUri": deckViewUri } as const

const anyBody = {
  "~standard": {
    version: 1 as const,
    vendor: "airdesign",
    validate: (value: unknown) => ({ value }),
    jsonSchema: { input: () => ({ type: "object" }), output: () => ({ type: "object" }) },
  },
}

export const shellFailed = "AirDesign couldn't load this deck. Try again in a moment."

const loader = `const origin = document.documentElement.dataset.origin
try {
  const answer = await fetch(new URL("/deck-view", origin))
  if (!answer.ok) throw new Error(answer.statusText)
  const page = new DOMParser().parseFromString(await answer.text(), "text/html")
  for (const tag of page.head.querySelectorAll('link[rel="stylesheet"], link[rel="modulepreload"], script[type="module"][src]')) {
    const copy = document.createElement(tag.localName)
    for (const { name, value } of tag.attributes)
      copy.setAttribute(name, name === "src" || name === "href" ? new URL(value, origin).href : value)
    document.head.append(copy)
  }
} catch {
  document.body.style.margin = "0"
  const root = document.getElementById("root")
  root.style.cssText = "display: flex; box-sizing: border-box; min-height: 100dvh; align-items: center; justify-content: center; padding: 0 24px; color: CanvasText; font: 14px/20px system-ui, sans-serif"
  root.textContent = ${JSON.stringify(shellFailed)}
}`

const attribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")

export function deckViewShell(origin: string): string {
  return `<!doctype html>
<html lang="en" data-mcp-app data-origin="${attribute(origin)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AirDesign</title>
    <script type="module">
${loader}
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`
}

const answered = (answer: unknown) => ({
  content: [],
  structuredContent: typeof answer === "object" && answer !== null ? (answer as Record<string, unknown>) : {},
})

export function deckView(host: ViewHost) {
  const domains = [host.origin]
  return {
    attach(server: McpServer): void {
      server.server.registerCapabilities({ extensions: { [appsExtension]: { mimeTypes: [viewMimeType] } } })
      server.registerResource("deck", deckViewUri, { title: "AirDesign deck", mimeType: viewMimeType }, async () => ({
        contents: [
          {
            uri: deckViewUri,
            mimeType: viewMimeType,
            text: deckViewShell(host.origin),
            _meta: {
              ui: {
                csp: { connectDomains: domains, resourceDomains: domains },
                prefersBorder: true,
              },
            },
          },
        ],
      }))
      const appOnly = { ui: { resourceUri: deckViewUri, visibility: ["app"] } }
      const tools = {
        [viewTools.open]: { description: "Read the deck the view shows.", answer: (body: unknown) => host.open(body) },
        [viewTools.since]: {
          description: "Wait for the deck's next edits and hold its painter lease.",
          answer: (body: unknown, signal: AbortSignal) => host.since(body, signal),
        },
        [viewTools.screenshots]: {
          description: "Deliver the view's slide screenshots.",
          answer: (body: unknown) => host.screenshots(body),
        },
        [viewTools.media]: {
          description: "Read an image the deck holds.",
          answer: (body: unknown) => host.media(body),
        },
      }
      for (const [name, tool] of Object.entries(tools))
        server.registerTool(
          name,
          { description: tool.description, inputSchema: anyBody, _meta: appOnly },
          async (body, ctx) => answered(await tool.answer(body, ctx.mcpReq.signal)),
        )
    },
  }
}
