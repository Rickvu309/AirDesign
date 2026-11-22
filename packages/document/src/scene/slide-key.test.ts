import { describe, expect, it } from "vitest"
import { slideKeyText } from "./slide-key.js"
import { box, create, ids, land, sampleDeck, theme } from "./sample-deck.js"
import { nodeId } from "./index.js"
import { type OrderKey, orderKeyBetween } from "../order-key.js"

const second = nodeId("t:20")

function withSecondSlide() {
  return land(sampleDeck(), create(second, "slide", ids.row))
}

describe("the text that says what a slide looks like", () => {
  it("is the same for the same slide held in two copies of the deck", () => {
    expect(slideKeyText(sampleDeck(), ids.slide)).toBe(slideKeyText(sampleDeck(), ids.slide))
  })

  it("changes when a layer inside the slide changes", () => {
    const after = land(sampleDeck(), [{ node: ids.caption, prop: "box", value: box(10) }])
    expect(slideKeyText(after, ids.slide)).not.toBe(slideKeyText(sampleDeck(), ids.slide))
  })

  it("changes when the deck's theme changes, since every slide paints from it", () => {
    const after = land(sampleDeck(), [
      {
        node: ids.deck,
        prop: "theme",
        value: { ...theme(), fonts: { heading: "Lora", body: "Lora" } },
      },
    ])
    expect(slideKeyText(after, ids.slide)).not.toBe(slideKeyText(sampleDeck(), ids.slide))
  })

  it("keeps its value when only another slide changes", () => {
    const before = withSecondSlide()
    const after = land(before, [{ node: second, prop: "name", value: "Other" }])
    expect(slideKeyText(after, ids.slide)).toBe(slideKeyText(before, ids.slide))
  })

  it("keeps its value when only the deck's name changes", () => {
    const after = land(sampleDeck(), [{ node: ids.deck, prop: "name", value: "Renamed" }])
    expect(slideKeyText(after, ids.slide)).toBe(slideKeyText(sampleDeck(), ids.slide))
  })

  it("does not depend on the order a layer's properties were written", () => {
    const one = land(sampleDeck(), [
      { node: ids.caption, prop: "opacity", value: 0.5 },
      { node: ids.caption, prop: "hidden", value: false },
    ])
    const other = land(sampleDeck(), [
      { node: ids.caption, prop: "hidden", value: false },
      { node: ids.caption, prop: "opacity", value: 0.5 },
    ])
    expect(slideKeyText(one, ids.slide)).toBe(slideKeyText(other, ids.slide))
  })

  it("changes when layers change order", () => {
    const before = sampleDeck()
    const first = (before.nodes.get(ids.card) as { parent: { at: string } }).parent.at
    const after = land(before, [
      {
        node: ids.side,
        prop: "parent",
        value: { id: ids.slide, at: orderKeyBetween(null, first as OrderKey) },
      },
    ])
    expect(slideKeyText(after, ids.slide)).not.toBe(slideKeyText(before, ids.slide))
  })
})
