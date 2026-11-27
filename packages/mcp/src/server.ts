import { catalog, pendingFontsMeta, projectTools, readOnce, toolInputSchema } from "@airdesign/catalog"
import { McpServer } from "@modelcontextprotocol/server"

import { type Admission, admit } from "./admit.js"
import { limited, refused } from "./answer.js"
import { callTool, knownTool, type Session } from "./call-tool.js"
import type { DeckHost } from "./deck-host.js"
import { encode } from "./encode.js"
import { kindInstructions } from "./instructions.js"

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
  return projectTools(catalog).map((tool) => ({
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
        if (!named.ok || !knownTool(tool.name)) return encode(refused("field"))
        session.once = named.once
        let admitted: Admission
        try {
          admitted = host.admit ? await host.admit(session) : admit(session.log, "tool", session.now)
        } catch {
          return encode(refused("store"))
        }
        if (!admitted.ok) return encode(limited(admitted.text))
        session.log = admitted.log
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
  return server
}
