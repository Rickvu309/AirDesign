import { readDeckId } from "@airdesign/catalog"
import { decide, elementId, openRegister, version, type Register } from "@airdesign/document"
import { openDeck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import type { ToolResult } from "./call-tool.js"
import { editLanded, runEnded } from "./edit-answer.js"
import { editNext, runNext } from "./edit-next.js"
import { afterWrite, joinRun, openRun } from "./run.js"

const node = elementId("258.7")
const sibling = elementId("258.8")
const created = elementId("258.n0123456789ab")
const firstEdit = { deck: "deck", base: 0, changes: [{ value: "21", node, readAt: 0 }] }
const secondEdit = { deck: "deck", base: 1, changes: [{ value: "22", node, readAt: 1 }] }

function bodyOf(register: Register, id = node) {
  const body = register.elements[id]
  if (body === undefined) throw new Error("missing node")
  return body
}

describe("openRun", () => {
  it("starts an idle element and reuses that run for a fresh read", () => {
    const minted: string[] = []
    const first = openRun(openRegister("", ""), firstEdit, () => {
      minted.push("one")
      return "one"
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.caller).toEqual({ actor: "agent", runId: "one" })
    expect(bodyOf(first.register).runId).toBe("one")
    expect(bodyOf(first.register).phase).toBe("running")
    const edited = decide(first.register, {
      command: "agent",
      runId: first.caller.runId,
      readAt: 0,
      value: "21",
      node,
    })
    expect(edited.decision).toBe("apply")
    if (edited.decision !== "apply") return
    expect(version(bodyOf(edited.register))).toBe(1)
    const second = joinRun(edited.register, secondEdit, first.caller.runId)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.caller).toEqual({ actor: "agent", runId: "one" })
    expect(bodyOf(second.register).runId).toBe("one")
    expect(minted).toEqual(["one"])
  })

  it("starts a second element in one turn on the first element's run", () => {
    const started = openRun(openRegister("", ""), firstEdit, () => "one")
    expect(started.ok).toBe(true)
    if (!started.ok) return
    const added = decide(started.register, { command: "add", node: sibling, floor: "", route: "" })
    expect(added.decision).toBe("apply")
    if (added.decision !== "apply") return
    const paired = joinRun(
      added.register,
      { deck: "deck", base: 0, changes: [{ value: "b", node: sibling, readAt: 0 }] },
      started.caller.runId,
    )
    expect(paired.ok).toBe(true)
    if (!paired.ok) return
    expect(paired.caller.runId).toBe("one")
    expect(bodyOf(paired.register, sibling).runId).toBe("one")
  })

  it("opens and starts a new element once when two changes name it", () => {
    const minted: string[] = []
    const opened = openRun(
      openRegister("", ""),
      {
        deck: "deck",
        base: 0,
        changes: [
          { value: "first", node: created, readAt: 0, floor: "given" },
          { value: "second", node: created, readAt: 1, floor: "given" },
        ],
      },
      () => {
        minted.push("one")
        return "one"
      },
    )
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.register.nodes.filter((id) => id === created)).toHaveLength(1)
    expect(bodyOf(opened.register, created).floor).toBe("given")
    expect(bodyOf(opened.register, created).phase).toBe("running")
    expect(minted).toEqual(["one"])
    const differs = openRun(
      openRegister("", ""),
      {
        deck: "deck",
        base: 0,
        changes: [
          { value: "first", node: created, readAt: 0, floor: "given" },
          { value: "second", node: created, readAt: 1, floor: "ignored" },
        ],
      },
      () => "two",
    )
    expect(differs).toEqual({ ok: false, refusal: "field" })
  })

  it("opens a new element on the register's floor when the change names none", () => {
    const opened = openRun(openRegister("kept", ""), firstEdit, () => "one")
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(bodyOf(opened.register).floor).toBe("kept")
  })

  it("starts an ended element on the candidate and never on the deck's running id", () => {
    for (const end of ["stop", "undo"] as const) {
      const first = openRun(openRegister("", ""), firstEdit, () => "one")
      if (!first.ok) throw new Error(first.refusal)
      const landed = decide(first.register, { command: "agent", runId: "one", readAt: 0, value: "21", node })
      if (landed.decision !== "apply") throw new Error(landed.code)
      const paired = joinRun(
        landed.register,
        { deck: "deck", base: 1, changes: [{ value: "b", node: sibling, readAt: 0 }] },
        first.caller.runId,
      )
      if (!paired.ok) throw new Error(paired.refusal)
      const ended = decide(paired.register, { command: end, runId: "one", node })
      if (ended.decision !== "apply") throw new Error(ended.code)
      const again = openRun(ended.register, secondEdit, () => "fresh")
      expect(again.ok).toBe(true)
      if (!again.ok) return
      expect(again.caller.runId).toBe("fresh")
      expect(bodyOf(again.register).runId).toBe("fresh")
      expect(bodyOf(again.register).phase).toBe("running")
      expect(bodyOf(again.register).landed).toEqual(bodyOf(ended.register).landed)
      expect(bodyOf(again.register, sibling).runId).toBe("one")
    }
  })

  it("answers the refusal and keeps the register when the candidate already landed on the ended element", () => {
    const first = openRun(openRegister("", ""), firstEdit, () => "one")
    if (!first.ok) throw new Error(first.refusal)
    const landed = decide(first.register, { command: "agent", runId: "one", readAt: 0, value: "21", node })
    if (landed.decision !== "apply") throw new Error(landed.code)
    const stopped = decide(landed.register, { command: "stop", runId: "one", node })
    if (stopped.decision !== "apply") throw new Error(stopped.code)
    expect(openRun(stopped.register, secondEdit, () => "one")).toEqual({ ok: false, refusal: "run-fenced" })
    expect(bodyOf(stopped.register).phase).toBe("stopped")
  })

  it("acts under the first change's own run when the deck has two running ids", () => {
    const opened = openRegister("", "")
    const addedFirst = decide(opened, { command: "add", node, floor: "", route: "" })
    if (addedFirst.decision !== "apply") throw new Error(addedFirst.code)
    const addedSecond = decide(addedFirst.register, { command: "add", node: sibling, floor: "", route: "" })
    if (addedSecond.decision !== "apply") throw new Error(addedSecond.code)
    const startedFirst = decide(addedSecond.register, { command: "start", runId: "first", node })
    if (startedFirst.decision !== "apply") throw new Error(startedFirst.code)
    const startedSecond = decide(startedFirst.register, { command: "start", runId: "second", node: sibling })
    if (startedSecond.decision !== "apply") throw new Error(startedSecond.code)
    const result = joinRun(
      startedSecond.register,
      { deck: "deck", base: 0, changes: [{ value: "b", node: sibling, readAt: 0 }] },
      "first",
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.caller).toEqual({ actor: "agent", runId: "second" })
    expect(
      decide(result.register, { command: "agent", runId: result.caller.runId, readAt: 0, value: "b", node: sibling })
        .decision,
    ).toBe("apply")
  })

  it("answers what the engine answers for two elements under runs from two different turns", () => {
    const opened = openRegister("", "")
    const addedFirst = decide(opened, { command: "add", node, floor: "", route: "" })
    if (addedFirst.decision !== "apply") throw new Error(addedFirst.code)
    const addedSecond = decide(addedFirst.register, { command: "add", node: sibling, floor: "", route: "" })
    if (addedSecond.decision !== "apply") throw new Error(addedSecond.code)
    const startedFirst = decide(addedSecond.register, { command: "start", runId: "first", node })
    if (startedFirst.decision !== "apply") throw new Error(startedFirst.code)
    const both = decide(startedFirst.register, { command: "start", runId: "second", node: sibling })
    if (both.decision !== "apply") throw new Error(both.code)
    const edit = {
      deck: "deck",
      base: 0,
      changes: [
        { value: "a", node, readAt: 0 },
        { value: "b", node: sibling, readAt: 0 },
      ],
    }
    expect(joinRun(both.register, edit, "first")).toEqual({ ok: false, refusal: "run-fenced" })
    expect(bodyOf(both.register).runId).toBe("first")
    expect(bodyOf(both.register, sibling).runId).toBe("second")
  })

  it("ends every live run when a new turn opens, on elements the call names and on others", () => {
    const opened = openRegister("", "")
    const third = elementId("258.9")
    let register = opened
    for (const command of [
      { command: "add", node, floor: "", route: "" },
      { command: "add", node: sibling, floor: "", route: "" },
      { command: "add", node: third, floor: "", route: "" },
      { command: "start", runId: "first", node },
      { command: "start", runId: "second", node: sibling },
      { command: "start", runId: "third", node: third },
    ] as const) {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    const edit = {
      deck: "deck",
      base: 0,
      changes: [
        { value: "a", node, readAt: 0 },
        { value: "b", node: sibling, readAt: 0 },
      ],
    }
    const result = openRun(register, edit, () => "fresh")
    if (!result.ok) throw new Error(result.refusal)
    expect(result.caller.runId).toBe("fresh")
    expect(bodyOf(result.register).runId).toBe("fresh")
    expect(bodyOf(result.register, sibling).runId).toBe("fresh")
    expect(bodyOf(result.register, third).phase).toBe("stopped")
  })

  it("stops an older run live on a named element, then starts the candidate and clears the guard", () => {
    const first = openRun(openRegister("", ""), firstEdit, () => "one")
    if (!first.ok) throw new Error(first.refusal)
    const landed = decide(first.register, { command: "agent", runId: "one", readAt: 0, value: "21", node })
    if (landed.decision !== "apply") throw new Error(landed.code)
    const typed = decide(landed.register, { command: "person", value: "typed", node })
    if (typed.decision !== "apply") throw new Error(typed.code)
    expect(bodyOf(typed.register).guarded).toBe(true)
    const again = openRun(typed.register, secondEdit, () => "fresh")
    if (!again.ok) throw new Error(again.refusal)
    expect(again.caller.runId).toBe("fresh")
    expect(bodyOf(again.register).runId).toBe("fresh")
    expect(bodyOf(again.register).guarded).toBe(false)
    expect(bodyOf(again.register).landed).toEqual(bodyOf(typed.register).landed)
    expect(bodyOf(typed.register).runId).toBe("one")
  })

  it("does not take a run id from the client", () => {
    const refused = openRun(
      openRegister("", ""),
      {
        deck: "deck",
        base: 0,
        changes: [{ value: "21", node, readAt: 0 }],
        runId: "client-run",
        readAt: 4,
        actor: "person",
      },
      () => "one",
    )
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.refusal).toBe("field")
  })
})

describe("afterWrite", () => {
  it("answers stale with the stored deck when the write loses", () => {
    const named = readDeckId("deck")
    if (!named.ok) throw new Error(named.refusal)
    const loaded = openDeck(named.deck)
    const node = elementId("258.7")
    const stored = decide(loaded.register, { command: "add", node, floor: "", route: "slide" })
    if (stored.decision !== "apply") throw new Error(stored.code)
    const won = decide(stored.register, { command: "person", value: "won", node })
    if (won.decision !== "apply") throw new Error(won.code)
    const storedDeck = { id: loaded.id, revision: 1, register: won.register }
    const computed = decide(stored.register, { command: "person", value: "lost", node })
    if (computed.decision !== "apply") throw new Error(computed.code)
    const landed: ToolResult = editLanded({ id: loaded.id, revision: 1, register: computed.register }, [node], "run")
    const lost = afterWrite(false, landed, storedDeck)
    expect(lost.ok).toBe(false)
    if (lost.ok) return
    expect(lost.refusal).toBe("stale")
    expect(lost.deck).toBe(storedDeck)
    const answer = { ok: false, revision: 1, refusal: "stale", elements: [{ node, value: "won", version: 1 }] }
    expect(lost.content).toEqual([
      { type: "text", text: editNext.stale },
      { type: "text", text: JSON.stringify(answer) },
    ])
    expect(lost.answer).toEqual(answer)
    expect(JSON.stringify(lost)).not.toContain("lost")
    expect(afterWrite(true, landed, loaded)).toBe(landed)
  })

  it("answers stale in the run sentence when a stop or undo loses its write", () => {
    const named = readDeckId("deck")
    if (!named.ok) throw new Error(named.refusal)
    const loaded = openDeck(named.deck)
    const stored = { ...loaded, revision: 4 }
    for (const op of ["stop_run", "undo_run"] as const) {
      const lost = afterWrite(false, runEnded({ ...loaded, revision: 1 }, op, "run"), stored)
      expect(lost.ok).toBe(false)
      if (lost.ok) return
      expect(lost.refusal).toBe("stale")
      expect(lost.deck).toBe(stored)
      expect(lost.answer).toEqual({ ok: false, revision: 4, refusal: "stale", elements: [] })
      expect(lost.content[0]).toEqual({ type: "text", text: runNext.stale })
    }
  })

  it("answers person-protected when the stored row shows a person edited the element during the run", () => {
    const named = readDeckId("deck")
    if (!named.ok) throw new Error(named.refusal)
    const loaded = openDeck(named.deck)
    const node = elementId("258.7")
    let register = loaded.register
    for (const command of [
      { command: "add", node, floor: "", route: "slide" },
      { command: "start", runId: "run", node },
    ] as const) {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    const computed = decide(register, { command: "agent", runId: "run", readAt: 0, value: "agent", node })
    if (computed.decision !== "apply") throw new Error(computed.code)
    const won = decide(register, { command: "person", value: "person", node })
    if (won.decision !== "apply") throw new Error(won.code)
    const storedDeck = { id: loaded.id, revision: 1, register: won.register }
    const landed: ToolResult = editLanded({ id: loaded.id, revision: 1, register: computed.register }, [node], "run")
    const lost = afterWrite(false, landed, storedDeck)
    expect(lost.ok).toBe(false)
    if (lost.ok) return
    expect(lost.refusal).toBe("person-protected")
    const answer = {
      ok: false,
      revision: 1,
      refusal: "person-protected",
      elements: [{ node, value: "person", version: 1, closed: true }],
    }
    expect(lost.content).toEqual([
      { type: "text", text: editNext["person-protected"] },
      { type: "text", text: JSON.stringify(answer) },
    ])
    expect(lost.answer).toEqual(answer)
  })
})
