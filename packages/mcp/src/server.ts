import { catalog, projectTools, toolInputSchema } from "@airdesign/catalog"
import { McpServer } from "@modelcontextprotocol/server"
import { admit } from "./admit.js"
import { agentOps, callTool, type Session, type ToolResult } from "./call-tool.js"
import type { EditCode } from "./edit-next.js"
import { settleTurn } from "./turn.js"

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
  const body = result.ok && result.reported !== undefined ? result.reported : result.answer
  const structured = body === undefined ? {} : { structuredContent: body }
  if (result.ok) return { content, ...structured }
  return { content, isError: true as const, ...structured }
}

export type Host = {
  prepare?: (
    name: string,
    raw: unknown,
    session: Session,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly refusal: EditCode }>
  commit?: (result: ToolResult, session: Session) => Promise<ToolResult>
}

export function createServer(session: Session, host?: Host): McpServer {
  const server = new McpServer({ name: "airdesign", version: "0.0.0" })
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
      async (args) => {
        const admitted = admit(session.log, "tool", session.now)
        if (!admitted.ok) {
          const refusal: ToolResult = {
            ok: false,
            refusal: admitted.text,
            deck: session.deck,
            content: [{ type: "text", text: admitted.text }],
          }
          return mcpResult(refusal)
        }
        session.log = admitted.log
        if (host?.prepare) {
          const prepared = await host.prepare(tool.name, args, session)
          if (!prepared.ok) {
            return mcpResult(agentOps[tool.op].refuse(session.deck, prepared.refusal))
          }
        }
        const result = callTool(tool.name, args, session)
        const settled = host?.commit ? await host.commit(result, session) : result
        if (settled.ok) session.deck = settled.deck
        settleTurn(tool.op, settled, session)
        return mcpResult(settled)
      },
    )
  }
  return server
}
