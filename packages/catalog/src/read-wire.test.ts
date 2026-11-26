import { describe, expect, it } from "vitest"
import { catalog } from "./index.js"
import { readAppState } from "./read-wire.js"

describe("list decks wire", () => {
  it("reads an optional deck cursor and nothing else", () => {
    expect(catalog.get_app_state.read).toBe(readAppState)
    expect(readAppState({})).toEqual({ ok: true })
    expect(readAppState({ cursor: "deck" })).toMatchObject({ ok: true, cursor: "deck" })
    expect(readAppState({ deck: "deck" })).toEqual({ ok: false, refusal: "field" })
    expect(readAppState({ cursor: "bad id" })).toEqual({ ok: false, refusal: "field" })
    expect(readAppState({ cursor: 1 })).toEqual({ ok: false, refusal: "field" })
  })
})
