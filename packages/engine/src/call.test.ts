import { parseNotifyKey, readDeckId } from "@airdesign/catalog"
import {
  currentValue,
  decide,
  decideUndo,
  elementId,
  history,
  version,
  type ElementId,
  type Register,
} from "@airdesign/document"
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
    expect(nodeBody(result.deck.register, left).landed).toEqual([
      { actor: "agent", value: "hi", visible: true, runId: "run" },
    ])
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
      { actor: "agent", value: "one", visible: true, runId: "run" },
      { actor: "agent", value: "two", visible: true, runId: "run" },
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

  it("lands a floor of 8000 bytes", () => {
    const floor = "x".repeat(8_000)
    const deck = opened()
    const person8000 = call("commit_edits", deck, person, {
      deck: "deck",
      batch: [{ value: "hi", node: "258.7", floor }],
    })
    expect(person8000.ok).toBe(true)
    if (!person8000.ok) return
    expect(nodeBody(person8000.deck.register, left).floor).toBe(floor)
    expect(person8000.deck.register.bytes).toBe(2)
    const prepared = running()
    const agent8000 = call("edit_deck", prepared, agent, {
      deck: "deck",
      base: prepared.revision,
      changes: [{ value: "hi", node: "258.7", floor, readAt: 0 }],
    })
    expect(agent8000.ok).toBe(true)
    if (!agent8000.ok) return
    expect(currentValue(nodeBody(agent8000.deck.register, left))).toBe("hi")
    expect(agent8000.deck.register.bytes).toBe(prepared.register.bytes + 2)
  })

  it("refuses a floor of 8001 bytes", () => {
    const floors = [`${"x".repeat(8_000)}x`, `${"x".repeat(7_999)}é`, `${"x".repeat(7_998)}€`, `${"x".repeat(7_997)}😀`]
    for (const floor of floors) {
      const deck = opened()
      const before = deck.register
      expect(
        call("commit_edits", deck, person, {
          deck: "deck",
          batch: [
            { value: "ok", node: "258.7" },
            { value: "hi", node: "258.8", floor },
          ],
        }),
      ).toEqual({ ok: false, refusal: "limit" })
      expect(deck.register).toBe(before)
      expect(history(deck.register)).toEqual([])
      const prepared = running()
      const agentBefore = prepared.register
      expect(
        call("edit_deck", prepared, agent, {
          deck: "deck",
          base: prepared.revision,
          changes: [
            { value: "ok", node: "258.7", readAt: 0 },
            { value: "hi", node: "258.8", floor, readAt: 0 },
          ],
        }),
      ).toEqual({ ok: false, refusal: "limit" })
      expect(prepared.register).toBe(agentBefore)
      expect(currentValue(nodeBody(prepared.register, left))).toBe("")
      const open = opened()
      const openRegister = include(open.register, left)
      const openDeck = { id: open.id, revision: open.revision, register: openRegister }
      expect(
        call("commit_edits", openDeck, person, { deck: "deck", batch: [{ value: "hi", node: "258.7", floor }] }),
      ).toEqual({ ok: false, refusal: "limit" })
      expect(openDeck.register).toBe(openRegister)
      expect(
        call("edit_deck", prepared, agent, {
          deck: "deck",
          base: prepared.revision,
          changes: [{ value: "hi", node: "258.7", floor, readAt: 0 }],
        }),
      ).toEqual({ ok: false, refusal: "limit" })
      expect(prepared.register).toBe(agentBefore)
    }
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

  function finishedRun(): { deck: Deck; register: Register } {
    const started = running()
    const first = call("edit_deck", started, agent, {
      deck: "deck",
      base: started.revision,
      changes: [{ value: "one", node: "258.7", readAt: version(nodeBody(started.register, left)) }],
    })
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error("first run refused")
    const stopped = decide(first.deck.register, { command: "stop", runId: "run", node: left })
    expect(stopped.decision).toBe("apply")
    if (stopped.decision !== "apply") throw new Error(stopped.code)
    return { deck: first.deck, register: stopped.register }
  }

  it("lands a second run on an element a finished run edited", () => {
    const finished = finishedRun()
    const again = decide(finished.register, { command: "start", runId: "next", node: left })
    expect(again.decision).toBe("apply")
    if (again.decision !== "apply") return
    const deck = { id: finished.deck.id, revision: finished.deck.revision, register: again.register }
    const second = call(
      "edit_deck",
      deck,
      { actor: "agent", runId: "next" },
      {
        deck: "deck",
        base: deck.revision,
        changes: [{ value: "two", node: "258.7", readAt: version(nodeBody(deck.register, left)) }],
      },
    )
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(nodeBody(second.deck.register, left).landed).toEqual([
      { actor: "agent", value: "one", visible: true, runId: "run" },
      { actor: "agent", value: "two", visible: true, runId: "next" },
    ])
    expect(history(nodeBody(second.deck.register, left))).toEqual(["one", "two"])
  })

  it("a second run while the first is live stays fenced", () => {
    const started = running()
    const landed = call("edit_deck", started, agent, {
      deck: "deck",
      base: started.revision,
      changes: [{ value: "one", node: "258.7", readAt: version(nodeBody(started.register, left)) }],
    })
    expect(landed.ok).toBe(true)
    if (!landed.ok) return
    expect(decide(landed.deck.register, { command: "start", runId: "next", node: left })).toEqual({
      decision: "refuse",
      code: "run-fenced",
    })
    const register = landed.deck.register
    expect(
      call(
        "edit_deck",
        landed.deck,
        { actor: "agent", runId: "next" },
        {
          deck: "deck",
          base: landed.deck.revision,
          changes: [{ value: "two", node: "258.7", readAt: version(nodeBody(landed.deck.register, left)) }],
        },
      ),
    ).toEqual({ ok: false, refusal: "run-fenced" })
    expect(landed.deck.register).toBe(register)
  })

  it("undo of the first run keeps the second run's value", () => {
    const finished = finishedRun()
    const again = decide(finished.register, { command: "start", runId: "next", node: left })
    expect(again.decision).toBe("apply")
    if (again.decision !== "apply") return
    const deck = { id: finished.deck.id, revision: finished.deck.revision, register: again.register }
    const second = call(
      "edit_deck",
      deck,
      { actor: "agent", runId: "next" },
      {
        deck: "deck",
        base: deck.revision,
        changes: [{ value: "two", node: "258.7", readAt: version(nodeBody(deck.register, left)) }],
      },
    )
    expect(second.ok).toBe(true)
    if (!second.ok) return
    const ended = decide(second.deck.register, { command: "stop", runId: "next", node: left })
    expect(ended.decision).toBe("apply")
    if (ended.decision !== "apply") return
    const undone = decideUndo(nodeBody(ended.register, left), "run")
    expect(undone.decision).toBe("apply")
    if (undone.decision !== "apply") return
    expect(undone.body.phase).toBe("stopped")
    expect(undone.body.runId).toBe("next")
    expect(undone.body.landed).toEqual([
      { actor: "agent", value: "one", visible: false, runId: "run" },
      { actor: "agent", value: "two", visible: true, runId: "next" },
    ])
    expect(history(undone.body)).toEqual(["two"])
  })
})

describe("run operations", () => {
  type Answer = { readonly ok: true; readonly deck: Deck; readonly key: string }

  function answered<Result extends { readonly ok: boolean }>(result: Result): Result & Answer {
    if (!result.ok) throw new Error(JSON.stringify(result))
    return result as Result & Answer
  }

  function agentOf(runId: string) {
    return { actor: "agent", runId } as const
  }

  function start(deck: Deck, runId: string, nodes: readonly ElementId[]) {
    return answered(
      call("start_run", deck, agentOf(runId), { deck: "deck", runId, elements: nodes.map((node) => ({ node })) }),
    )
  }

  function land(deck: Deck, runId: string, node: ElementId, value: string): Deck {
    const readAt = version(nodeBody(deck.register, node))
    return answered(
      call("edit_deck", deck, agentOf(runId), {
        deck: "deck",
        base: deck.revision,
        changes: [{ value, node, readAt }],
      }),
    ).deck
  }

  function stop(deck: Deck, runId: string): Deck {
    return answered(call("stop_run", deck, agentOf(runId), { deck: "deck", runId })).deck
  }

  function commit(deck: Deck, node: ElementId, value: string): Deck {
    return answered(call("commit_edits", deck, person, { deck: "deck", batch: [{ value, node }] })).deck
  }

  function undo(deck: Deck, runId: string) {
    return call("undo_run", deck, person, { deck: "deck", runId })
  }

  function shown(deck: Deck, node: ElementId): string {
    return currentValue(nodeBody(deck.register, node))
  }

  function phase(deck: Deck, node: ElementId): string {
    return nodeBody(deck.register, node).phase
  }

  function removed(deck: Deck, node: ElementId): Deck {
    const decision = decide(deck.register, { command: "remove", node })
    if (decision.decision !== "apply") throw new Error(decision.code)
    return { ...deck, register: decision.register }
  }

  function restored(deck: Deck, node: ElementId): Deck {
    return { ...deck, register: include(deck.register, node) }
  }

  function floorsReady(): Deck {
    const deck = opened()
    let register = deck.register
    for (const [node, floor] of [
      [left, "left before"],
      [right, "right before"],
      [middle, "middle before"],
    ] as const) {
      const added = decide(register, { command: "add", node, floor, route: register.route })
      if (added.decision !== "apply") throw new Error(added.code)
      register = added.register
    }
    return { ...deck, register }
  }

  describe("undo_run", () => {
    it("undoes every element of a run in one call", () => {
      const before = commit(floorsReady(), middle, "a person wrote this")
      let deck = start(before, "run", [left, right, middle]).deck
      deck = land(deck, "run", left, "agent left")
      deck = land(deck, "run", right, "agent right")
      deck = land(deck, "run", middle, "agent middle")
      expect([shown(deck, left), shown(deck, right), shown(deck, middle)]).toEqual([
        "agent left",
        "agent right",
        "agent middle",
      ])
      const undone = answered(undo(deck, "run"))
      expect(undone.deck.revision).toBe(deck.revision + 1)
      expect(parseNotifyKey(undone.key)).toEqual({ ok: true, deck: deck.id, revision: deck.revision + 1 })
      expect(shown(undone.deck, left)).toBe("left before")
      expect(shown(undone.deck, right)).toBe("right before")
      expect(shown(undone.deck, middle)).toBe("a person wrote this")
      expect([phase(undone.deck, left), phase(undone.deck, right), phase(undone.deck, middle)]).toEqual([
        "undone",
        "undone",
        "undone",
      ])
      expect(nodeBody(undone.deck.register, middle).landed).toEqual([
        { actor: "person", value: "a person wrote this", visible: true },
        { actor: "agent", value: "agent middle", visible: false, runId: "run" },
      ])
    })

    it("keeps a person's edit made after the agent wrote", () => {
      let deck = start(floorsReady(), "run", [left]).deck
      deck = land(deck, "run", left, "agent left")
      deck = commit(deck, left, "the person's fix")
      const undone = answered(undo(deck, "run"))
      expect(shown(undone.deck, left)).toBe("the person's fix")
      expect(history(nodeBody(undone.deck.register, left))).toEqual(["the person's fix"])
    })

    it("undoes a run that started on two elements and landed on one", () => {
      let deck = start(floorsReady(), "run", [left, right]).deck
      deck = land(deck, "run", left, "agent left")
      const undone = answered(undo(deck, "run"))
      expect(shown(undone.deck, left)).toBe("left before")
      expect(shown(undone.deck, right)).toBe("right before")
      expect([phase(undone.deck, left), phase(undone.deck, right)]).toEqual(["undone", "undone"])
    })

    it("leaves an element the run never touched as it was", () => {
      let deck = commit(floorsReady(), middle, "untouched")
      const body = nodeBody(deck.register, middle)
      deck = land(start(deck, "run", [left]).deck, "run", left, "agent left")
      const undone = answered(undo(deck, "run"))
      expect(nodeBody(undone.deck.register, middle)).toBe(body)
    })

    it("refuses the whole undo when a later run is live on one element", () => {
      let deck = start(floorsReady(), "run", [left, right]).deck
      deck = land(deck, "run", left, "agent left")
      deck = land(deck, "run", right, "agent right")
      deck = stop(deck, "run")
      deck = land(start(deck, "later", [right]).deck, "later", right, "later right")
      const register = deck.register
      expect(undo(deck, "run")).toEqual({ ok: false, refusal: "run-fenced" })
      expect(deck.register).toBe(register)
      expect(shown(deck, left)).toBe("agent left")
      expect(phase(deck, left)).toBe("stopped")
      expect(shown(deck, right)).toBe("later right")
    })

    it("undoes the earlier run once the later one stops and keeps the later text", () => {
      let deck = start(floorsReady(), "run", [left, right]).deck
      deck = land(deck, "run", left, "agent left")
      deck = land(deck, "run", right, "agent right")
      deck = stop(deck, "run")
      deck = land(start(deck, "later", [right]).deck, "later", right, "later right")
      deck = stop(deck, "later")
      const undone = answered(undo(deck, "run"))
      expect(shown(undone.deck, left)).toBe("left before")
      expect(phase(undone.deck, left)).toBe("undone")
      expect(shown(undone.deck, right)).toBe("later right")
      expect(phase(undone.deck, right)).toBe("stopped")
      expect(nodeBody(undone.deck.register, right).runId).toBe("later")
    })

    it("undoes a live run without a stop and fences its next edit", () => {
      const deck = land(start(floorsReady(), "run", [left]).deck, "run", left, "agent left")
      const undone = answered(undo(deck, "run"))
      expect(phase(undone.deck, left)).toBe("undone")
      expect(
        call("edit_deck", undone.deck, agentOf("run"), {
          deck: "deck",
          base: undone.deck.revision,
          changes: [{ value: "again", node: left, readAt: version(nodeBody(undone.deck.register, left)) }],
        }),
      ).toEqual({ ok: false, refusal: "run-fenced" })
    })

    it("refuses an unknown run and changes nothing", () => {
      const deck = land(start(floorsReady(), "run", [left]).deck, "run", left, "agent left")
      expect(undo(deck, "ghost")).toEqual({ ok: false, refusal: "run-fenced" })
      expect(shown(deck, left)).toBe("agent left")
    })

    it("refuses a second undo of the same run", () => {
      const deck = land(start(floorsReady(), "run", [left, right]).deck, "run", left, "agent left")
      const undone = answered(undo(deck, "run"))
      expect(undo(undone.deck, "run")).toEqual({ ok: false, refusal: "run-fenced" })
    })

    it("undoes a run on an element that was removed, so it comes back without the agent's text", () => {
      let deck = start(floorsReady(), "run", [left, right]).deck
      deck = land(deck, "run", left, "agent left")
      deck = land(deck, "run", right, "agent right")
      deck = removed(deck, right)
      const nodes = deck.register.nodes
      const undone = answered(undo(deck, "run"))
      expect(undone.deck.register.nodes).toEqual(nodes)
      const back = restored(undone.deck, right)
      expect(shown(back, right)).toBe("right before")
      expect(phase(back, right)).toBe("undone")
    })

    it("undoes what a run wrote after it was undone and restarted elsewhere", () => {
      let deck = land(start(floorsReady(), "run", [left]).deck, "run", left, "agent left")
      deck = answered(undo(deck, "run")).deck
      deck = land(start(deck, "run", [right]).deck, "run", right, "agent right")
      const undone = answered(undo(deck, "run"))
      expect(shown(undone.deck, right)).toBe("right before")
      expect(shown(undone.deck, left)).toBe("left before")
    })

    it("lets an agent undo its own run", () => {
      const deck = land(start(floorsReady(), "run", [left]).deck, "run", left, "agent left")
      const undone = answered(call("undo_run", deck, agentOf("run"), { deck: "deck", runId: "run" }))
      expect(shown(undone.deck, left)).toBe("left before")
    })

    it("refuses an agent that names another agent's run", () => {
      const deck = land(start(floorsReady(), "run", [left]).deck, "run", left, "agent left")
      expect(call("undo_run", deck, agentOf("other"), { deck: "deck", runId: "run" })).toEqual({
        ok: false,
        refusal: "run-fenced",
      })
    })

    it("refuses a different deck and a malformed call", () => {
      const deck = start(floorsReady(), "run", [left]).deck
      expect(call("undo_run", deck, person, { deck: "other", runId: "run" })).toEqual({ ok: false, refusal: "deck" })
      expect(call("undo_run", deck, person, { deck: "deck" })).toEqual({ ok: false, refusal: "field" })
    })
  })

  describe("start_run", () => {
    it("opens a missing element with its floor and answers the run id", () => {
      const result = answered(
        call("start_run", opened(), agent, { deck: "deck", runId: "run", elements: [{ node: left, floor: "old" }] }),
      )
      expect(result.runId).toBe("run")
      expect(result.deck.revision).toBe(1)
      expect(parseNotifyKey(result.key)).toEqual({ ok: true, deck: result.deck.id, revision: 1 })
      expect(shown(result.deck, left)).toBe("old")
      expect(phase(result.deck, left)).toBe("running")
      expect(nodeBody(result.deck.register, left).runId).toBe("run")
    })

    it("keeps the floor of an element that is already open", () => {
      const deck = floorsReady()
      const result = answered(
        call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: left, floor: "new" }] }),
      )
      expect(shown(result.deck, left)).toBe("left before")
    })

    it("starts every named element in one revision", () => {
      const deck = opened()
      const result = start(deck, "run", [left, right, middle])
      expect(result.deck.revision).toBe(1)
      expect([phase(result.deck, left), phase(result.deck, right), phase(result.deck, middle)]).toEqual([
        "running",
        "running",
        "running",
      ])
    })

    it("joins the same run on a second start without raising the revision", () => {
      const first = start(opened(), "run", [left, right])
      const second = start(first.deck, "run", [left, right])
      expect(second.runId).toBe("run")
      expect(second.deck).toBe(first.deck)
      expect(second.key).toBe(first.key)
    })

    it("does not lose an agent's text when a second start joins", () => {
      const deck = land(start(opened(), "run", [left]).deck, "run", left, "agent left")
      expect(shown(start(deck, "run", [left]).deck, left)).toBe("agent left")
    })

    it("adds a new element to the live run", () => {
      const first = start(opened(), "run", [left])
      const second = start(first.deck, "run", [left, right])
      expect(second.runId).toBe("run")
      expect(second.deck.revision).toBe(first.deck.revision + 1)
      expect(nodeBody(second.deck.register, right).runId).toBe("run")
    })

    it("joins the run live on a named element and starts the rest under it", () => {
      const first = start(opened(), "run", [left])
      const second = answered(
        call("start_run", first.deck, agentOf("fresh"), {
          deck: "deck",
          runId: "fresh",
          elements: [{ node: right }, { node: left }],
        }),
      )
      expect(second.runId).toBe("run")
      expect(nodeBody(second.deck.register, left).runId).toBe("run")
      expect(nodeBody(second.deck.register, right).runId).toBe("run")
    })

    it("refuses when two named elements run different runs", () => {
      const one = start(opened(), "one", [left]).deck
      const both = start(one, "two", [right]).deck
      const register = both.register
      expect(
        call("start_run", both, agentOf("one"), {
          deck: "deck",
          runId: "one",
          elements: [{ node: middle }, { node: left }, { node: right }],
        }),
      ).toEqual({ ok: false, refusal: "run-fenced" })
      expect(both.register).toBe(register)
      expect(both.register.nodes).not.toContain(middle)
    })

    it("starts a new run beside a different run on an element it does not name", () => {
      const one = start(opened(), "one", [left]).deck
      const two = start(one, "two", [right])
      expect(two.runId).toBe("two")
      expect(nodeBody(two.deck.register, left).runId).toBe("one")
      expect(nodeBody(two.deck.register, right).runId).toBe("two")
    })

    it("starts a new run on an element whose run has stopped", () => {
      const deck = stop(land(start(opened(), "one", [left]).deck, "one", left, "one"), "one")
      const next = start(deck, "two", [left])
      expect(next.runId).toBe("two")
      expect(phase(next.deck, left)).toBe("running")
      expect(nodeBody(next.deck.register, left).runId).toBe("two")
    })

    it("starts a new run on an element whose run was undone", () => {
      const deck = answered(undo(land(start(opened(), "one", [left]).deck, "one", left, "one"), "one")).deck
      expect(phase(start(deck, "two", [left]).deck, left)).toBe("running")
    })

    it("refuses a run id that already wrote on a named element and starts nothing", () => {
      const deck = stop(land(start(opened(), "run", [left]).deck, "run", left, "one"), "run")
      const register = deck.register
      expect(
        call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: right }, { node: left }] }),
      ).toEqual({ ok: false, refusal: "run-fenced" })
      expect(deck.register).toBe(register)
    })

    it("refuses a floor over the value limit", () => {
      expect(
        call("start_run", opened(), agent, {
          deck: "deck",
          runId: "run",
          elements: [{ node: left, floor: "x".repeat(8001) }],
        }),
      ).toEqual({ ok: false, refusal: "limit" })
    })

    it("does not start a run for a person", () => {
      expect(call("start_run", opened(), person, { deck: "deck", runId: "run", elements: [{ node: left }] })).toEqual({
        ok: false,
        refusal: "field",
      })
    })

    it("refuses an agent that names a run other than its own", () => {
      expect(
        call("start_run", opened(), agentOf("other"), { deck: "deck", runId: "run", elements: [{ node: left }] }),
      ).toEqual({ ok: false, refusal: "run-fenced" })
    })

    it("refuses a different deck and a malformed call", () => {
      expect(call("start_run", opened(), agent, { deck: "other", runId: "run", elements: [{ node: left }] })).toEqual({
        ok: false,
        refusal: "deck",
      })
      expect(call("start_run", opened(), agent, { deck: "deck", runId: "run", elements: [] })).toEqual({
        ok: false,
        refusal: "batch",
      })
    })
  })

  describe("stop_run", () => {
    it("stops a run on every element it started on in one revision", () => {
      const deck = land(start(opened(), "run", [left, right]).deck, "run", left, "agent left")
      const result = answered(call("stop_run", deck, agent, { deck: "deck", runId: "run" }))
      expect(result.deck.revision).toBe(deck.revision + 1)
      expect(parseNotifyKey(result.key)).toEqual({ ok: true, deck: deck.id, revision: deck.revision + 1 })
      expect([phase(result.deck, left), phase(result.deck, right)]).toEqual(["stopped", "stopped"])
      expect(shown(result.deck, left)).toBe("agent left")
    })

    it("leaves a different run running", () => {
      const one = start(opened(), "one", [left]).deck
      const both = start(one, "two", [right]).deck
      const body = nodeBody(both.register, right)
      const result = stop(both, "one")
      expect(phase(result, left)).toBe("stopped")
      expect(nodeBody(result.register, right)).toBe(body)
    })

    it("leaves an element a later run took over", () => {
      let deck = land(start(opened(), "one", [left]).deck, "one", left, "one")
      deck = stop(deck, "one")
      deck = start(deck, "two", [left]).deck
      deck = start(deck, "one", [right]).deck
      const result = stop(deck, "one")
      expect(phase(result, right)).toBe("stopped")
      expect(phase(result, left)).toBe("running")
      expect(nodeBody(result.register, left).runId).toBe("two")
    })

    it("changes nothing when the run has already stopped", () => {
      const deck = stop(start(opened(), "run", [left]).deck, "run")
      const again = answered(call("stop_run", deck, agent, { deck: "deck", runId: "run" }))
      expect(again.deck).toBe(deck)
      expect(parseNotifyKey(again.key)).toEqual({ ok: true, deck: deck.id, revision: deck.revision })
    })

    it("stops a run on an element that was removed, so it does not come back running", () => {
      const deck = removed(start(opened(), "run", [left, right]).deck, right)
      expect(phase(restored(stop(deck, "run"), right), right)).toBe("stopped")
    })

    it("refuses an unknown run and changes nothing", () => {
      const deck = start(opened(), "run", [left]).deck
      expect(call("stop_run", deck, agentOf("ghost"), { deck: "deck", runId: "ghost" })).toEqual({
        ok: false,
        refusal: "run-fenced",
      })
      expect(phase(deck, left)).toBe("running")
    })

    it("does not stop a run for a person", () => {
      const deck = start(opened(), "run", [left]).deck
      expect(call("stop_run", deck, person, { deck: "deck", runId: "run" })).toEqual({ ok: false, refusal: "field" })
    })

    it("refuses an agent that names another agent's run", () => {
      const deck = start(opened(), "run", [left]).deck
      expect(call("stop_run", deck, agentOf("other"), { deck: "deck", runId: "run" })).toEqual({
        ok: false,
        refusal: "run-fenced",
      })
      expect(phase(deck, left)).toBe("running")
    })

    it("refuses a different deck and a malformed call", () => {
      const deck = start(opened(), "run", [left]).deck
      expect(call("stop_run", deck, agent, { deck: "other", runId: "run" })).toEqual({ ok: false, refusal: "deck" })
      expect(call("stop_run", deck, agent, { deck: "deck", runId: 7 })).toEqual({ ok: false, refusal: "field" })
    })
  })
})
