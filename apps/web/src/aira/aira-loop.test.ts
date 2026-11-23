import { airaRoutes } from "@airdesign/catalog"
import { describe, expect, it, vi } from "vitest"
import { airaChat, askAira, retryAira, undoExchange, type AiraChat, type UndoRun } from "./aira-loop"
import {
  asking,
  call,
  deck,
  edit,
  editCall,
  edited,
  ended,
  read,
  said,
  scripted,
  stop,
  usage,
} from "@/testing/aira-loop-script"

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
    const refused = {
      isError: true,
      structuredContent: { ok: false, refusal: "person-protected" },
      text: "A person holds it.",
    }
    const link = scripted(
      [{ lines: [ended([editCall])] }, { lines: [ended([{ type: "text", text: "Sorry" }])] }],
      [refused],
    )
    const { done } = await asking(airaChat(deck), "Retitle", link)
    expect(link.turnsSent()[1]?.[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "call_1", content: "A person holds it.", is_error: true }],
    })
    expect(done.exchanges[0]?.steps[0]).toEqual({
      kind: "tool",
      id: "call_1",
      name: edit,
      state: "refused",
      refusal: "person-protected",
    })
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
    const link = scripted([{ lines: [ended(calls)] }, { lines: [ended([{ type: "text", text: "Ok" }])] }], [edited])
    const { done } = await asking(airaChat(deck), "Retitle", link, {
      stopOn: (chat) => chat.exchanges[0]?.steps[0]?.kind === "tool" && chat.exchanges[0].steps[0].state === "done",
    })
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

  it("names a call that never reached the server as unreached", async () => {
    const link = scripted(
      [{ lines: [ended([call("call_1", read, { deck })])] }, { lines: [ended([{ type: "text", text: "Sorry" }])] }],
      [],
      {
        onTool: () => {
          throw new TypeError("network")
        },
      },
    )
    const { done } = await asking(airaChat(deck), "Read it", link)
    expect(done.exchanges[0]?.steps[0]).toMatchObject({ state: "refused", refusal: "unreached" })
  })

  it("retries a failed request in place, sending the answers its model waits for and stopping only the new run", async () => {
    const link = scripted(
      [
        { lines: [ended([editCall])] },
        { lines: [{ type: "end", ok: false, usage }] },
        { lines: [said("Done"), ended([{ type: "text", text: "Done" }])] },
      ],
      [edited],
    )
    const { done } = await asking(airaChat(deck), "Retitle", link)
    expect(done.exchanges[0]?.end).toBe("failed")
    const shown: AiraChat[] = []
    const again = await retryAira(done, {
      signal: new AbortController().signal,
      fetch: link.send,
      show: (chat) => shown.push(chat),
    })
    expect(shown[0]?.exchanges).toEqual([
      { ...done.exchanges[0], end: "working", steps: [...(done.exchanges[0]?.steps ?? []), { kind: "retry" }] },
    ])
    expect(again.exchanges).toEqual([
      {
        asked: "Retitle",
        steps: [
          { kind: "tool", id: "call_1", name: edit, state: "done" },
          { kind: "retry" },
          { kind: "text", text: "Done" },
        ],
        end: "done",
        runs: ["run-1"],
      },
    ])
    expect(link.turnsSent()[2]?.at(-1)).toEqual({ role: "user", content: done.answers })
    expect(link.toolsSent()).toEqual([edit, stop])
  })

  it("retries a request whose reply never came by asking its words again", async () => {
    const link = scripted([{ status: 500, body: {} }, { lines: [ended([{ type: "text", text: "Ok" }])] }], [])
    const { done } = await asking(airaChat(deck), "Retitle", link)
    const again = await retryAira(done, {
      signal: new AbortController().signal,
      fetch: link.send,
      show: () => undefined,
    })
    expect(link.turnsSent()[1]).toEqual([{ role: "user", content: "Retitle" }])
    expect(again.exchanges).toHaveLength(1)
    expect(again.exchanges[0]).toMatchObject({ asked: "Retitle", end: "done" })
  })

  it("retries a finished request with a refused step by asking its words again after Aira's reply", async () => {
    const refused = { isError: true, structuredContent: { ok: false, refusal: "stale" }, text: "Changed." }
    const link = scripted(
      [
        { lines: [ended([editCall])] },
        { lines: [said("Done"), ended([{ type: "text", text: "Done" }])] },
        { lines: [said("Ok"), ended([{ type: "text", text: "Ok" }])] },
      ],
      [refused],
    )
    const { done } = await asking(airaChat(deck), "Retitle", link)
    const again = await retryAira(done, {
      signal: new AbortController().signal,
      fetch: link.send,
      show: () => undefined,
    })
    expect(link.turnsSent()[2]?.slice(-2)).toEqual([
      { role: "assistant", content: [{ type: "text", text: "Done" }] },
      { role: "user", content: "Retitle" },
    ])
    expect(again.exchanges).toHaveLength(1)
    expect(again.exchanges[0]?.steps.slice(-3)).toEqual([
      { kind: "text", text: "Done" },
      { kind: "retry" },
      { kind: "text", text: "Ok" },
    ])
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
    const link = scripted([{ status: 500, body: {} }], [])
    expect((await asking(airaChat(deck), "Hello", link)).done.exchanges[0]?.end).toBe("failed")
  })

  it("ends as off when the server answers 403 off and as malformed when it answers 400, because the same ask fails the same way", async () => {
    const off = scripted([{ status: 403, body: { ok: false, refusal: "off" } }], [])
    expect((await asking(airaChat(deck), "Hello", off)).done.exchanges[0]?.end).toBe("off")
    const malformed = scripted([{ status: 400, body: { ok: false, refusal: "body" } }], [])
    expect((await asking(airaChat(deck), "Hello", malformed)).done.exchanges[0]?.end).toBe("malformed")
  })

  it("undoes every run an exchange landed, once, and marks an exchange whose run can no longer be undone", async () => {
    const link = scripted(
      [{ lines: [ended([editCall])] }, { lines: [ended([{ type: "text", text: "Ok" }])] }],
      [edited],
    )
    const { done } = await asking(airaChat(deck), "Retitle", link)
    const asked: string[] = []
    const undo: UndoRun = async (_deck, run) => {
      asked.push(run)
      return run === "fenced" ? "refused" : "undone"
    }
    const undone = await undoExchange(done, 0, undo)
    expect(asked).toEqual(["run-1"])
    expect(undone?.exchanges[0]?.end).toBe("undone")
    expect(undone === undefined ? "missing" : await undoExchange(undone, 0, undo)).toBeUndefined()
    const fenced = { ...done, exchanges: [{ ...done.exchanges[0]!, runs: ["fenced"] }] }
    const refused = await undoExchange(fenced, 0, undo)
    expect(refused?.exchanges[0]).toMatchObject({ end: "done", undoRefused: true })
    expect(refused === undefined ? "missing" : await undoExchange(refused, 0, undo)).toBeUndefined()
    expect(asked).toEqual(["run-1", "fenced"])
  })

  it("says an undo failed when the server cannot be reached, and undoes only the runs still left when the person tries again", async () => {
    const reachable = new Set(["run-2"])
    const asked: string[] = []
    const undo: UndoRun = async (_deck, run) => {
      asked.push(run)
      return reachable.has(run) ? "undone" : "failed"
    }
    const start: AiraChat = {
      ...airaChat(deck),
      exchanges: [{ asked: "Retitle", steps: [], end: "done", runs: ["run-1", "run-2"] }],
    }
    const failed = await undoExchange(start, 0, undo)
    expect(failed?.exchanges[0]).toEqual({
      asked: "Retitle",
      steps: [],
      end: "done",
      runs: ["run-1"],
      undoFailed: true,
    })
    reachable.add("run-1")
    const undone = failed === undefined ? undefined : await undoExchange(failed, 0, undo)
    expect(undone?.exchanges[0]).toEqual({ asked: "Retitle", steps: [], end: "undone", runs: ["run-1"] })
    expect(asked).toEqual(["run-2", "run-1", "run-1"])
  })
})
