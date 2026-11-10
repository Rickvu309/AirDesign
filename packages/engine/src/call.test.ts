import { parseNotifyKey, readDeckId } from "@airdesign/catalog"
import { currentValue, decide, elementId, history, version, type ElementId, type Register } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, openDeck, type Deck } from "./index.js"

const left = elementId("258.7")
const right = elementId("258.8")
const middle = elementId("258.9")

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

function nodeBody(register: Register, id: ElementId) {
  const body = register.elements[id]
  if (body === undefined) throw new Error("missing node")
  return body
}

function include(register: Register, id: ElementId): Register {
  if (register.nodes.includes(id)) return register
  const added = decide(register, { command: "add", node: id, floor: register.floor, route: register.route })
  if (added.decision !== "apply") throw new Error(added.code)
  return added.register
}

function runOn(register: Register, id: ElementId): Register {
  const started = decide(include(register, id), { command: "start", runId: "run", node: id })
  if (started.decision !== "apply") throw new Error(started.code)
  return started.register
}

function running(): Deck {
  const deck = opened()
  return { id: deck.id, revision: deck.revision, register: runOn(deck.register, left) }
}

function personOn(register: Register, id: ElementId, value: string): Register {
  const decision = decide(register, { command: "person", node: id, value })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

const person = { actor: "person" } as const
const agent = { actor: "agent", runId: "run" } as const

describe("call", () => {
  it("lands a person commit and a key for that revision", () => {
    const deck = opened()
    const result = call("commit_edits", deck, person, { deck: "deck", batch: [{ value: "hi", node: "258.7" }] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck.revision).toBe(1)
    expect(nodeBody(result.deck.register, left).landed).toEqual([{ actor: "person", value: "hi", visible: true }])
    expect(history(nodeBody(result.deck.register, left))).toEqual(["hi"])
    expect(parseNotifyKey(result.key)).toEqual({ ok: true, deck: deck.id, revision: 1 })
  })

  it("lands a second person commit after the first", () => {
    const first = call("commit_edits", opened(), person, { deck: "deck", batch: [{ value: "hi", node: "258.7" }] })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = call("commit_edits", first.deck, person, { deck: "deck", batch: [{ value: "ho", node: "258.7" }] })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.deck.revision).toBe(2)
    expect(nodeBody(second.deck.register, left).landed).toEqual([
      { actor: "person", value: "hi", visible: true },
      { actor: "person", value: "ho", visible: true },
    ])
    expect(history(nodeBody(second.deck.register, left))).toEqual(["hi", "ho"])
  })

  it("refuses a raw actor or principal", () => {
    const deck = opened()
    expect(
      call("commit_edits", deck, person, { deck: "deck", actor: "agent", batch: [{ value: "hi", node: "258.7" }] }),
    ).toEqual({
      ok: false,
      refusal: "field",
    })
    expect(
      call("commit_edits", deck, person, {
        deck: "deck",
        principal: "person",
        batch: [{ value: "hi", node: "258.7" }],
      }),
    ).toEqual({
      ok: false,
      refusal: "field",
    })
    expect(deck.revision).toBe(0)
    expect(deck.register.landed).toEqual([])
  })

  it("does not land a commit from an agent caller", () => {
    const deck = opened()
    expect(call("commit_edits", deck, agent, { deck: "deck", batch: [{ value: "hi", node: "258.7" }] })).toEqual({
      ok: false,
      refusal: "field",
    })
    expect(deck.revision).toBe(0)
    expect(deck.register.landed).toEqual([])
  })

  it("does not land an edit from a person caller", () => {
    const deck = opened()
    expect(
      call("edit_deck", deck, person, {
        deck: "deck",
        base: 0,
        changes: [{ value: "hi", node: "258.7", readAt: 0 }],
      }),
    ).toEqual({
      ok: false,
      refusal: "field",
    })
    expect(deck.revision).toBe(0)
    expect(deck.register.landed).toEqual([])
  })

  it("lands an edit whose base is behind the revision", () => {
    const deck = running()
    const readAt = version(nodeBody(deck.register, left))
    const result = call("edit_deck", deck, agent, {
      deck: "deck",
      base: deck.revision + 1,
      changes: [{ value: "hi", node: "258.7", readAt }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck.revision).toBe(1)
    expect(currentValue(nodeBody(result.deck.register, left))).toBe("hi")
    expect(deck.revision).toBe(0)
  })

  it("lands an agent edit at the version it read", () => {
    const deck = running()
    const readAt = version(nodeBody(deck.register, left))
    const result = call("edit_deck", deck, agent, {
      deck: "deck",
      base: deck.revision,
      changes: [{ value: "hi", node: "258.7", readAt }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck.revision).toBe(1)
    expect(nodeBody(result.deck.register, left).landed).toEqual([{ actor: "agent", value: "hi", visible: true }])
  })

  it("lands an agent edit of two changes", () => {
    const deck = running()
    const readAt = version(nodeBody(deck.register, left))
    const result = call("edit_deck", deck, agent, {
      deck: "deck",
      base: deck.revision,
      changes: [
        { value: "one", node: "258.7", readAt },
        { value: "two", node: "258.7", readAt },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck.revision).toBe(1)
    expect(nodeBody(result.deck.register, left).landed).toEqual([
      { actor: "agent", value: "one", visible: true },
      { actor: "agent", value: "two", visible: true },
    ])
  })

  it("refuses an agent batch after a person commit in the same run", () => {
    const started = running()
    const readAt = version(nodeBody(started.register, left))
    const agentLanded = call("edit_deck", started, agent, {
      deck: "deck",
      base: started.revision,
      changes: [{ value: "one", node: "258.7", readAt }],
    })
    expect(agentLanded.ok).toBe(true)
    if (!agentLanded.ok) return
    const personLanded = call("commit_edits", agentLanded.deck, person, {
      deck: "deck",
      batch: [{ value: "mine", node: "258.7" }],
    })
    expect(personLanded.ok).toBe(true)
    if (!personLanded.ok) return
    const register = personLanded.deck.register
    const again = version(nodeBody(personLanded.deck.register, left))
    expect(
      call("edit_deck", personLanded.deck, agent, {
        deck: "deck",
        base: personLanded.deck.revision,
        changes: [
          { value: "two", node: "258.7", readAt: again },
          { value: "three", node: "258.7", readAt: again },
        ],
      }),
    ).toEqual({ ok: false, refusal: "person-protected" })
    expect(personLanded.deck.register).toBe(register)
    expect(personLanded.deck.revision).toBe(2)
    expect(currentValue(nodeBody(personLanded.deck.register, left))).toBe("mine")
  })

  it("refuses an edit from a different run id after the batch", () => {
    const deck = running()
    const readAt = version(nodeBody(deck.register, left))
    const landed = call("edit_deck", deck, agent, {
      deck: "deck",
      base: deck.revision,
      changes: [
        { value: "one", node: "258.7", readAt },
        { value: "two", node: "258.7", readAt },
      ],
    })
    expect(landed.ok).toBe(true)
    if (!landed.ok) return
    const register = landed.deck.register
    const again = version(nodeBody(landed.deck.register, left))
    expect(
      call(
        "edit_deck",
        landed.deck,
        { actor: "agent", runId: "other" },
        {
          deck: "deck",
          base: landed.deck.revision,
          changes: [{ value: "no", node: "258.7", readAt: again }],
        },
      ),
    ).toEqual({ ok: false, refusal: "run-fenced" })
    expect(landed.deck.register).toBe(register)
    expect(landed.deck.revision).toBe(1)
    expect(currentValue(nodeBody(landed.deck.register, left))).toBe("two")
  })

  it("refuses an agent edit read ahead of the version", () => {
    const deck = running()
    const register = deck.register
    expect(
      call("edit_deck", deck, agent, {
        deck: "deck",
        base: deck.revision,
        changes: [{ value: "hi", node: "258.7", readAt: version(nodeBody(deck.register, left)) + 1 }],
      }),
    ).toEqual({ ok: false, refusal: "stale" })
    expect(deck.register).toBe(register)
    expect(deck.revision).toBe(0)
  })

  it("refuses a commit for a different deck id", () => {
    const deck = opened()
    expect(call("commit_edits", deck, person, { deck: "other", batch: [{ value: "hi", node: "258.7" }] })).toEqual({
      ok: false,
      refusal: "deck",
    })
    expect(deck.revision).toBe(0)
  })

  it("refuses an edit for a different deck id", () => {
    const deck = running()
    const register = deck.register
    expect(
      call("edit_deck", deck, agent, {
        deck: "other",
        base: deck.revision,
        changes: [{ value: "hi", node: "258.7", readAt: version(nodeBody(deck.register, left)) }],
      }),
    ).toEqual({ ok: false, refusal: "deck" })
    expect(deck.revision).toBe(0)
    expect(deck.register).toBe(register)
  })

  it("drops the batch when a later edit is refused", () => {
    const deck = opened()
    const near = { ...deck, register: { ...deck.register, bytes: 69_999_998 } }
    const before = JSON.parse(JSON.stringify(near)) as Deck
    expect(
      call("commit_edits", near, person, {
        deck: "deck",
        batch: [
          { value: "x", node: "258.7" },
          { value: "yy", node: "258.8" },
        ],
      }),
    ).toEqual({ ok: false, refusal: "limit" })
    expect(near).toEqual(before)
    expect(history(near.register)).toEqual([])
  })

  it("counts the bytes a commit lands", () => {
    const first = call("commit_edits", opened(), person, { deck: "deck", batch: [{ value: "hi", node: "258.7" }] })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.deck.register.bytes).toBe(2)
    const second = call("commit_edits", first.deck, person, { deck: "deck", batch: [{ value: "é", node: "258.7" }] })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.deck.register.bytes).toBe(4)
  })

  it("refuses a commit that would reach the byte limit", () => {
    const deck = opened()
    const full = { ...deck, register: { ...deck.register, bytes: 69_999_999 } }
    const register = full.register
    expect(call("commit_edits", full, person, { deck: "deck", batch: [{ value: "x", node: "258.7" }] })).toEqual({
      ok: false,
      refusal: "limit",
    })
    expect(full.register).toBe(register)
    const room = { ...deck, register: { ...deck.register, bytes: 69_999_998 } }
    const landed = call("commit_edits", room, person, { deck: "deck", batch: [{ value: "x", node: "258.7" }] })
    expect(landed.ok).toBe(true)
    if (!landed.ok) return
    expect(landed.deck.register.bytes).toBe(69_999_999)
  })

  it("lands one agent batch on two elements at different versions", () => {
    const deck = opened()
    let register = include(deck.register, left)
    register = include(register, right)
    register = personOn(register, left, "p")
    register = personOn(register, left, "q")
    register = runOn(register, left)
    register = runOn(register, right)
    const prepared = { id: deck.id, revision: deck.revision, register }
    const result = call("edit_deck", prepared, agent, {
      deck: "deck",
      base: prepared.revision,
      changes: [
        { node: "258.7", readAt: 2, value: "x" },
        { node: "258.8", readAt: 0, value: "y" },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(currentValue(nodeBody(result.deck.register, left))).toBe("x")
    expect(currentValue(nodeBody(result.deck.register, right))).toBe("y")
  })

  it("refuses an agent batch when one change read a stale version", () => {
    const deck = opened()
    let register = include(deck.register, left)
    register = include(register, right)
    register = personOn(register, left, "p")
    register = personOn(register, left, "q")
    register = runOn(register, left)
    register = runOn(register, right)
    const prepared = { id: deck.id, revision: deck.revision, register }
    const before = prepared.register
    expect(
      call("edit_deck", prepared, agent, {
        deck: "deck",
        base: prepared.revision,
        changes: [
          { node: "258.7", readAt: 1, value: "x" },
          { node: "258.8", readAt: 0, value: "y" },
        ],
      }),
    ).toEqual({ ok: false, refusal: "stale" })
    expect(prepared.register).toBe(before)
    expect(currentValue(nodeBody(prepared.register, left))).toBe("q")
    expect(currentValue(nodeBody(prepared.register, right))).toBe("")
  })

  it("lands an agent batch when a person committed to another element since", () => {
    const deck = opened()
    let register = include(deck.register, left)
    register = include(register, right)
    register = runOn(register, left)
    const prepared = { id: deck.id, revision: deck.revision, register }
    const base = prepared.revision
    const readAt = version(nodeBody(prepared.register, left))
    const committed = call("commit_edits", prepared, person, {
      deck: "deck",
      batch: [{ value: "p", node: "258.8" }],
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    expect(committed.deck.revision).toBe(base + 1)
    expect(currentValue(nodeBody(committed.deck.register, left))).toBe("")
    const edited = call("edit_deck", committed.deck, agent, {
      deck: "deck",
      base,
      changes: [{ node: "258.7", readAt, value: "x" }],
    })
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(currentValue(nodeBody(edited.deck.register, left))).toBe("x")
    expect(currentValue(nodeBody(edited.deck.register, right))).toBe("p")
  })

  it("refuses an agent batch when a person committed to the same element since", () => {
    const deck = opened()
    let register = include(deck.register, left)
    register = include(register, right)
    register = runOn(register, left)
    register = runOn(register, right)
    const prepared = { id: deck.id, revision: deck.revision, register }
    const base = prepared.revision
    const readAt = version(nodeBody(prepared.register, left))
    const other = version(nodeBody(prepared.register, right))
    const committed = call("commit_edits", prepared, person, {
      deck: "deck",
      batch: [{ value: "p", node: "258.7" }],
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    const edited = call("edit_deck", committed.deck, agent, {
      deck: "deck",
      base,
      changes: [
        { node: "258.7", readAt, value: "x" },
        { node: "258.8", readAt: other, value: "y" },
      ],
    })
    expect(edited.ok).toBe(false)
    expect(currentValue(nodeBody(committed.deck.register, left))).toBe("p")
    expect(currentValue(nodeBody(committed.deck.register, right))).toBe("")
  })

  it("refuses a stale middle change without landing either neighbor", () => {
    const deck = opened()
    let register = include(deck.register, left)
    register = include(register, middle)
    register = include(register, right)
    register = personOn(register, middle, "p")
    register = personOn(register, middle, "q")
    register = runOn(register, left)
    register = runOn(register, middle)
    register = runOn(register, right)
    const prepared = { id: deck.id, revision: deck.revision, register }
    const before = prepared.register
    expect(version(nodeBody(prepared.register, left))).toBe(0)
    expect(version(nodeBody(prepared.register, middle))).toBe(2)
    expect(version(nodeBody(prepared.register, right))).toBe(0)
    expect(
      call("edit_deck", prepared, agent, {
        deck: "deck",
        base: prepared.revision,
        changes: [
          { node: "258.7", readAt: 0, value: "x" },
          { node: "258.9", readAt: 1, value: "y" },
          { node: "258.8", readAt: 0, value: "z" },
        ],
      }),
    ).toEqual({ ok: false, refusal: "stale" })
    expect(prepared.register).toBe(before)
    expect(currentValue(nodeBody(prepared.register, left))).toBe("")
    expect(currentValue(nodeBody(prepared.register, middle))).toBe("q")
    expect(currentValue(nodeBody(prepared.register, right))).toBe("")
  })

  it("refuses an agent change on an element without a run", () => {
    const fresh = opened()
    const freshRegister = fresh.register
    expect(
      call("edit_deck", fresh, agent, {
        deck: "deck",
        base: 0,
        changes: [{ value: "hi", node: "258.7", readAt: 0 }],
      }),
    ).toEqual({ ok: false, refusal: "run-fenced" })
    expect(fresh.register).toBe(freshRegister)
    expect(fresh.register.nodes).toEqual(freshRegister.nodes)
    const idleDeck = opened()
    const idle = { id: idleDeck.id, revision: idleDeck.revision, register: include(idleDeck.register, left) }
    const idleRegister = idle.register
    expect(
      call("edit_deck", idle, agent, {
        deck: "deck",
        base: 0,
        changes: [{ value: "hi", node: "258.7", readAt: 0 }],
      }),
    ).toEqual({ ok: false, refusal: "run-fenced" })
    expect(idle.register).toBe(idleRegister)
    expect(currentValue(nodeBody(idle.register, left))).toBe("")
  })

  it("keeps the first-touch floor and the deck floor when none is sent", () => {
    const named = call("commit_edits", opened(), person, {
      deck: "deck",
      batch: [{ value: "changed", node: "258.7", floor: "original" }],
    })
    expect(named.ok).toBe(true)
    if (!named.ok) return
    expect(nodeBody(named.deck.register, left).floor).toBe("original")
    const deck = opened()
    const inherited = { ...deck, register: { ...deck.register, floor: "inherited" } }
    const blank = call("commit_edits", inherited, person, {
      deck: "deck",
      batch: [{ value: "changed", node: "258.8" }],
    })
    expect(blank.ok).toBe(true)
    if (!blank.ok) return
    expect(nodeBody(blank.deck.register, right).floor).toBe("inherited")
  })

  it("ignores a new floor for an element that is already open", () => {
    const deck = opened()
    const register = include({ ...deck.register, floor: "stored" }, left)
    const prepared = { id: deck.id, revision: deck.revision, register }
    const result = call("commit_edits", prepared, person, {
      deck: "deck",
      batch: [{ value: "changed", node: "258.7", floor: "replacement" }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(nodeBody(result.deck.register, left).floor).toBe("stored")
  })

  it("leaves the floor out of the byte count", () => {
    const deck = opened()
    const room = { ...deck, register: { ...deck.register, bytes: 69_999_998 } }
    const landed = call("commit_edits", room, person, {
      deck: "deck",
      batch: [{ value: "x", node: "258.7", floor: "long floor" }],
    })
    expect(landed.ok).toBe(true)
    if (!landed.ok) return
    expect(currentValue(nodeBody(landed.deck.register, left))).toBe("x")
    expect(landed.deck.register.bytes).toBe(69_999_999)
  })

  it("applies person edits to one element in the order sent", () => {
    const result = call("commit_edits", opened(), person, {
      deck: "deck",
      batch: [
        { value: "first", node: "258.7" },
        { value: "second", node: "258.7" },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(history(nodeBody(result.deck.register, left))).toEqual(["first", "second"])
    expect(currentValue(nodeBody(result.deck.register, left))).toBe("second")
  })

  it("lands a value of 8000 bytes", () => {
    const value = "x".repeat(8_000)
    const landed = call("commit_edits", opened(), person, { deck: "deck", batch: [{ value, node: "258.7" }] })
    expect(landed.ok).toBe(true)
    if (!landed.ok) return
    expect(currentValue(nodeBody(landed.deck.register, left))).toBe(value)
    expect(landed.deck.register.bytes).toBe(8_000)
  })

  it("refuses a value of 8001 bytes", () => {
    const value = `${"x".repeat(7_999)}é`
    const deck = opened()
    const before = deck.register
    expect(
      call("commit_edits", deck, person, {
        deck: "deck",
        batch: [
          { value: "ok", node: "258.7" },
          { value, node: "258.8" },
        ],
      }),
    ).toEqual({ ok: false, refusal: "limit" })
    expect(deck.register).toBe(before)
    expect(history(deck.register)).toEqual([])
    let register = include(deck.register, left)
    register = include(register, right)
    register = runOn(register, left)
    register = runOn(register, right)
    const prepared = { id: deck.id, revision: deck.revision, register }
    const agentBefore = prepared.register
    expect(
      call("edit_deck", prepared, agent, {
        deck: "deck",
        base: 0,
        changes: [
          { value: "ok", node: "258.7", readAt: 0 },
          { value, node: "258.8", readAt: 0 },
        ],
      }),
    ).toEqual({ ok: false, refusal: "limit" })
    expect(prepared.register).toBe(agentBefore)
    expect(currentValue(nodeBody(prepared.register, left))).toBe("")
    expect(currentValue(nodeBody(prepared.register, right))).toBe("")
  })

  it("opens an element on its first edit", () => {
    const filed = elementId("382.5")
    const landed = call("commit_edits", opened(), person, {
      deck: "deck",
      batch: [{ value: "kept", node: "382.5", floor: "file text" }],
    })
    expect(landed.ok).toBe(true)
    if (!landed.ok) return
    expect(landed.deck.register.nodes).toContain(filed)
    expect(nodeBody(landed.deck.register, filed).floor).toBe("file text")
    expect(currentValue(nodeBody(landed.deck.register, filed))).toBe("kept")
  })

  it("refuses one agent value of ten megabytes", () => {
    const filed = elementId("382.5")
    const deck = opened()
    const prepared = { id: deck.id, revision: deck.revision, register: runOn(deck.register, filed) }
    const before = prepared.register
    expect(
      call("edit_deck", prepared, agent, {
        deck: "deck",
        base: 0,
        changes: [{ value: "x".repeat(10 * 1024 * 1024), node: "382.5", readAt: 0 }],
      }),
    ).toEqual({ ok: false, refusal: "limit" })
    expect(prepared.register).toBe(before)
  })
})
