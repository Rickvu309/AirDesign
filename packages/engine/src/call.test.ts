import { parseNotifyKey, readDeckId } from "@airdesign/catalog"
import { history } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, openDeck, type Deck } from "./index.js"

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) {
    throw new Error(id.refusal)
  }
  return openDeck(id.deck)
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
})
