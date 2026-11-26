import { describe, expect, it } from "vitest"
import { catalog } from "./index.js"
import { readListDecks } from "./read-wire.js"

describe("list decks wire", () => {
  it("reads an optional deck cursor and nothing else", () => {
    expect(catalog.list_decks.read).toBe(readListDecks)
    expect(readListDecks({})).toEqual({ ok: true })
    expect(readListDecks({ cursor: "deck" })).toMatchObject({ ok: true, cursor: "deck" })
    expect(readListDecks({ deck: "deck" })).toEqual({ ok: false, refusal: "field" })
    expect(readListDecks({ cursor: "bad id" })).toEqual({ ok: false, refusal: "field" })
    expect(readListDecks({ cursor: 1 })).toEqual({ ok: false, refusal: "field" })
  })
})
