import { parseNotifyKey, readDeckId } from "@airdesign/catalog"
import { decide, history, version } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, openDeck, type Deck } from "./index.js"

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) {
    throw new Error(id.refusal)
  }
  return openDeck(id.deck)
}

function running(): Deck {
  const deck = opened()
  const started = decide(deck.register, { command: "start", runId: "run" })
  if (started.decision !== "apply") {
    throw new Error(started.code)
  }
  return { id: deck.id, revision: deck.revision, register: started.register }
}

const person = { actor: "person" } as const
const agent = { actor: "agent", runId: "run", readAt: 0 } as const

describe("call", () => {
  it("lands a person commit and a key for that revision", () => {
    const deck = opened()
    const result = call("commit_edits", deck, person, { deck: "deck", batch: [{ value: "hi" }] })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.deck.revision).toBe(1)
    expect(result.deck.register.landed).toEqual([{ actor: "person", value: "hi", visible: true }])
    expect(history(result.deck.register)).toEqual(["hi"])
    expect(parseNotifyKey(result.key)).toEqual({ ok: true, deck: deck.id, revision: 1 })
  })

  it("lands a second person commit after the first", () => {
    const first = call("commit_edits", opened(), person, { deck: "deck", batch: [{ value: "hi" }] })
    expect(first.ok).toBe(true)
    if (!first.ok) {
      return
    }
    const second = call("commit_edits", first.deck, person, { deck: "deck", batch: [{ value: "ho" }] })
    expect(second.ok).toBe(true)
    if (!second.ok) {
      return
    }
    expect(second.deck.revision).toBe(2)
    expect(second.deck.register.landed).toEqual([
      { actor: "person", value: "hi", visible: true },
      { actor: "person", value: "ho", visible: true },
    ])
    expect(history(second.deck.register)).toEqual(["hi", "ho"])
  })

  it("refuses a raw actor or principal", () => {
    const deck = opened()
    expect(call("commit_edits", deck, person, { deck: "deck", actor: "agent", batch: [{ value: "hi" }] })).toEqual({
      ok: false,
      refusal: "field",
    })
    expect(call("commit_edits", deck, person, { deck: "deck", principal: "person", batch: [{ value: "hi" }] })).toEqual(
      {
        ok: false,
        refusal: "field",
      },
    )
    expect(deck.revision).toBe(0)
    expect(deck.register.landed).toEqual([])
  })

  it("does not land a commit from an agent caller", () => {
    const deck = opened()
    expect(call("commit_edits", deck, agent, { deck: "deck", batch: [{ value: "hi" }] })).toEqual({
      ok: false,
      refusal: "field",
    })
    expect(deck.revision).toBe(0)
    expect(deck.register.landed).toEqual([])
  })

  it("does not land an edit from a person caller", () => {
    const deck = opened()
    expect(call("edit_deck", deck, person, { deck: "deck", base: 0, changes: [{ value: "hi" }] })).toEqual({
      ok: false,
      refusal: "field",
    })
    expect(deck.revision).toBe(0)
    expect(deck.register.landed).toEqual([])
  })

  it("refuses an edit whose base is not the revision", () => {
    const deck = opened()
    const register = deck.register
    expect(call("edit_deck", deck, agent, { deck: "deck", base: 1, changes: [{ value: "hi" }] })).toEqual({
      ok: false,
      refusal: "stale",
    })
    expect(deck.revision).toBe(0)
    expect(deck.register).toBe(register)
    expect(deck.register.landed).toEqual([])
  })

  it("lands an agent edit at the version it read", () => {
    const deck = running()
    const readAt = version(deck.register)
    const result = call(
      "edit_deck",
      deck,
      { actor: "agent", runId: "run", readAt },
      { deck: "deck", base: deck.revision, changes: [{ value: "hi" }] },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.deck.revision).toBe(1)
    expect(result.deck.register.landed).toEqual([{ actor: "agent", value: "hi", visible: true }])
  })

  it("lands an agent edit of two changes", () => {
    const deck = running()
    const readAt = version(deck.register)
    const result = call(
      "edit_deck",
      deck,
      { actor: "agent", runId: "run", readAt },
      { deck: "deck", base: deck.revision, changes: [{ value: "one" }, { value: "two" }] },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.deck.revision).toBe(1)
    expect(result.deck.register.landed).toEqual([
      { actor: "agent", value: "one", visible: true },
      { actor: "agent", value: "two", visible: true },
    ])
  })

  it("refuses an agent batch after a person commit in the same run", () => {
    const started = running()
    const readAt = version(started.register)
    const agentLanded = call(
      "edit_deck",
      started,
      { actor: "agent", runId: "run", readAt },
      { deck: "deck", base: started.revision, changes: [{ value: "one" }] },
    )
    expect(agentLanded.ok).toBe(true)
    if (!agentLanded.ok) {
      return
    }
    const personLanded = call("commit_edits", agentLanded.deck, person, {
      deck: "deck",
      batch: [{ value: "mine" }],
    })
    expect(personLanded.ok).toBe(true)
    if (!personLanded.ok) {
      return
    }
    const register = personLanded.deck.register
    expect(
      call(
        "edit_deck",
        personLanded.deck,
        { actor: "agent", runId: "run", readAt: version(personLanded.deck.register) },
        { deck: "deck", base: personLanded.deck.revision, changes: [{ value: "two" }, { value: "three" }] },
      ),
    ).toEqual({ ok: false, refusal: "person-protected" })
    expect(personLanded.deck.register).toBe(register)
    expect(personLanded.deck.revision).toBe(2)
  })

  it("refuses an edit from a different run id after the batch", () => {
    const deck = running()
    const readAt = version(deck.register)
    const landed = call(
      "edit_deck",
      deck,
      { actor: "agent", runId: "run", readAt },
      { deck: "deck", base: deck.revision, changes: [{ value: "one" }, { value: "two" }] },
    )
    expect(landed.ok).toBe(true)
    if (!landed.ok) {
      return
    }
    const register = landed.deck.register
    expect(
      call(
        "edit_deck",
        landed.deck,
        { actor: "agent", runId: "other", readAt: version(landed.deck.register) },
        { deck: "deck", base: landed.deck.revision, changes: [{ value: "no" }] },
      ),
    ).toEqual({ ok: false, refusal: "run-fenced" })
    expect(landed.deck.register).toBe(register)
    expect(landed.deck.revision).toBe(1)
  })

  it("refuses an agent edit read ahead of the version", () => {
    const deck = running()
    const register = deck.register
    expect(
      call(
        "edit_deck",
        deck,
        { actor: "agent", runId: "run", readAt: version(deck.register) + 1 },
        { deck: "deck", base: deck.revision, changes: [{ value: "hi" }] },
      ),
    ).toEqual({ ok: false, refusal: "stale" })
    expect(deck.register).toBe(register)
    expect(deck.revision).toBe(0)
  })

  it("refuses a commit for a different deck id", () => {
    const deck = opened()
    expect(call("commit_edits", deck, person, { deck: "other", batch: [{ value: "hi" }] })).toEqual({
      ok: false,
      refusal: "deck",
    })
    expect(deck.revision).toBe(0)
  })

  it("refuses an edit for a different deck id", () => {
    const deck = running()
    const register = deck.register
    expect(
      call(
        "edit_deck",
        deck,
        { actor: "agent", runId: "run", readAt: version(deck.register) },
        { deck: "other", base: deck.revision, changes: [{ value: "hi" }] },
      ),
    ).toEqual({ ok: false, refusal: "deck" })
    expect(deck.revision).toBe(0)
    expect(deck.register).toBe(register)
  })

  it("drops the batch when a later edit is refused", () => {
    const deck = opened()
    const before = JSON.parse(JSON.stringify(deck)) as Deck
    expect(
      call("commit_edits", deck, person, {
        deck: "deck",
        batch: [{ value: "hi" }, { value: "no", node: "b" }],
      }),
    ).toEqual({ ok: false, refusal: "dead" })
    expect(deck).toEqual(before)
    expect(history(deck.register)).toEqual([])
  })

  it("counts the bytes a commit lands", () => {
    const first = call("commit_edits", opened(), person, { deck: "deck", batch: [{ value: "hi" }] })
    expect(first.ok).toBe(true)
    if (!first.ok) {
      return
    }
    expect(first.deck.register.bytes).toBe(2)
    const second = call("commit_edits", first.deck, person, { deck: "deck", batch: [{ value: "é" }] })
    expect(second.ok).toBe(true)
    if (!second.ok) {
      return
    }
    expect(second.deck.register.bytes).toBe(4)
  })

  it("refuses a commit that would reach the byte limit", () => {
    const deck = opened()
    const full = { ...deck, register: { ...deck.register, bytes: 69_999_999 } }
    const register = full.register
    expect(call("commit_edits", full, person, { deck: "deck", batch: [{ value: "x" }] })).toEqual({
      ok: false,
      refusal: "limit",
    })
    expect(full.register).toBe(register)
    const room = { ...deck, register: { ...deck.register, bytes: 69_999_998 } }
    const landed = call("commit_edits", room, person, { deck: "deck", batch: [{ value: "x" }] })
    expect(landed.ok).toBe(true)
    if (!landed.ok) {
      return
    }
    expect(landed.deck.register.bytes).toBe(69_999_999)
  })
})
