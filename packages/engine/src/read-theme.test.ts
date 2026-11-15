import { readDeckId } from "@airdesign/catalog"
import { decide, elementId, format, themeNode, type Command, type TraitPatch } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { indexDeck, openDeck, readDeckPage, type Deck } from "./index.js"

const box = { x: 0, y: 0, cx: 100, cy: 100 }
const palette = { slots: { dk1: "000000", lt1: "FFFFFF", accent1: "4472C4" }, map: { tx1: "dk1", bg1: "lt1" } }
const second = { slots: { dk1: "111111", accent1: "C0504D" }, map: { tx1: "dk1" } }

function indexed(): Deck {
  const deck = readDeckId("themed")
  if (!deck.ok) throw new Error(deck.refusal)
  const read = indexDeck(
    openDeck(deck.deck),
    { actor: "person" },
    {
      deck: "themed",
      format: 2,
      once: "themed",
      offset: 0,
      total: 1,
      palettes: [palette, second],
      slides: [
        { id: "258", position: 0 },
        { id: "259", position: 1, palette: 1 },
      ],
      elements: [{ node: elementId("258.2"), kind: "shape", value: "Quarterly review", box, grouped: false }],
    },
  )
  if (!read.ok) throw new Error(read.refusal)
  return read.deck
}

function themed(deck: Deck, ...patches: readonly TraitPatch<"theme">[]): Deck {
  const commands: Command[] = [
    { command: "add", node: themeNode, floor: "", route: deck.register.route },
    ...patches.map((theme): Command => ({ command: "person", node: themeNode, v: format, patch: { theme } })),
  ]
  let register = deck.register
  for (const command of commands) {
    const decision = decide(register, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    register = decision.register
  }
  return { ...deck, register }
}

describe("read_deck after a theme change", () => {
  it("puts each changed colour in every palette, names the changed colours and fonts, and lists no theme element", () => {
    const answer = readDeckPage(themed(indexed(), { accent1: { set: "C00000" }, major: { set: "Georgia" } }), {
      runId: null,
    })
    expect(answer.palettes).toEqual([
      { ...palette, slots: { ...palette.slots, accent1: "C00000" } },
      { ...second, slots: { ...second.slots, accent1: "C00000" } },
    ])
    expect(answer.theme).toEqual({ accent1: `#${"C00000"}`, major: "Georgia" })
    expect(answer.elements.map((element) => element.node)).toEqual([elementId("258.2")])
  })

  it("shows the opening palettes again once the change goes back to its opening", () => {
    const answer = readDeckPage(themed(indexed(), { accent1: { set: "C00000" } }, { accent1: "opening" }), {
      runId: null,
    })
    expect(answer.palettes).toEqual([palette, second])
    expect(answer).not.toHaveProperty("theme")
  })
})
