import { describe, expect, it } from "vitest"
import { readNamedDeck } from "./wire.js"

describe("a tool call names its deck", () => {
  it("names a missing deck and refuses a deck id that is no id", () => {
    expect(readNamedDeck({ runId: "r1" })).toEqual({
      ok: false,
      refusal: "field",
      field: "deck",
      fault: "missing",
      form: "1 to 64 of letters, digits, _ or -.",
    })
    expect(readNamedDeck({ deck: "a b" })).toEqual({ ok: false, refusal: "deck" })
  })
})
