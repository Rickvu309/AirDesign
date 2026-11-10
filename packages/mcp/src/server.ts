import { catalog, projectTools } from "@airdesign/catalog"
import { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod/v4"
import { admit } from "./admit.js"
import { callTool, type Session, type ToolResult } from "./call-tool.js"

const editInput = z.looseObject({
  deck: z.string().describe("Deck id."),
  base: z.number().describe("Revision the edit was read from."),
  changes: z
    .array(
      z.looseObject({
        value: z.string().describe("Text to write."),
        node: z.string().optional().describe("Named node, a or b."),
      }),
    )
    .describe("Edits to land."),
})

const captureInput = z.looseObject({
  deck: z.string().describe("Deck id."),
})

function inputSchema(op: string) {
  if (op === "edit_deck") return editInput
  if (op === "capture_slide") return captureInput
  return z.looseObject({})
}

function mcpResult(result: ToolResult) {
  const content = result.content.map((block) => ({ type: "text" as const, text: block.text }))
  if (result.ok) return { content }
  return { content, isError: true as const }
}

export function createServer(session: Session): McpServer {
  const server = new McpServer({ name: "airdesign", version: "0.0.0" })
  for (const tool of projectTools(catalog)) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: inputSchema(tool.op),
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
        const result = callTool(tool.name, args, session)
        if (result.ok) session.deck = result.deck
        return mcpResult(result)
      },
    )
  }
  return server
}
