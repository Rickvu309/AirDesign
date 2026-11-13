import { type ReplyBlock } from "@airdesign/catalog"
import { describe, expect, it, vi } from "vitest"
import { airaChat, askAira, undoExchange, type AiraChat } from "./aira-loop"
import { call, deck, edit, editCall, edited, ended, read, scripted, stop } from "./aira-loop-script"

describe("Aira's loop when Stop comes while a tool call is still waiting for the server", () => {
  const never = () => new Promise<void>(() => undefined)

  async function stoppedInFlight(calls: readonly ReplyBlock[], pause: () => Promise<void>) {
    const controller = new AbortController()
    const link = scripted([{ lines: [ended(calls)] }, { lines: [ended([{ type: "text", text: "Ok" }])] }], [], {
      onTool: () => void setTimeout(() => controller.abort(), 0),
      holdTools: true,
    })
    const done = await askAira(airaChat(deck), "Retitle", {
      signal: controller.signal,
      fetch: link.send,
      show: () => undefined,
      pause,
    })
    return { done, link }
  }

  async function stoppedBeforeAnswer() {
    const stopping = new AbortController()
    let land = (): void => undefined
    const landing = new Promise<void>((resolve) => {
      land = resolve
    })
    const link = scripted(
      [{ lines: [ended([editCall])] }, { lines: [ended([{ type: "text", text: "Ok" }])] }],
      [edited],
      { landing },
    )
    const shown: AiraChat[] = []
    const first = askAira(airaChat(deck), "Retitle", {
      signal: stopping.signal,
      fetch: link.send,
      show: (next) => shown.push(next),
      pause: never,
    })
    await vi.waitFor(() => {
      expect(link.toolsSent()).toEqual([edit])
    })
    stopping.abort()
    await vi.waitFor(() => {
      expect(shown.at(-1)?.exchanges[0]?.end).toBe("stopped")
    })
    return { first, link, land, stopped: shown.at(-1) ?? airaChat(deck) }
  }

  it("shows the run stopped at once, then keeps the run the edit landed for Undo and stops that run", async () => {
    const { first, link, land, stopped } = await stoppedBeforeAnswer()
    expect(stopped.exchanges[0]?.runs).toEqual([])
    land()
    const done = await first
    expect(done.exchanges[0]).toMatchObject({ end: "stopped", runs: ["run-1"] })
    expect(done.exchanges[0]?.steps).toEqual([{ kind: "tool", id: "call_1", name: edit, state: "stopped" }])
    expect(link.toolsSent()).toEqual([edit, stop])
    const closing = link.sent.at(-1)?.body.params as { arguments: Record<string, unknown> }
    expect(closing.arguments).toEqual({ deck, runId: "run-1" })
    expect(await undoExchange(done, 0, link.send)).toMatchObject({ exchanges: [{ end: "undone" }] })
  })

  it("sends a new ask's turn only once the stopped run is closed, and keeps that run's Undo in the new chat", async () => {
    const { first, link, land, stopped } = await stoppedBeforeAnswer()
    const second = askAira(stopped, "Again", {
      signal: new AbortController().signal,
      fetch: link.send,
      show: () => undefined,
      after: first,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(link.turnsSent()).toHaveLength(1)
    land()
    const done = await second
    expect(link.toolsSent()).toEqual([edit, stop])
    expect(link.turnsSent()).toHaveLength(2)
    expect(done.exchanges.map((exchange) => [exchange.end, exchange.runs])).toEqual([
      ["stopped", ["run-1"]],
      ["done", []],
    ])
  })

  it("ends the hung call, marks its step stopped, and tells the model an edit may have landed", async () => {
    const { done, link } = await stoppedInFlight([editCall], async () => undefined)
    expect(done.exchanges[0]?.end).toBe("stopped")
    expect(done.exchanges[0]?.steps).toEqual([{ kind: "tool", id: "call_1", name: edit, state: "stopped" }])
    expect(link.toolsSent()).toEqual([edit])
    const [answer] = done.answers
    expect(answer).toMatchObject({ tool_use_id: "call_1", is_error: true })
    expect(JSON.stringify(answer)).toContain("may have landed")
    expect(JSON.stringify(answer)).not.toContain("Nothing landed")
  })

  it("says a read changed nothing", async () => {
    const { done } = await stoppedInFlight([call("call_1", read, { deck })], never)
    expect(done.exchanges[0]?.steps).toEqual([{ kind: "tool", id: "call_1", name: read, state: "stopped" }])
    expect(JSON.stringify(done.answers[0])).toContain("Nothing changed")
  })
})
