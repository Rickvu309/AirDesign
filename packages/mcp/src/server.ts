import { catalog, projectTools } from "@airdesign/catalog"
import { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod/v4"
import { admit } from "./admit.js"
import { callTool, type Session, type ToolResult } from "./call-tool.js"
import { editRefusal, runRefusal } from "./edit-answer.js"
import { editSentence, type EditCode } from "./edit-next.js"
import { settleTurn } from "./turn.js"

const editInput = z.looseObject({
  deck: z.string().describe("Deck id."),
  base: z.number().describe("Revision the edit was read from."),
  changes: z
    .array(
      z.looseObject({
        value: z
          .string()
          .describe(
            "Text to write. For an element whose file text is a JSON text value, send a JSON text value: [{from, runs: [{from, text}]}]. Each from is an index the file has, and a run from of -1 is a new run.",
          ),
        node: z.string().describe("Element id, <slide>.<shape>, such as 258.7."),
        readAt: z
          .number()
          .describe(
            "Version of that element from your last read. Every answer carries each named element's value and version. 0 for an element nobody has changed.",
          ),
      }),
    )
    .describe("Edits to land."),
})

const captureInput = z.looseObject({
  deck: z.string().describe("Deck id."),
})

const runInput = z.looseObject({
  deck: z.string().describe("Deck id."),
  runId: z.string().describe("The runId your edit answers carried."),
})

function endsRun(op: string): boolean {
  return op === "stop_run" || op === "undo_run"
}

function inputSchema(op: string) {
  if (op === "edit_deck") return editInput
  if (endsRun(op)) return runInput
  if (op === "capture_slide") return captureInput
  return z.looseObject({})
}

function mcpResult(result: ToolResult) {
  const content = result.content.map((block) => ({ type: "text" as const, text: block.text }))
  const structured = result.answer === undefined ? {} : { structuredContent: result.answer }
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
        if (host?.prepare) {
          const prepared = await host.prepare(tool.name, args, session)
          if (!prepared.ok) {
            if (tool.op === "edit_deck") return mcpResult(editRefusal(session.deck, prepared.refusal, []))
            if (endsRun(tool.op)) return mcpResult(runRefusal(session.deck, prepared.refusal))
            return mcpResult({
              ok: false,
              refusal: prepared.refusal,
              deck: session.deck,
              content: [{ type: "text", text: editSentence(prepared.refusal) }],
            })
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
