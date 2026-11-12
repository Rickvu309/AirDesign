import { describe, expect, it } from "vitest"
import * as z from "zod/v4"
import { readAgentEdit } from "./edit-wire.js"
import { catalog } from "./index.js"
import { readDeckQuery, readListDecks } from "./read-wire.js"

describe("read deck wire", () => {
  it("reads a deck id and an optional slide or cursor", () => {
    expect(catalog.read_deck.read).toBe(readDeckQuery)
    expect(readDeckQuery({ deck: "deck" })).toMatchObject({ ok: true, deck: "deck" })
    expect(readDeckQuery({ deck: "deck", slide: "258" })).toMatchObject({ ok: true, slide: "258" })
    expect(readDeckQuery({ deck: "deck", cursor: "258.7" })).toMatchObject({ ok: true, cursor: "258.7" })
    expect(readDeckQuery({})).toEqual({ ok: false, refusal: "field" })
    expect(readDeckQuery({ deck: "bad id" })).toEqual({ ok: false, refusal: "deck" })
    expect(readDeckQuery({ deck: "deck", slide: "258.7" })).toEqual({ ok: false, refusal: "field" })
    expect(readDeckQuery({ deck: "deck", cursor: "a" })).toEqual({ ok: false, refusal: "field" })
    expect(readDeckQuery({ deck: "deck", extra: true })).toEqual({ ok: false, refusal: "field" })
  })

  it("reads an optional deck cursor and nothing else", () => {
    expect(catalog.list_decks.read).toBe(readListDecks)
    expect(readListDecks({})).toEqual({ ok: true })
    expect(readListDecks({ cursor: "deck" })).toMatchObject({ ok: true, cursor: "deck" })
    expect(readListDecks({ deck: "deck" })).toEqual({ ok: false, refusal: "field" })
    expect(readListDecks({ cursor: "bad id" })).toEqual({ ok: false, refusal: "field" })
    expect(readListDecks({ cursor: 1 })).toEqual({ ok: false, refusal: "field" })
  })

  it("points the edit fields at airdesign_read_deck", () => {
    const schema = JSON.stringify(z.toJSONSchema(readAgentEdit.input, { io: "input" }))
    expect(schema).toContain("airdesign_read_deck")
    expect(schema).not.toContain("your last read")
    const read = JSON.stringify(z.toJSONSchema(readDeckQuery.input, { io: "input" }))
    expect(read).toContain("Only this slide.")
    expect(read).toContain("Element id from the previous answer.")
  })
})
