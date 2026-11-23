import { airaRoutes, mcpRoutes, onceMeta, type ReplyBlock } from "@airdesign/catalog"
import { describe, expect, it, vi } from "vitest"
import { airaChat, askAira, undoExchange, type AiraChat } from "./aira-loop"
import { call, deck, edit, editCall, edited, ended, read, scripted, stop } from "@/testing/aira-loop-script"

describe("Aira's loop when Stop comes while a tool call is still waiting for the server", () => {
  async function stoppedInFlight(calls: readonly ReplyBlock[]) {
    const controller = new AbortController()
    const link = scripted([{ lines: [ended(calls)] }, { lines: [ended([{ type: "text", text: "Ok" }])] }], [], {
      onTool: () => void setTimeout(() => controller.abort(), 0),
      holdTools: true,
    })
    const done = await askAira(airaChat(deck), "Retitle", {
      signal: controller.signal,
      fetch: link.send,
      show: () => undefined,
    })
    return { done, link }
  }

  async function stoppedBeforeAnswer(landed: boolean) {
    const stopping = new AbortController()
    const link = scripted([{ lines: [ended([editCall])] }, { lines: [ended([{ type: "text", text: "Ok" }])] }], [], {
      holdTools: true,
      stopped: (body) => (landed && body.call !== undefined ? { ok: true, runId: "run-1" } : { ok: true }),
    })
    const shown: AiraChat[] = []
    const first = askAira(airaChat(deck), "Retitle", {
      signal: stopping.signal,
      fetch: link.send,
      mint: () => "ask-1",
      show: (next) => shown.push(next),
    })
    await vi.waitFor(() => {
      expect(link.toolsSent()).toEqual([edit])
    })
    stopping.abort()
    await vi.waitFor(() => {
      expect(shown.at(-1)?.exchanges[0]?.end).toBe("stopped")
    })
    return { first, link, stopped: shown.at(-1) ?? airaChat(deck) }
  }

  function stopsSent(link: ReturnType<typeof scripted>) {
    return link.sent.filter((each) => each.path === airaRoutes.stop.path).map((each) => each.body)
  }

  it("cuts the edit call at once, names it in the stop, keeps the run it landed for Undo, shows its step done and stops that run", async () => {
    const { first, link } = await stoppedBeforeAnswer(true)
    const sent = link.sent.find((each) => each.path === mcpRoutes.mcp.path)?.body.params as { _meta?: unknown }
    expect(sent._meta).toEqual({ [onceMeta]: "ask-1-1" })
    const done = await first
    expect(stopsSent(link)).toEqual([{ ask: "ask-1", call: { deck, once: "ask-1-1" } }])
    expect(done.exchanges[0]).toMatchObject({ end: "stopped", runs: ["run-1"] })
    expect(done.exchanges[0]?.steps).toEqual([{ kind: "tool", id: "call_1", name: edit, state: "done" }])
    expect(link.toolsSent()).toEqual([edit, stop])
    const closing = link.sent.at(-1)?.body.params as { arguments: Record<string, unknown> }
    expect(closing.arguments).toEqual({ deck, runId: "run-1" })
    expect(await undoExchange(done, 0, async () => "undone")).toMatchObject({ exchanges: [{ end: "undone" }] })
  })

  it("offers no Undo and stops no run when the stop finds the cut edit had not landed", async () => {
    const { first, link } = await stoppedBeforeAnswer(false)
    const done = await first
    expect(stopsSent(link)).toEqual([{ ask: "ask-1", call: { deck, once: "ask-1-1" } }])
    expect(done.exchanges[0]).toMatchObject({ end: "stopped", runs: [] })
    expect(done.exchanges[0]?.steps).toEqual([{ kind: "tool", id: "call_1", name: edit, state: "stopped" }])
    expect(link.toolsSent()).toEqual([edit])
  })

  it("sends a new ask's turn only once the stopped run is closed, and keeps that run's Undo in the new chat", async () => {
    const { first, link, stopped } = await stoppedBeforeAnswer(true)
    const second = askAira(stopped, "Again", {
      signal: new AbortController().signal,
      fetch: link.send,
      show: () => undefined,
      after: first,
    })
    const done = await second
    expect(link.toolsSent()).toEqual([edit, stop])
    expect(link.sent.findIndex((each) => each.path === airaRoutes.turn.path && each.body.ask !== "ask-1")).toBe(
      link.sent.length - 1,
    )
    expect(link.turnsSent()).toHaveLength(2)
    expect(done.exchanges.map((exchange) => [exchange.end, exchange.runs])).toEqual([
      ["stopped", ["run-1"]],
      ["done", []],
    ])
  })

  it("ends the hung call, marks its step stopped, and tells the model an edit may have landed", async () => {
    const { done, link } = await stoppedInFlight([editCall])
    expect(done.exchanges[0]?.end).toBe("stopped")
    expect(done.exchanges[0]?.steps).toEqual([{ kind: "tool", id: "call_1", name: edit, state: "stopped" }])
    expect(link.toolsSent()).toEqual([edit])
    const [answer] = done.answers
    expect(answer).toMatchObject({ tool_use_id: "call_1", is_error: true })
    expect(JSON.stringify(answer)).toContain("may have landed")
    expect(JSON.stringify(answer)).not.toContain("Nothing landed")
  })

  it("says a read changed nothing", async () => {
    const { done } = await stoppedInFlight([call("call_1", read, { deck })])
    expect(done.exchanges[0]?.steps).toEqual([{ kind: "tool", id: "call_1", name: read, state: "stopped" }])
    expect(JSON.stringify(done.answers[0])).toContain("Nothing changed")
  })
})

describe("Aira's loop when an edit's answer is lost on the network", () => {
  function losing(first: "landed" | "unsent", answers: readonly unknown[]) {
    const inner = scripted(
      [{ lines: [ended([editCall])] }, { lines: [ended([{ type: "text", text: "Ok" }])] }],
      answers as Parameters<typeof scripted>[1],
    )
    let sends = 0
    const send: typeof fetch = async (input, init) => {
      if (String(input) === mcpRoutes.mcp.path && (sends += 1) <= (first === "landed" ? 1 : 2)) {
        if (first === "landed") await inner.send(input, init)
        throw new TypeError("network")
      }
      return inner.send(input, init)
    }
    return { inner, send }
  }

  it("sends the edit again with its once and keeps the run the first send landed", async () => {
    const { inner, send } = losing("landed", [edited, edited])
    const done = await askAira(airaChat(deck), "Retitle", {
      signal: new AbortController().signal,
      fetch: send,
      mint: () => "ask-1",
      show: () => undefined,
    })
    const onces = inner.sent
      .filter((each) => each.path === mcpRoutes.mcp.path)
      .map((each) => (each.body.params as { _meta?: Record<string, unknown> })._meta?.[onceMeta])
    expect(onces).toEqual(["ask-1-1", "ask-1-1", undefined])
    expect(JSON.stringify(done.history)).not.toContain("Nothing landed")
    expect(done.exchanges[0]?.runs).toEqual(["run-1"])
  })

  it("tells the model the edit may have landed when the second send is lost too", async () => {
    const { inner, send } = losing("unsent", [])
    const done = await askAira(airaChat(deck), "Retitle", {
      signal: new AbortController().signal,
      fetch: send,
      show: () => undefined,
    })
    expect(inner.toolsSent()).toEqual([])
    expect(JSON.stringify(done.history)).toContain("or its answer was lost")
    expect(done.exchanges[0]?.runs).toEqual([])
  })
})
