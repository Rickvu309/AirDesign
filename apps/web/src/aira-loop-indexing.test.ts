import { airaRoutes, catalog, mcpRoutes, projectTools } from "@airdesign/catalog"
import { describe, expect, it } from "vitest"
import { airaChat, askAira, type AiraChat } from "./aira-loop"

const deck = "deck"
const addSlide = projectTools(catalog).find((tool) => tool.op === "add_slide")?.name ?? ""
const usage = { used: 0.5, allowed: 2, resets: "2026-11-16T00:00:00.000Z" }
const add = { type: "tool_use", id: "call_1", name: addSlide, input: { deck, base: 0, after: "256", layout: "256" } }
const indexing = {
  isError: true,
  structuredContent: { ok: false, refusal: "indexing" },
  text: "The deck is still being indexed.",
}
const landed = { structuredContent: { ok: true, revision: 1, runId: "run-1", slide: "257" } }
const stale = { isError: true, structuredContent: { ok: false, refusal: "stale" }, text: "Changed." }

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

async function ask(answers: readonly object[], paused: number[], signal = new AbortController().signal) {
  const held = link(answers)
  const shown: AiraChat[] = []
  const done = await askAira(airaChat(deck), "Add a slide", {
    signal,
    fetch: held.send,
    show: (next) => shown.push(next),
    pause: async (ms) => {
      paused.push(ms)
    },
  })
  return { done, shown, held }
}

describe("Aira's loop when the deck is still being indexed", () => {
  it("sends the refused call again after a pause, shows the step as working meanwhile, and lands it", async () => {
    const paused: number[] = []
    const { done, shown, held } = await ask([indexing, indexing, landed], paused)
    expect(held.sent.filter((name) => name === addSlide)).toHaveLength(3)
    expect(paused).toEqual([1000, 1000])
    const rows = shown.flatMap((chat) => chat.exchanges[0]?.steps ?? []).filter((step) => step.kind === "tool")
    expect(rows.map((step) => step.state)).not.toContain("refused")
    expect(done.exchanges[0]?.steps.find((step) => step.kind === "tool")).toMatchObject({ state: "done" })
    expect(done.exchanges[0]?.runs).toEqual(["run-1"])
  })

  it("gives up after a bounded number of tries and tells Aira the deck was still being indexed", async () => {
    const paused: number[] = []
    const { done, held } = await ask(
      Array.from({ length: 40 }, () => indexing),
      paused,
    )
    const sentCount = held.sent.filter((name) => name === addSlide).length
    expect(sentCount).toBe(paused.length + 1)
    expect(sentCount).toBeLessThan(21)
    expect(done.exchanges[0]?.steps.find((step) => step.kind === "tool")).toMatchObject({ state: "refused" })
    expect(done.history[2]).toMatchObject({
      content: [{ type: "tool_result", content: "The deck is still being indexed.", is_error: true }],
    })
  })

  it("does not send again after any other refusal", async () => {
    const paused: number[] = []
    const { held } = await ask([stale, landed], paused)
    expect(held.sent.filter((name) => name === addSlide)).toHaveLength(1)
    expect(paused).toEqual([])
  })

  it("does not send again once the person pressed Stop during the wait", async () => {
    const stopping = new AbortController()
    const paused: number[] = []
    const held = link([indexing, indexing, landed])
    const done = await askAira(airaChat(deck), "Add a slide", {
      signal: stopping.signal,
      fetch: held.send,
      show: () => undefined,
      pause: async (ms) => {
        paused.push(ms)
        stopping.abort()
      },
    })
    expect(paused).toEqual([1000])
    expect(held.sent.filter((name) => name === addSlide)).toHaveLength(1)
    expect(done.exchanges[0]?.end).toBe("stopped")
  })
})

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
