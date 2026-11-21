import { readDeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { indexDeck, openDeck, readDeckPage, type Deck } from "./index.js"

const size = { width: 12_192_000, height: 6_858_000 }
const palette = {
  slots: { dk1: "202020", lt1: "FFFFFF", accent1: "2D6FCD" },
  map: { tx1: "dk1", bg1: "lt1" },
  fonts: { major: "Inter", minor: "Inter" },
}
const theme = "ppt/theme/theme1.xml"

function indexed(): Deck {
  const deck = readDeckId("placed")
  if (!deck.ok) throw new Error(deck.refusal)
  const read = indexDeck(
    openDeck(deck.deck),
    { actor: "person" },
    {
      deck: "placed",
      format: 2,
      once: "placed",
      offset: 0,
      total: 1,
      palettes: [palette],
      templateStyles: [{ id: theme, name: "Neutral", palette }],
      slides: [{ id: "256", position: 0, size, templateStyle: theme }],
      elements: [
        {
          node: elementId("256.2"),
          kind: "shape",
          value: "Title",
          box: { x: 914_400, y: 1_828_800, cx: 10_363_200, cy: 1_371_600 },
          grouped: false,
        },
      ],
    },
  )
  if (!read.ok) throw new Error(read.refusal)
  return read.deck
}

describe("an agent reads where it is in the units it writes", () => {
  it("gives the slide size and each layer's box in points, as w and h", () => {
    const answer = readDeckPage(indexed(), { runId: null })
    expect(answer.size).toEqual({ w: 960, h: 540 })
    expect(answer.elements[0]?.box).toEqual({ x: 72, y: 144, w: 816, h: 108 })
  })

  it("names each slide's template style and gives its palette once, not again as a palette list", () => {
    const answer = readDeckPage(indexed(), { runId: null })
    expect(answer.templateStyles?.[0]?.palette).toEqual(palette)
    expect(answer.slides[0]?.templateStyle).toBe(theme)
    expect(answer).not.toHaveProperty("palettes")
  })
})
