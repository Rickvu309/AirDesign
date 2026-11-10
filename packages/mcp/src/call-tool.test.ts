import { readDeckId } from "@airdesign/catalog"
import { openTab, type Tab } from "@airdesign/device"
import { decide, elementId, version, type ElementId, type Register } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import { callTool, emptyLog, type AgentCaller, type Session } from "./index.js"

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
  if (tab === undefined) return { caller, deck, log, now }
  return { caller, deck, tab, log, now }
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
    expect(result.content).toEqual([{ type: "text", text: "Landed revision 1." }])
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
      { deck: "deck", base: 0, changes: [{ value: "21" }] },
      { caller: { actor: "agent", runId: "host-run", readAt: 9 }, deck, log: emptyLog(), now: 0 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck.revision).toBe(1)
    expect(result.deck.register.phase).toBe("running")
    expect(result.deck.register.runId).toBe("host-run")
    expect(result.deck.register.landed).toEqual([{ actor: "agent", value: "21", visible: true }])
    expect(deck.register.phase).toBe("idle")
    expect(deck.register.landed).toEqual([])
  })

  it("keeps the running element's run id when the session supplies another", () => {
    const deck = running()
    const result = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "21" }] },
      { caller: { actor: "agent", runId: "other", readAt: 4 }, deck, log: emptyLog(), now: 0 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck.register.runId).toBe("run")
    expect(result.deck.register.landed).toEqual([{ actor: "agent", value: "21", visible: true }])
    expect(deck.register.runId).toBe("run")
    expect(deck.register.landed).toEqual([])
  })

  it("does not take a run id or a readAt from the arguments", () => {
    const deck = running()
    const result = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "21" }], runId: "client-run", readAt: 5 },
      sessionFor(deck),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("field")
    expect(result.deck).toBe(deck)
    expect(deck.register.runId).toBe("run")
    expect(deck.register.landed).toEqual([])
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
