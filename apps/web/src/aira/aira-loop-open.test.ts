import { airaRoutes, catalog, mcpRoutes, projectTools } from "@airdesign/catalog"
import { describe, expect, it } from "vitest"
import { airaChat, askAira } from "./aira-loop"

const deck = "deck"
const addSlide = projectTools(catalog).find((tool) => tool.op === "execute")?.name ?? ""
const usage = { used: 0.5, allowed: 2, resets: "2026-11-16T00:00:00.000Z" }
const add = {
  type: "tool_use",
  id: "call_1",
  name: addSlide,
  input: { deck, base: 0, changes: [{ op: "add_slide", after: "256", layout: "256" }] },
}
const landed = { structuredContent: { ok: true, revision: 1, runId: "run-1", slides: ["257"] } }

function lines(content: readonly unknown[]) {
  const stopReason = content.some((block) => (block as { type: string }).type === "tool_use") ? "tool_use" : "end_turn"
  return [{ type: "end", ok: true, stop: stopReason, content, usage }]
}

function link(answers: readonly object[]) {
  const turns = [lines([add]), lines([{ type: "text", text: "Done" }])]
  const replies = [...answers]
  const sent: string[] = []
  const send: typeof fetch = async (input, init) => {
    const path = String(input)
    const body = JSON.parse(String(init?.body)) as { id: number; params?: { name: string } }
    if (path === airaRoutes.turn.path) {
      const next = turns.shift() ?? []
      const text = next.map((line) => JSON.stringify(line)).join("\n")
      return new Response(`${text}\n`, { status: 200 })
    }
    if (path === mcpRoutes.mcp.path) {
      sent.push(body.params?.name ?? "")
      const reply = body.params?.name === addSlide ? (replies.shift() ?? {}) : { structuredContent: { ok: true } }
      const answer = reply as { text?: string; structuredContent?: unknown }
      const text = answer.text ?? JSON.stringify(answer.structuredContent ?? {})
      const result = { content: [{ type: "text", text }], ...reply }
      return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: body.id, result })}\n\n`)
    }
    return new Response(JSON.stringify({ ok: true }))
  }
  return { send, sent }
}

describe("Aira's loop before the server's first open of the deck", () => {
  it("holds the first call until the open lands, then sends it once", async () => {
    let land: () => void = () => undefined
    const opened = new Promise<void>((resolve) => {
      land = resolve
    })
    const held = link([landed])
    const asking = askAira(airaChat(deck), "Add a slide", {
      signal: new AbortController().signal,
      fetch: held.send,
      show: () => undefined,
      opened,
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(held.sent).toEqual([])
    land()
    const done = await asking
    expect(held.sent.filter((name) => name === addSlide)).toHaveLength(1)
    expect(done.exchanges[0]?.steps.find((step) => step.kind === "tool")).toMatchObject({ state: "done" })
  })

  it("sends the call when the open fails, so the call meets the server's own refusal", async () => {
    const held = link([landed])
    await askAira(airaChat(deck), "Add a slide", {
      signal: new AbortController().signal,
      fetch: held.send,
      show: () => undefined,
      opened: Promise.reject(new TypeError("offline")),
    })
    expect(held.sent.filter((name) => name === addSlide)).toHaveLength(1)
  })

  it("stops waiting and sends nothing once the person pressed Stop", async () => {
    const stopping = new AbortController()
    const held = link([landed])
    const asking = askAira(airaChat(deck), "Add a slide", {
      signal: stopping.signal,
      fetch: held.send,
      show: () => undefined,
      opened: new Promise<void>(() => undefined),
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    stopping.abort()
    const done = await asking
    expect(held.sent).toEqual([])
    expect(done.exchanges[0]?.end).toBe("stopped")
  })
})
