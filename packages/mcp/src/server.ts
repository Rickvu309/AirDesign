import { catalog, projectTools, readOnce, toolInputSchema } from "@airdesign/catalog"
import { McpServer } from "@modelcontextprotocol/server"

import { type Admission, admit } from "./admit.js"
import { refused, type ToolResult } from "./answer.js"
import { callTool, opOf, type Session } from "./call-tool.js"
import type { DeckHost } from "./deck-host.js"
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

function mcpResult(result: ToolResult) {
  const content = result.content.map((block) => ({ type: "text" as const, text: block.text }))
  return result.ok
    ? { content, structuredContent: result.answer }
    : { content, isError: true as const, structuredContent: result.answer }
}

export type Host = DeckHost & { readonly admit?: (session: Session) => Promise<Admission> }

export function createServer(session: Session, host: Host): McpServer {
  const server = new McpServer({ name: "airdesign", version: "0.0.0" }, { instructions: kindInstructions() })
  for (const tool of projectTools(catalog)) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: inputSchema(toolInputSchema(tool.op)),
        annotations: {
          readOnlyHint: tool.readOnlyHint,
          destructiveHint: tool.destructiveHint,
          idempotentHint: tool.idempotentHint,
          openWorldHint: tool.openWorldHint,
        },
      },
      async (args, ctx) => {
        const named = readOnce(ctx.mcpReq._meta)
        if (!named.ok || opOf(tool.name) === undefined) return mcpResult(refused("field"))
        session.once = named.once
        let admitted: Admission
        try {
          admitted = host.admit ? await host.admit(session) : admit(session.log, "tool", session.now)
        } catch {
          return mcpResult(refused("store"))
        }
        if (!admitted.ok) return mcpResult({ ok: false, content: [{ type: "text", text: admitted.text }], answer: {} })
        session.log = admitted.log
        return mcpResult(await callTool(tool.name, args, session, host))
      },
    )
  }
  return server
}
