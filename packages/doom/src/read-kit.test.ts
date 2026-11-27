import { describe, expect, it } from "vitest"
import { readAgentChange } from "./agent-change.js"
import { readWrite } from "./read-write.js"
import { ids, sampleDeck, textOf } from "./sample-deck.js"

const doom = sampleDeck()

describe("words a deck holds are words: no control characters or lone surrogates", () => {
  it("refuses a control character or a lone surrogate in any word a write carries", () => {
    for (const name of ["a\u0000b", "a\u0007b", "a\u001bb", "a\u007fb", "a\ud800b", "a\udc00"])
      expect(readWrite({ node: ids.card, prop: "name", value: name }, doom)).toMatchObject({ refused: "shape" })
    expect(readWrite({ node: ids.title, prop: "text", value: textOf("a\u0000b") }, doom)).toMatchObject({
      refused: "shape",
    })
  })

  it("keeps tabs, line breaks, emoji and every script", () => {
    for (const name of ["Q3\tplan", "one\ntwo", "Revenue 📈", "Doanh thu quý 3", "売上"])
      expect(readWrite({ node: ids.card, prop: "name", value: name }, doom)).toMatchObject({ value: name })
  })

  it("refuses an agent's words with a control character or a lone surrogate", () => {
    expect(readAgentChange({ op: "set", target: ids.title, text: "a\u0000b" })).toMatchObject({ refused: "shape" })
    expect(readAgentChange({ op: "set", target: ids.title, name: "a\ud800" })).toMatchObject({ refused: "shape" })
  })
})
