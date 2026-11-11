import { readDeckId } from "@airdesign/catalog"
import { openTab, type Tab } from "@airdesign/device"
import { decide, elementId, version, type ElementId, type Register } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import { callTool, editNext, emptyLog, memoryTurns, type AgentCaller, type Session, type Turns } from "./index.js"

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

const node = elementId("258.7")

function nodeBody(register: Register, id: ElementId = node) {
  const body = register.elements[id]
  if (body === undefined) throw new Error("missing node")
  return body
}

function running(): Deck {
  const deck = opened()
  const added = decide(deck.register, {
    command: "add",
    node,
    floor: deck.register.floor,
    route: deck.register.route,
  })
  if (added.decision !== "apply") throw new Error(added.code)
  const started = decide(added.register, { command: "start", runId: "run", node })
  if (started.decision !== "apply") throw new Error(started.code)
  return { id: deck.id, revision: deck.revision, register: started.register }
}

function callerFor(): AgentCaller {
  return { actor: "agent", runId: "run" }
}

function sessionFor(deck: Deck, tab?: Tab): Session {
  const caller = callerFor()
  const log = emptyLog()
  const now = 0
  const turns = memoryTurns()
  if (tab === undefined) return { caller, deck, log, now, turns }
  return { caller, deck, tab, log, now, turns }
}

function turnOn(deck: Deck, runId: string): Turns {
  const turns = memoryTurns()
  turns.write(deck.id, { runId, lastCall: 0, revision: deck.revision })
  return turns
}

function inTurn(deck: Deck, runId: string): Session {
  return { ...sessionFor(deck), turns: turnOn(deck, runId) }
}

function openedTab(fields: {
  readonly presence: "hidden" | "visible"
  readonly elapsedMs: number
  readonly version: number
  readonly authority: number
}): Tab {
  const tab = openTab(fields)
  if (tab === null) throw new Error("closed")
  return tab
}

const forbidden = [
  "actor",
  "command",
  "principal",
  "person",
  "agent",
  "surface",
  "onBehalfOf",
  "model",
  "prompt",
  "tools",
  "max_tokens",
  "messages",
  "readAt",
  "runId",
] as const

describe("callTool", () => {
  it("lands an edit and returns the new deck", () => {
    const deck = running()
    const result = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] },
      sessionFor(deck),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck).not.toBe(deck)
    expect(result.deck.revision).toBe(1)
    expect(nodeBody(result.deck.register).landed).toEqual([
      { actor: "agent", value: "21", visible: true, runId: "run" },
    ])
    expect(deck.revision).toBe(0)
    expect(nodeBody(deck.register).landed).toEqual([])
    const answer = { ok: true, revision: 1, runId: "run", elements: [{ node: "258.7", value: "21", version: 1 }] }
    expect(result.content).toEqual([
      { type: "text", text: "Landed revision 1." },
      { type: "text", text: JSON.stringify(answer) },
    ])
    expect(result.answer).toEqual(answer)
  })

  it("refuses a client field and leaves the deck", () => {
    const deck = running()
    const register = deck.register
    for (const key of forbidden) {
      const result = callTool(
        "airdesign_edit_deck",
        { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }], [key]: "no" },
        sessionFor(deck),
      )
      expect(result.ok, key).toBe(false)
      if (result.ok) return
      expect(result.refusal, key).toBe("field")
      expect(result.deck, key).toBe(deck)
      expect(deck.register, key).toBe(register)
      expect(deck.register.landed, key).toEqual([])
    }
  })

  it("refuses an actor inside a change", () => {
    const deck = running()
    const result = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0, actor: "person" }] },
      sessionFor(deck),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("field")
    expect(result.deck).toBe(deck)
    expect(deck.register.landed).toEqual([])
  })

  it("lands an edit whose base is behind the revision", () => {
    const deck = running()
    const result = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 1, changes: [{ value: "22", node: "258.7", readAt: version(nodeBody(deck.register)) }] },
      sessionFor(deck),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck).not.toBe(deck)
    expect(result.deck.revision).toBe(1)
    expect(nodeBody(result.deck.register).landed).toEqual([
      { actor: "agent", value: "22", visible: true, runId: "run" },
    ])
    expect(deck.revision).toBe(0)
  })

  it("refuses a different deck id", () => {
    const deck = running()
    const result = callTool(
      "airdesign_edit_deck",
      { deck: "other", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] },
      sessionFor(deck),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("deck")
    expect(result.deck).toBe(deck)
    expect(deck.revision).toBe(0)
  })

  it("starts an idle element and lands", () => {
    const deck = opened()
    const result = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] },
      { caller: { actor: "agent", runId: "host-run" }, deck, log: emptyLog(), now: 0, turns: memoryTurns() },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck.revision).toBe(1)
    const body = nodeBody(result.deck.register)
    expect(body.phase).toBe("running")
    expect(body.runId).toBe("host-run")
    expect(body.landed).toEqual([{ actor: "agent", value: "21", visible: true, runId: "host-run" }])
    expect(deck.register.elements).toEqual({})
  })

  it("keeps the running element's run id when the session supplies another", () => {
    const deck = running()
    const result = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] },
      { caller: { actor: "agent", runId: "other" }, deck, log: emptyLog(), now: 0, turns: turnOn(deck, "run") },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const body = nodeBody(result.deck.register)
    expect(body.runId).toBe("run")
    expect(body.landed).toEqual([{ actor: "agent", value: "21", visible: true, runId: "run" }])
    expect(nodeBody(deck.register).runId).toBe("run")
    expect(nodeBody(deck.register).landed).toEqual([])
  })

  it("does not take a run id or a readAt from the arguments", () => {
    const deck = running()
    const result = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }], runId: "client-run", readAt: 5 },
      sessionFor(deck),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("field")
    expect(result.deck).toBe(deck)
    expect(nodeBody(deck.register).runId).toBe("run")
    expect(nodeBody(deck.register).landed).toEqual([])
  })

  it("starts a new run on a stopped element and keeps the earlier run's rows", () => {
    const deck = running()
    const landed = decide(deck.register, { command: "agent", runId: "run", readAt: 0, value: "old", node })
    if (landed.decision !== "apply") throw new Error(landed.code)
    const stopped = decide(landed.register, { command: "stop", runId: "run", node })
    if (stopped.decision !== "apply") throw new Error(stopped.code)
    const after = { id: deck.id, revision: deck.revision, register: stopped.register }
    const result = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 1 }] },
      { caller: { actor: "agent", runId: "fresh" }, deck: after, log: emptyLog(), now: 0, turns: memoryTurns() },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const body = nodeBody(result.deck.register)
    expect(body.phase).toBe("running")
    expect(body.runId).toBe("fresh")
    expect(body.landed).toEqual([
      { actor: "agent", value: "old", visible: true, runId: "run" },
      { actor: "agent", value: "21", visible: true, runId: "fresh" },
    ])
    expect(nodeBody(after.register).phase).toBe("stopped")
    expect(nodeBody(after.register).landed).toEqual([{ actor: "agent", value: "old", visible: true, runId: "run" }])
  })

  it("answers run-fenced for one call naming elements under two runs, and each lands in its own call", () => {
    const deck = opened()
    const other = elementId("258.8")
    let register = deck.register
    for (const command of [
      { command: "add", node, floor: "", route: "slide" },
      { command: "add", node: other, floor: "", route: "slide" },
      { command: "start", runId: "held", node },
      { command: "start", runId: "other", node: other },
    ] as const) {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    const before = { id: deck.id, revision: 0, register }
    const both = callTool(
      "airdesign_edit_deck",
      {
        deck: "deck",
        base: 0,
        changes: [
          { value: "a", node: "258.7", readAt: 0 },
          { value: "b", node: "258.8", readAt: 0 },
        ],
      },
      inTurn(before, "held"),
    )
    expect(both.ok).toBe(false)
    if (both.ok) return
    expect(both.refusal).toBe("run-fenced")
    expect(both.deck).toBe(before)
    expect(both.content[0]).toEqual({ type: "text", text: editNext["run-fenced"] })
    expect(both.answer).toEqual({
      ok: false,
      revision: 0,
      refusal: "run-fenced",
      elements: [
        { node: "258.7", value: "", version: 0 },
        { node: "258.8", value: "", version: 0 },
      ],
    })
    const first = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "a", node: "258.7", readAt: 0 }] },
      inTurn(before, "held"),
    )
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 1, changes: [{ value: "b", node: "258.8", readAt: 0 }] },
      inTurn(first.deck, "other"),
    )
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(nodeBody(second.deck.register).landed).toEqual([
      { actor: "agent", value: "a", visible: true, runId: "held" },
    ])
    expect(nodeBody(second.deck.register, other).landed).toEqual([
      { actor: "agent", value: "b", visible: true, runId: "other" },
    ])
  })

  it("starts a stopped element under the run live on another named element, as the engine answers", () => {
    const deck = opened()
    const other = elementId("258.8")
    let register = deck.register
    for (const command of [
      { command: "add", node, floor: "", route: "slide" },
      { command: "add", node: other, floor: "", route: "slide" },
      { command: "start", runId: "held", node },
      { command: "start", runId: "ended", node: other },
      { command: "stop", runId: "ended", node: other },
    ] as const) {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    const before = { id: deck.id, revision: 0, register }
    const result = callTool(
      "airdesign_edit_deck",
      {
        deck: "deck",
        base: 0,
        changes: [
          { value: "a", node: "258.7", readAt: 0 },
          { value: "b", node: "258.8", readAt: 0 },
        ],
      },
      inTurn(before, "held"),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.answer?.ok === true && result.answer.runId).toBe("held")
    expect(nodeBody(result.deck.register, other).runId).toBe("held")
  })

  it("answers stale with the send-again sentence on an open element while another element is closed", () => {
    const deck = opened()
    const other = elementId("258.8")
    let register = deck.register
    for (const command of [
      { command: "add", node, floor: "", route: "slide" },
      { command: "add", node: other, floor: "", route: "slide" },
      { command: "person", value: "before", node: other },
      { command: "start", runId: "run", node },
      { command: "start", runId: "run", node: other },
      { command: "person", value: "typed", node },
    ] as const) {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    const before = { id: deck.id, revision: 0, register }
    const stale = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "agent", node: "258.8", readAt: 0 }] },
      sessionFor(before),
    )
    expect(stale.ok).toBe(false)
    if (stale.ok) return
    expect(stale.refusal).toBe("stale")
    expect(stale.content[0]).toEqual({ type: "text", text: editNext.stale })
    expect(stale.answer).toEqual({
      ok: false,
      revision: 0,
      refusal: "stale",
      elements: [{ node: "258.8", value: "before", version: 1 }],
    })
    const sent = stale.answer?.elements[0]
    if (sent === undefined) throw new Error("missing element")
    const resent = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "agent", node: sent.node, readAt: sent.version }] },
      sessionFor(before),
    )
    expect(resent.ok).toBe(true)
    if (!resent.ok) return
    expect(nodeBody(resent.deck.register, other).landed.at(-1)).toEqual({
      actor: "agent",
      value: "agent",
      visible: true,
      runId: "run",
    })
    expect(nodeBody(resent.deck.register).guarded).toBe(true)
  })

  it("shows a stopped element as open and lands on it under a new run", () => {
    const deck = opened()
    let register = deck.register
    for (const command of [
      { command: "add", node, floor: "", route: "slide" },
      { command: "start", runId: "old", node },
      { command: "person", value: "typed", node },
      { command: "stop", runId: "old", node },
    ] as const) {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    expect(nodeBody(register).guarded).toBe(true)
    expect(nodeBody(register).phase).toBe("stopped")
    const before = { id: deck.id, revision: 0, register }
    const stale = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "agent", node: "258.7", readAt: 0 }] },
      sessionFor(before),
    )
    expect(stale.ok).toBe(false)
    if (stale.ok) return
    expect(stale.refusal).toBe("stale")
    expect(stale.answer?.elements).toEqual([{ node: "258.7", value: "typed", version: 1 }])
    expect(stale.answer?.elements[0]?.closed).not.toBe(true)
    const landed = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "agent", node: "258.7", readAt: 1 }] },
      sessionFor(before),
    )
    expect(landed.ok).toBe(true)
    if (!landed.ok) return
    expect(nodeBody(landed.deck.register).runId).toBe("run")
    expect(nodeBody(landed.deck.register).landed.at(-1)).toEqual({
      actor: "agent",
      value: "agent",
      visible: true,
      runId: "run",
    })
    expect(landed.answer?.elements).toEqual([{ node: "258.7", value: "agent", version: 2 }])
  })

  it("refuses an unknown tool", () => {
    const deck = running()
    const result = callTool("airdesign_missing", { deck: "deck" }, sessionFor(deck))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("field")
    expect(result.deck).toBe(deck)
  })

  it("returns the reach code and does not capture", () => {
    const rows: { readonly tab?: Tab; readonly refusal: string; readonly next: string }[] = [
      {
        refusal: "no-open-tab",
        next: "Open the deck in AirDesign, then try again.",
      },
      {
        tab: { presence: "absent" },
        refusal: "no-open-tab",
        next: "Open the deck in AirDesign, then try again.",
      },
      {
        tab: openedTab({ presence: "hidden", elapsedMs: 0, version: 1, authority: 1 }),
        refusal: "tab-hidden",
        next: "Show the AirDesign tab, then try again.",
      },
      {
        tab: openedTab({ presence: "visible", elapsedMs: 30000, version: 1, authority: 1 }),
        refusal: "tab-timeout",
        next: "The tab did not answer. Show the AirDesign tab, then try again.",
      },
      {
        tab: openedTab({ presence: "visible", elapsedMs: 0, version: 2, authority: 1 }),
        refusal: "tab-outdated",
        next: "Reload the AirDesign tab, then try again.",
      },
      {
        tab: openedTab({ presence: "visible", elapsedMs: 0, version: 1, authority: 1 }),
        refusal: "device",
        next: "Capture runs in the open tab. This server did not capture a slide.",
      },
    ]
    for (const row of rows) {
      const deck = running()
      const register = deck.register
      const result = callTool("airdesign_capture_slide", { deck: "deck" }, sessionFor(deck, row.tab))
      expect(result.ok, row.refusal).toBe(false)
      if (result.ok) return
      expect(result.refusal, row.refusal).toBe(row.refusal)
      expect(result.next, row.refusal).toBe(row.next)
      expect(result.content, row.refusal).toEqual([{ type: "text", text: row.next }])
      expect(result.deck, row.refusal).toBe(deck)
      expect(deck.register, row.refusal).toBe(register)
    }
  })

  it("refuses a capture for a different deck id", () => {
    const deck = running()
    const result = callTool("airdesign_capture_slide", { deck: "other" }, sessionFor(deck))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("deck")
    expect(result.next).toBeUndefined()
    expect(result.content).toEqual([{ type: "text", text: "deck" }])
    expect(result.deck).toBe(deck)
    expect(deck.register.landed).toEqual([])
  })

  it("refuses a capture argument the catalog does not read", () => {
    const deck = running()
    const extra = callTool("airdesign_capture_slide", { deck: "deck", actor: "agent" }, sessionFor(deck))
    expect(extra.ok).toBe(false)
    if (extra.ok) return
    expect(extra.refusal).toBe("field")
    expect(extra.deck).toBe(deck)
    const other = callTool("airdesign_capture_slide", { deck: "bad id" }, sessionFor(deck))
    expect(other.ok).toBe(false)
    if (other.ok) return
    expect(other.refusal).toBe("deck")
    expect(deck.register.landed).toEqual([])
  })
})
