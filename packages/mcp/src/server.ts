import { catalog, pendingFontsMeta, projectTools, readOnce, toolInputSchema } from "@airdesign/catalog"
import { McpServer } from "@modelcontextprotocol/server"

import { type Admission, admit } from "./admit.js"
import { limited, refused, type ToolResult } from "./answer.js"
import { callTool, knownTool, type Session } from "./call-tool.js"
import type { DeckHost } from "./deck-host.js"
import { kindInstructions } from "./instructions.js"
import { skillTools } from "./skill-tools.js"

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

function mcpResult(result: ToolResult) {
  const content = result.content.map((block) =>
    block.type === "text" ? { type: "text" as const, text: block.text } : block,
  )
  return result.ok
    ? { content, structuredContent: result.answer }
    : { content, isError: true as const, structuredContent: result.answer }
}

type RegisteredTool = {
  readonly name: string
  readonly description: string
  readonly inputSchema: Readonly<Record<string, unknown>>
  readonly annotations: {
    readonly readOnlyHint: boolean
    readonly destructiveHint: boolean
    readonly idempotentHint: boolean
    readonly openWorldHint: boolean
  }
}

function listedTools(): readonly RegisteredTool[] {
  const fromCatalog: RegisteredTool[] = projectTools(catalog).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: toolInputSchema(tool.op),
    annotations: {
      readOnlyHint: tool.readOnlyHint,
      destructiveHint: tool.destructiveHint,
      idempotentHint: tool.idempotentHint,
      openWorldHint: tool.openWorldHint,
    },
  }))
  return [...fromCatalog, ...skillTools].sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  )
}

export type Host = DeckHost & { readonly admit?: (session: Session) => Promise<Admission> }

export function createServer(session: Session, host: Host): McpServer {
  const server = new McpServer({ name: "airdesign", version: "0.0.0" }, { instructions: kindInstructions() })
  for (const tool of listedTools()) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: inputSchema(tool.inputSchema),
        annotations: tool.annotations,
      },
      async (args, ctx) => {
        const named = readOnce(ctx.mcpReq._meta)
        if (!named.ok || !knownTool(tool.name)) return mcpResult(refused("field"))
        session.once = named.once
        let admitted: Admission
        try {
          admitted = host.admit ? await host.admit(session) : admit(session.log, "tool", session.now)
        } catch {
          return mcpResult(refused("store"))
        }
        if (!admitted.ok) return mcpResult(limited(admitted.text))
        session.log = admitted.log
        const claimed = ctx.mcpReq._meta?.[pendingFontsMeta]
        const pendingFonts = new Set<string>(
          Array.isArray(claimed)
            ? claimed.filter((name): name is string => typeof name === "string").map((name) => name.toLowerCase())
            : [],
        )
        return mcpResult(await callTool(tool.name, args, session, host, pendingFonts))
      },
    )
  }
  return server
}
