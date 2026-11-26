import { expect, it } from "vitest"
import { airaLine, bodyLines, toolOutcome } from "./aira-wire"

function chunked(parts: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part)
      controller.close()
    },
  })
}

it("reads each line of the answer even when a chunk splits a line or a character", async () => {
  const bytes = new TextEncoder().encode('{"type":"text","text":"café"}\n\n{"type":"text","text":"b"}')
  const cut = bytes.indexOf(0xc3) + 1
  const lines: string[] = []
  for await (const line of bodyLines(chunked([bytes.slice(0, 5), bytes.slice(5, cut), bytes.slice(cut)])))
    lines.push(line)
  expect(lines).toEqual(['{"type":"text","text":"café"}', '{"type":"text","text":"b"}'])
})

it("reads only the lines the server sends and skips the rest", () => {
  expect(airaLine('{"type":"tool","id":"call_1","name":"airdesign_execute","input":{}}')).toEqual({
    type: "tool",
    id: "call_1",
    name: "airdesign_execute",
  })
  expect(airaLine('{"type":"end","ok":true,"stop":"end_turn","content":[],"usage":{"used":1}}')).toBeUndefined()
  expect(airaLine("not json")).toBeUndefined()
})

it("reads a tool answer sent as an event stream, as JSON, or as a JSON-RPC error", () => {
  const result = {
    content: [{ type: "text", text: "Landed revision 2." }],
    structuredContent: { ok: true, runId: "r" },
  }
  const event = `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: 1, result })}\n\n`
  expect(toolOutcome(event)).toEqual({ ok: true, text: "Landed revision 2.", fields: { ok: true, runId: "r" } })
  expect(toolOutcome(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ...result, isError: true } })).ok).toBe(false)
  expect(
    toolOutcome(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Unknown tool" } })),
  ).toEqual({
    ok: false,
    text: "Unknown tool",
    fields: undefined,
  })
  expect(toolOutcome("").ok).toBe(false)
})
