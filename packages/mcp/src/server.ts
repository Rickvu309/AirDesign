import { catalog, projectTools, readOnce, toolInputSchema, type AgentOp } from "@airdesign/catalog"
import { McpServer } from "@modelcontextprotocol/server"
import { admit, refund, type Admission } from "./admit.js"
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
  admit?: (session: Session) => Promise<Admission>
  prepare?: (name: string, raw: unknown, session: Session) => Promise<Prepared>
  commit?: (result: ToolResult, session: Session) => Promise<ToolResult | Lost>
  refund?: (session: Session) => Promise<void>
  turnSaved?: () => Promise<void>
}

export type Lost = { readonly lost: ToolResult }

export type Prepared =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: EditCode }
  | { readonly answered: ToolResult }

export const commitTries = 3

async function settledCall(
  tool: { readonly name: string; readonly op: AgentOp },
  args: unknown,
  session: Session,
  host: Host | undefined,
): Promise<ToolResult> {
  for (let tried = 1; ; tried += 1) {
    if (host?.prepare) {
      const prepared = await host.prepare(tool.name, args, session)
      if ("answered" in prepared) return prepared.answered
      if (!prepared.ok) return agentOps[tool.op].refuse(session.deck, prepared.refusal)
    }
    const result = callTool(tool.name, args, session)
    const committed = host?.commit ? await host.commit(result, session) : result
    if (!("lost" in committed)) return committed
    if (tried === commitTries) return committed.lost
  }
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
      async (args, ctx) => {
        const named = readOnce(ctx.mcpReq._meta)
        if (!named.ok) return mcpResult(agentOps[tool.op].refuse(session.deck, "field"))
        session.once = named.once
        let admitted: Admission
        try {
          admitted = host?.admit ? await host.admit(session) : admit(session.log, "tool", session.now)
        } catch {
          return mcpResult(agentOps[tool.op].refuse(session.deck, "store"))
        }
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
        const settled = await settledCall(tool, args, session, host)
        if (settled.ok) session.deck = settled.deck
        else if (settled.refusal === "indexing") {
          if (host?.refund) await host.refund(session)
          else session.log = refund(session.log, "tool")
        }
        settleTurn(tool.op, settled, session)
        if (host?.turnSaved) await host.turnSaved()
        return mcpResult(settled)
      },
    )
  }
  return server
}
