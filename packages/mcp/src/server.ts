import { catalog, pendingFontsMeta, projectTools, readOnce, toolInputSchema } from "@airdesign/catalog"
import { McpServer } from "@modelcontextprotocol/server"

import { callTool, type DeckHost, instructions, refused, type Session } from "@airdesign/agent"

import { deckView, shownInView, type ViewHost } from "./deck-view.js"
import { encode } from "./encode.js"
import { skills } from "./skill-source.js"

export type Origins = { readonly app: string; readonly site: string }

export function serverInfo({ app, site }: Origins) {
  return {
    name: "app.airdesign/studio",
    title: "AirDesign",
    version: "0.0.0",
    description: "Make and edit slide decks without doing the design work.",
    websiteUrl: site,
    icons: [
      { src: new URL("/favicon-art.svg", app).href, mimeType: "image/svg+xml", sizes: ["any"] },
      { src: new URL("/apple-touch-icon.png", app).href, mimeType: "image/png", sizes: ["180x180"] },
    ],
  }
}

function inputSchema(json: Readonly<Record<string, unknown>>) {
  return {
    "~standard": {
      version: 1 as const,
      vendor: "airdesign",
      validate: (value: unknown) => ({ value }),
      jsonSchema: { input: () => json, output: () => json },
    },
  }
}

type RegisteredTool = {
  readonly name: string
  readonly title: string
  readonly description: string
  readonly inputSchema: Readonly<Record<string, unknown>>
  readonly annotations: {
    readonly readOnlyHint: boolean
    readonly destructiveHint: boolean
    readonly idempotentHint: boolean
    readonly openWorldHint: boolean
  }
  readonly view: boolean
}

function listedTools(): readonly RegisteredTool[] {
  return projectTools(catalog).map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: toolInputSchema(tool.op),
    annotations: {
      readOnlyHint: tool.readOnlyHint,
      destructiveHint: tool.destructiveHint,
      idempotentHint: tool.idempotentHint,
      openWorldHint: tool.openWorldHint,
    },
    view: tool.view,
  }))
}

export function createServer(session: Session, host: DeckHost, origins: Origins, view?: ViewHost): McpServer {
  const server = new McpServer(serverInfo(origins), { instructions })
  for (const tool of listedTools()) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: inputSchema(tool.inputSchema),
        annotations: tool.annotations,
        ...(view !== undefined && tool.view ? { _meta: shownInView } : {}),
      },
      async (args, ctx) => {
        const named = readOnce(ctx.mcpReq._meta)
        if (!named.ok) return encode(refused("field"))
        session.once = named.once
        const claimed = ctx.mcpReq._meta?.[pendingFontsMeta]
        const pendingFonts = new Set<string>(
          Array.isArray(claimed)
            ? claimed.filter((name): name is string => typeof name === "string").map((name) => name.toLowerCase())
            : [],
        )
        return encode(await callTool(tool.name, args, session, host, pendingFonts))
      },
    )
  }
  for (const extension of view === undefined ? [skills] : [skills, deckView(view, origins.app)])
    extension.attach(server)
  return server
}
