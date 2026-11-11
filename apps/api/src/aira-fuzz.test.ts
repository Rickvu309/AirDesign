import { describe, expect, it } from "vitest"

import { readTurn } from "./aira.js"
import { airaFuzzGood } from "./aira-fuzz.js"

describe("POST /aira/turn fuzz request", () => {
  it("is one text field from a supported country", () => {
    const good = airaFuzzGood["POST /aira/turn"][0]
    expect(good?.headers).toEqual(["cf-ipcountry: VN"])
    expect(readTurn(good?.fields)).toEqual({ ok: true, text: "Fuzz" })
  })
})
