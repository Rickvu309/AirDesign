import { countryHeader, readRun, readTurn } from "@airdesign/catalog"
import { describe, expect, it } from "vitest"

import { fuzzGood } from "./aira-fuzz.js"

describe("the fuzz requests of Aira's routes", () => {
  it("are the person's text on the open deck from a supported country, and a run of that deck", () => {
    const goods = fuzzGood("fuzzdeck")
    const turn = goods["POST /aira/turn"][0]
    expect(turn?.headers).toEqual([`${countryHeader}: VN`])
    expect(readTurn(turn?.fields)).toEqual({
      ok: true,
      deck: "fuzzdeck",
      messages: [{ role: "user", content: "Fuzz" }],
    })
    expect(readRun(goods["POST /decks/undo"][0]?.fields)).toEqual({ ok: true, deck: "fuzzdeck", runId: "fuzzrun" })
  })
})
