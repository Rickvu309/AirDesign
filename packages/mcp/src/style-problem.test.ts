import type { AgentChange } from "@airdesign/catalog"
import { openRegister, type Register } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { styleProblem } from "./style-problem.js"

const title = "ppt/slideLayouts/slideLayout1.xml/2/0"

const fields = {
  font: "+mn-lt",
  size: 4400,
  bold: false,
  italic: false,
  color: { scheme: "tx1" },
  align: "center",
  letterSpacing: 0,
  lineHeight: 100000,
  spaceBefore: 0,
  spaceAfter: 0,
}

const register = {
  ...openRegister("", ""),
  index: {
    format: 2,
    total: 0,
    slides: [{ id: "256", position: 0, textStyles: [{ id: title, name: "Title", fields }] }],
    elements: [],
    pages: [],
  },
} as unknown as Register

function styled(id: string): AgentChange {
  return {
    op: "set",
    target: { node: "deck.templateStyles" },
    templateStyle: { textStyle: [{ id, size: 3200, font: "Georgia" }] },
  } as unknown as AgentChange
}

describe("a text style edit names a text style the deck has", () => {
  it("takes a style the deck lists", () => {
    expect(styleProblem(register, [styled(title)])).toBeUndefined()
  })

  it("refuses an id the deck does not have, and says where the ids are", () => {
    expect(styleProblem(register, [styled(title), styled("Heading")])).toEqual({
      code: "field",
      detail:
        "Change 2: the deck has no text style Heading. Use a textStyles id from airdesign_read_deck with a slide.",
    })
  })
})
