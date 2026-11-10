import { readDeckId } from "@airdesign/catalog"
import { decide, elementId, openRegister, version } from "@airdesign/document"
import { openDeck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import type { ToolResult } from "./call-tool.js"
import { afterWrite, openRun } from "./run.js"

const firstEdit = { deck: "deck", base: 0, changes: [{ value: "21" }] }
const secondEdit = { deck: "deck", base: 1, changes: [{ value: "22" }] }

describe("openRun", () => {
  it("starts an idle element and reuses that run for a fresh read", () => {
    const minted: string[] = []
    const first = openRun(openRegister("", ""), firstEdit, () => {
      minted.push("one")
      return "one"
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.caller).toEqual({ actor: "agent", runId: "one", readAt: 0 })
    expect(first.register.runId).toBe("one")
    expect(first.register.phase).toBe("running")
    const edited = decide(first.register, {
      command: "agent",
      runId: first.caller.runId,
      readAt: first.caller.readAt,
      value: "21",
    })
    expect(edited.decision).toBe("apply")
    if (edited.decision !== "apply") return
    expect(version(edited.register)).toBe(1)
    const second = openRun(edited.register, secondEdit, () => {
      minted.push("two")
      return "two"
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.caller).toEqual({ actor: "agent", runId: "one", readAt: 1 })
    expect(second.register.runId).toBe("one")
    expect(minted).toEqual(["one"])
  })

  it("starts an idle element on the run already running on the deck", () => {
    const started = openRun(openRegister("", ""), firstEdit, () => "one")
    expect(started.ok).toBe(true)
    if (!started.ok) return
    const added = decide(started.register, { command: "add", node: elementId("b"), floor: "", route: "" })
    expect(added.decision).toBe("apply")
    if (added.decision !== "apply") return
    const paired = openRun(added.register, { deck: "deck", base: 0, changes: [{ value: "b", node: "b" }] }, () => "two")
    expect(paired.ok).toBe(true)
    if (!paired.ok) return
    expect(paired.caller.runId).toBe("one")
    expect(paired.caller.readAt).toBe(0)
    expect(paired.register.runId).toBe("one")
  })

  it("lets a stopped element refuse the start", () => {
    const started = decide(openRegister("", ""), { command: "start", runId: "one" })
    expect(started.decision).toBe("apply")
    if (started.decision !== "apply") return
    const stopped = decide(started.register, { command: "stop", runId: "one" })
    expect(stopped.decision).toBe("apply")
    if (stopped.decision !== "apply") return
    const again = openRun(stopped.register, secondEdit, () => "two")
    expect(again).toEqual({ ok: false, refusal: "run-fenced" })
  })

  it("does not take a run id from the client", () => {
    const refused = openRun(
      openRegister("", ""),
      { deck: "deck", base: 0, changes: [{ value: "21" }], runId: "client-run", readAt: 4, actor: "person" },
      () => "one",
    )
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.refusal).toBe("field")
  })
})

describe("afterWrite", () => {
  it("answers stale and keeps the loaded deck when the write loses", () => {
    const named = readDeckId("deck")
    if (!named.ok) throw new Error(named.refusal)
    const loaded = openDeck(named.deck)
    const landed: ToolResult = {
      ok: true,
      deck: { ...loaded, revision: 1 },
      content: [{ type: "text", text: "Landed revision 1." }],
    }
    const lost = afterWrite(false, landed, loaded)
    expect(lost.ok).toBe(false)
    if (lost.ok) return
    expect(lost.refusal).toBe("stale")
    expect(lost.deck).toBe(loaded)
    expect(lost.content).toEqual([{ type: "text", text: "stale" }])
    expect(afterWrite(true, landed, loaded)).toBe(landed)
  })
})
