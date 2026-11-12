import { airaRoutes, catalog, deckRoutes, mcpRoutes, projectTools, type ReplyBlock } from "@airdesign/catalog"
import { describe, expect, it, vi } from "vitest"
import { airaChat, askAira, undoExchange, type AiraChat } from "./aira-loop"

const deck = "deck"
const nameOf = (op: string) => projectTools(catalog).find((tool) => tool.op === op)?.name ?? ""
const edit = nameOf("edit_deck")
const read = nameOf("read_deck")
const stop = nameOf("stop_run")
const usage = { used: 0.5, allowed: 2, resets: "2026-11-16T00:00:00.000Z" }

type Turn =
  | { readonly lines: readonly unknown[]; readonly then?: "drop" | "hold" }
  | { readonly status: number; readonly body: unknown }

type Answer = { readonly structuredContent?: unknown; readonly isError?: boolean; readonly text?: string }

type Sent = { readonly path: string; readonly body: Record<string, unknown> }

function said(text: string) {
  return { type: "text", text }
}

function call(id: string, name: string, input: Record<string, unknown>): ReplyBlock {
  return { type: "tool_use", id, name, input }
}

function ended(content: readonly ReplyBlock[]) {
  const stop = content.some((block) => block.type === "tool_use") ? "tool_use" : "end_turn"
  return { type: "end", ok: true, stop, content, usage }
}

function streamed(turn: Extract<Turn, { lines: unknown }>, signal: AbortSignal | null | undefined): ReadableStream {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of turn.lines) controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`))
      if (turn.then === "drop") controller.error(new TypeError("network"))
      else if (turn.then === "hold") {
        signal?.addEventListener("abort", () => controller.error(new DOMException("stopped", "AbortError")))
      } else controller.close()
    },
  })
}

function scripted(
  turns: readonly Turn[],
  answers: readonly Answer[],
  hooks: { onTool?: () => void; onStop?: () => Promise<void>; holdTools?: true } = {},
) {
  const queue = [...turns]
  const replies = [...answers]
  const sent: Sent[] = []
  const send: typeof fetch = async (input, init) => {
    const path = String(input)
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    sent.push({ path, body })
    if (path === airaRoutes.turn.path) {
      const turn = queue.shift()
      if (turn === undefined) throw new Error("no turn left")
      if ("status" in turn) return new Response(JSON.stringify(turn.body), { status: turn.status })
      return new Response(streamed(turn, init?.signal), { status: 200 })
    }
    if (path === airaRoutes.stop.path) {
      await hooks.onStop?.()
      return new Response(JSON.stringify({ ok: true }))
    }
    if (path === mcpRoutes.mcp.path) {
      hooks.onTool?.()
      if (hooks.holdTools === true) {
        await new Promise<never>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("stopped", "AbortError")))
        })
      }
      const params = body.params as { name: string; arguments: Record<string, unknown> }
      const reply = params.name === stop ? { structuredContent: { ok: true } } : (replies.shift() ?? {})
      const text = reply.text ?? JSON.stringify(reply.structuredContent ?? {})
      const result = { content: [{ type: "text", text }], ...reply }
      return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: body.id, result })}\n\n`)
    }
    if (path === deckRoutes.undo.path) {
      const runId = String(body.runId)
      if (runId === "fenced") return new Response(JSON.stringify({ ok: false, refusal: "run-fenced" }))
      return new Response(JSON.stringify({ ok: true, deck, revision: 9, key: `${deck}:9` }))
    }
    throw new Error(path)
  }
  const turnsSent = () =>
    sent.filter((each) => each.path === airaRoutes.turn.path).map((each) => each.body.messages as readonly unknown[])
  const toolsSent = () =>
    sent.filter((each) => each.path === mcpRoutes.mcp.path).map((each) => (each.body.params as { name: string }).name)
  return { send, sent, turnsSent, toolsSent }
}

async function asking(
  chat: AiraChat,
  text: string,
  link: ReturnType<typeof scripted>,
  more: { readonly stopOn?: (chat: AiraChat) => boolean; readonly added?: () => string | undefined } = {},
) {
  const stopping = new AbortController()
  const shown: AiraChat[] = []
  const done = await askAira(chat, text, {
    signal: stopping.signal,
    fetch: link.send,
    ...(more.added === undefined ? {} : { added: more.added }),
    show: (next) => {
      shown.push(next)
      if (more.stopOn?.(next) === true) stopping.abort()
    },
  })
  return { done, shown, stopping }
}

const edited = { structuredContent: { ok: true, revision: 2, runId: "run-1" } }
const editCall = call("call_1", edit, { deck, base: 1, changes: [] })

describe("Aira's loop in the browser", () => {
  it("streams a text answer and ends the exchange with nothing to undo", async () => {
    const link = scripted([{ lines: [said("Hi"), said(" there"), ended([{ type: "text", text: "Hi there" }])] }], [])
    const { done, shown } = await asking(airaChat(deck), "Hello", link)
    expect(shown.map((chat) => chat.exchanges[0]?.steps)).toContainEqual([{ kind: "text", text: "Hi" }])
    expect(done.exchanges).toEqual([
      { asked: "Hello", steps: [{ kind: "text", text: "Hi there" }], end: "done", runs: [] },
    ])
    expect(done.history).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: [{ type: "text", text: "Hi there" }] },
    ])
    expect(done.usage).toEqual(usage)
    expect(link.toolsSent()).toEqual([])
  })

  it("calls a tool through the MCP address, sends its answer back, and stops the run it opened", async () => {
    const link = scripted(
      [
        {
          lines: [
            said("I will"),
            { type: "tool", id: "call_1", name: edit },
            ended([{ type: "text", text: "I will" }, editCall]),
          ],
        },
        { lines: [said("Done"), ended([{ type: "text", text: "Done" }])] },
      ],
      [edited],
    )
    const { done } = await asking(airaChat(deck), "Retitle", link)
    const answer = { type: "tool_result", tool_use_id: "call_1", content: JSON.stringify(edited.structuredContent) }
    expect(link.turnsSent()[1]).toEqual([
      { role: "user", content: "Retitle" },
      { role: "assistant", content: [{ type: "text", text: "I will" }, editCall] },
      { role: "user", content: [answer] },
    ])
    expect(done.exchanges[0]).toEqual({
      asked: "Retitle",
      steps: [
        { kind: "text", text: "I will" },
        { kind: "tool", id: "call_1", name: edit, state: "done" },
        { kind: "text", text: "Done" },
      ],
      end: "done",
      runs: ["run-1"],
    })
    expect(link.toolsSent()).toEqual([edit, stop])
    expect(link.sent.at(-1)?.body.params).toEqual({ name: stop, arguments: { deck, runId: "run-1" } })
  })

  it("answers several calls in order and leaves a run Aira stopped itself alone", async () => {
    const calls = [
      call("call_1", read, { deck }),
      call("call_2", edit, { deck, base: 1, changes: [] }),
      call("call_3", stop, { deck, runId: "run-1" }),
    ]
    const link = scripted(
      [{ lines: [ended(calls)] }, { lines: [ended([{ type: "text", text: "Done" }])] }],
      [{ structuredContent: { ok: true, revision: 1, runId: null } }, edited],
    )
    const { done } = await asking(airaChat(deck), "Retitle", link)
    const answered = link.turnsSent()[1]?.[2] as { content: { tool_use_id: string }[] }
    expect(answered.content.map((answer) => answer.tool_use_id)).toEqual(["call_1", "call_2", "call_3"])
    expect(link.toolsSent()).toEqual([read, edit, stop])
    expect(done.exchanges[0]?.runs).toEqual(["run-1"])
  })

  it("tells Aira when a call is refused and keeps going", async () => {
    const refused = { isError: true, structuredContent: { ok: false, refusal: "closed" }, text: "A person holds it." }
    const link = scripted(
      [{ lines: [ended([editCall])] }, { lines: [ended([{ type: "text", text: "Sorry" }])] }],
      [refused],
    )
    const { done } = await asking(airaChat(deck), "Retitle", link)
    expect(link.turnsSent()[1]?.[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "call_1", content: "A person holds it.", is_error: true }],
    })
    expect(done.exchanges[0]?.steps[0]).toEqual({ kind: "tool", id: "call_1", name: edit, state: "refused" })
    expect(done.exchanges[0]?.runs).toEqual([])
    expect(done.exchanges[0]?.end).toBe("done")
  })

  it("stops mid-stream when the person presses Stop and keeps only finished turns", async () => {
    const link = scripted(
      [{ lines: [said("Work")], then: "hold" }, { lines: [ended([{ type: "text", text: "Ok" }])] }],
      [],
    )
    const { done } = await asking(airaChat(deck), "First", link, {
      stopOn: (chat) => chat.exchanges[0]?.steps.length === 1,
    })
    expect(done.exchanges[0]).toEqual({
      asked: "First",
      steps: [{ kind: "text", text: "Work" }],
      end: "stopped",
      runs: [],
    })
    expect(done.history).toEqual([])
    await asking(done, "Second", link)
    expect(link.turnsSent()[1]).toEqual([{ role: "user", content: "Second" }])
  })

  it("tells the server which ask it stopped, and a new ask sends its turn only once the server answered", async () => {
    let answerStop = (): void => undefined
    const link = scripted(
      [{ lines: [said("Work")], then: "hold" }, { lines: [ended([{ type: "text", text: "Ok" }])] }],
      [],
      {
        onStop: () =>
          new Promise<void>((resolve) => {
            answerStop = resolve
          }),
      },
    )
    const stopping = new AbortController()
    let stoppedChat: AiraChat | undefined
    const first = askAira(airaChat(deck), "First", {
      signal: stopping.signal,
      fetch: link.send,
      mint: () => "ask-1",
      show: (next) => {
        if (next.exchanges[0]?.end === "stopped") stoppedChat = next
        else if (next.exchanges[0]?.steps.length === 1) stopping.abort()
      },
    })
    await vi.waitFor(() => {
      expect(stoppedChat).toBeDefined()
    })
    const second = askAira(stoppedChat ?? airaChat(deck), "Second", {
      signal: new AbortController().signal,
      fetch: link.send,
      mint: () => "ask-2",
      show: () => undefined,
      after: first,
    })
    expect(link.sent.filter((each) => each.path === airaRoutes.stop.path).map((each) => each.body)).toEqual([
      { ask: "ask-1" },
    ])
    expect(link.turnsSent()).toHaveLength(1)
    answerStop()
    expect((await second).exchanges.at(-1)?.end).toBe("done")
    expect(link.sent.filter((each) => each.path === airaRoutes.turn.path).map((each) => each.body.ask)).toEqual([
      "ask-1",
      "ask-2",
    ])
  })

  it("stops between calls, answers the call it skipped, and closes the run that landed", async () => {
    const calls = [editCall, call("call_2", edit, { deck, base: 2, changes: [] })]
    const stopping: { abort?: () => void } = {}
    const link = scripted([{ lines: [ended(calls)] }, { lines: [ended([{ type: "text", text: "Ok" }])] }], [edited], {
      onTool: () => stopping.abort?.(),
    })
    const first = askAira(airaChat(deck), "Retitle", {
      signal: (() => {
        const controller = new AbortController()
        stopping.abort = () => controller.abort()
        return controller.signal
      })(),
      fetch: link.send,
      show: () => undefined,
    })
    const done = await first
    expect(done.exchanges[0]?.end).toBe("stopped")
    expect(done.exchanges[0]?.steps.map((step) => (step.kind === "tool" ? step.state : step.kind))).toEqual([
      "done",
      "stopped",
    ])
    expect(link.toolsSent()).toEqual([edit, stop])
    await asking(done, "Again", link)
    const next = link.turnsSent()[1]?.at(-1) as { content: { type: string; is_error?: boolean }[] }
    expect(next.content.map((block) => [block.type, block.is_error === true])).toEqual([
      ["tool_result", false],
      ["tool_result", true],
      ["text", false],
    ])
  })

  it("fails when the stream drops and sends the answers it holds with the next ask", async () => {
    const link = scripted(
      [
        { lines: [ended([editCall])] },
        { lines: [said("Half")], then: "drop" },
        { lines: [{ type: "end", ok: false, refusal: "dropped", usage }] },
        { lines: [ended([{ type: "text", text: "Ok" }])] },
      ],
      [edited],
    )
    const { done } = await asking(airaChat(deck), "Retitle", link)
    expect(done.exchanges[0]?.end).toBe("failed")
    expect(done.exchanges[0]?.runs).toEqual(["run-1"])
    expect(done.answers.map((answer) => answer.tool_use_id)).toEqual(["call_1"])
    const again = await asking(done, "Again", link)
    expect(again.done.exchanges[1]?.end).toBe("failed")
    expect(link.turnsSent()[2]?.at(-1)).toEqual({
      role: "user",
      content: [done.answers[0], { type: "text", text: "Again" }],
    })
    const last = await asking(again.done, "Once more", link)
    expect(last.done.exchanges[2]?.end).toBe("done")
  })

  it("ends out of usage when the server answers 402 mid-run and keeps the run to undo", async () => {
    const spent = { used: 2, allowed: 2, resets: usage.resets }
    const link = scripted(
      [{ lines: [ended([editCall])] }, { status: 402, body: { ok: false, refusal: "allowance", usage: spent } }],
      [edited],
    )
    const { done } = await asking(airaChat(deck), "Retitle", link)
    expect(done.exchanges[0]?.end).toBe("out-of-usage")
    expect(done.usage).toEqual(spent)
    expect(done.exchanges[0]?.runs).toEqual(["run-1"])
  })

  it("sends what the person added during the run with the next turn", async () => {
    const link = scripted(
      [{ lines: [ended([editCall])] }, { lines: [said("Ok"), ended([{ type: "text", text: "Ok" }])] }],
      [edited],
    )
    const extra = ["Make it blue"]
    const { done } = await asking(airaChat(deck), "Retitle", link, { added: () => extra.shift() })
    expect(link.turnsSent()[1]?.at(-1)).toEqual({
      role: "user",
      content: [done.history[2]?.content.at(0), { type: "text", text: "Make it blue" }],
    })
    expect(done.exchanges[0]?.steps.map((step) => step.kind)).toEqual(["tool", "added", "text"])
  })

  it("says the person is signed out when the server answers 401", async () => {
    const link = scripted([{ status: 401, body: { error: "session" } }], [])
    const { done } = await asking(airaChat(deck), "Hello", link)
    expect(done.exchanges[0]?.end).toBe("signed-out")
  })

  it("ends as not offered in the person's country when the server answers 403 country, and as failed for any other refusal", async () => {
    const country = scripted([{ status: 403, body: { ok: false, refusal: "country" } }], [])
    expect((await asking(airaChat(deck), "Hello", country)).done.exchanges[0]?.end).toBe("country")
    for (const refusal of [
      { status: 403, body: { ok: false, refusal: "off" } },
      { status: 500, body: {} },
    ]) {
      const link = scripted([refusal], [])
      expect((await asking(airaChat(deck), "Hello", link)).done.exchanges[0]?.end).toBe("failed")
    }
  })

  it("undoes every run an exchange landed, once, and marks an exchange whose run can no longer be undone", async () => {
    const link = scripted(
      [{ lines: [ended([editCall])] }, { lines: [ended([{ type: "text", text: "Ok" }])] }],
      [edited],
    )
    const { done } = await asking(airaChat(deck), "Retitle", link)
    const undone = await undoExchange(done, 0, link.send)
    expect(link.sent.at(-1)).toEqual({ path: deckRoutes.undo.path, body: { deck, runId: "run-1" } })
    expect(undone?.exchanges[0]?.end).toBe("undone")
    expect(undone === undefined ? "missing" : await undoExchange(undone, 0, link.send)).toBeUndefined()
    const fenced = { ...done, exchanges: [{ ...done.exchanges[0]!, runs: ["fenced"] }] }
    const refused = await undoExchange(fenced, 0, link.send)
    expect(refused?.exchanges[0]).toMatchObject({ end: "done", undoRefused: true })
    const asked = link.sent.length
    expect(refused === undefined ? "missing" : await undoExchange(refused, 0, link.send)).toBeUndefined()
    expect(link.sent).toHaveLength(asked)
  })

  describe("when Stop comes while a tool call is still waiting for the server", () => {
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
})
