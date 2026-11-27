import { describe, expect, it } from "vitest"
import { changingWrites } from "./changing-writes.js"
import { nodeId, type Write } from "./index.js"
import { box, create, ids, place, sampleDeck, textOf, theme } from "./sample-deck.js"

describe("changingWrites", () => {
  it("drops a write whose value the node already holds, by value and not by identity", () => {
    const writes: Write[] = [
      { node: ids.card, prop: "box", value: { flipV: false, flipH: false, rotation: 0, h: 100, w: 200, y: 0, x: 100 } },
      { node: ids.title, prop: "text", value: textOf("Revenue") },
      { node: ids.slide, prop: "name", value: "Slide 1" },
    ]
    expect(changingWrites(sampleDeck(), writes)).toEqual([])
  })

  it("keeps a write that changes the value, and a write to a key the node lacks", () => {
    const writes: Write[] = [
      { node: ids.card, prop: "box", value: box(101) },
      { node: ids.card, prop: "name", value: "Card" },
      { node: ids.card, prop: "opacity", value: null },
    ]
    expect(changingWrites(sampleDeck(), writes)).toEqual(writes.slice(0, 2))
  })

  it("judges each write against the writes before it in the same edit", () => {
    const writes: Write[] = [
      { node: ids.card, prop: "name", value: "Card" },
      { node: ids.card, prop: "name", value: "Card" },
      { node: ids.card, prop: "box", value: box(900) },
      { node: ids.card, prop: "box", value: box(300) },
    ]
    expect(changingWrites(sampleDeck(), writes)).toEqual([writes[0], writes[2], writes[3]])
  })

  it("drops every write to a property the edit sets and then sets back, and keeps the rest", () => {
    const named: Write = { node: ids.card, prop: "name", value: "Card" }
    const writes: Write[] = [
      { node: ids.card, prop: "box", value: box(900) },
      named,
      { node: ids.card, prop: "box", value: box(100) },
    ]
    expect(changingWrites(sampleDeck(), writes)).toEqual([named])
  })

  it("reads a theme key inside the whole theme, and a whole theme after a key", () => {
    const same: Write = { node: ids.deck, prop: "theme.fonts.heading", value: "Inter" }
    const changed: Write = { node: ids.deck, prop: "theme.fonts.heading", value: "Lora" }
    const again: Write = {
      node: ids.deck,
      prop: "theme",
      value: { ...theme(), fonts: { ...theme().fonts, heading: "Lora" } },
    }
    expect(changingWrites(sampleDeck(), [same, changed, again])).toEqual([changed])
  })

  it("drops a theme key and the whole theme set back after it", () => {
    const changed: Write = { node: ids.deck, prop: "theme.fonts.heading", value: "Lora" }
    const back: Write = { node: ids.deck, prop: "theme", value: theme() }
    expect(changingWrites(sampleDeck(), [changed, back])).toEqual([])
  })

  it("keeps a move to another place, and drops a move to the place the node is at", () => {
    const deck = sampleDeck()
    const at = (deck.nodes.get(ids.card) as { parent: unknown }).parent
    const moved: Write = { node: ids.card, prop: "parent", value: place(ids.side) }
    expect(changingWrites(deck, [{ node: ids.card, prop: "parent", value: at }, moved])).toEqual([moved])
  })

  it("keeps every write that makes a node, and every write the deck would refuse, so the refusal still speaks", () => {
    const made = nodeId("t:99")
    const making = create(made, "frame", ids.slide, { node: made, prop: "box", value: box(0) })
    const refused: Write[] = [
      { node: nodeId("t:404"), prop: "name", value: "Ghost" },
      { node: ids.card, prop: "type", value: "shape" },
      { node: ids.card, prop: "box", value: "wide" },
    ]
    expect(changingWrites(sampleDeck(), [...making, ...refused])).toEqual([...making, ...refused])
  })

  it("drops a type write that names the type the node already is", () => {
    expect(changingWrites(sampleDeck(), [{ node: ids.card, prop: "type", value: "frame" }])).toEqual([])
  })
})
