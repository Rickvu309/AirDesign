import { readDeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, indexDeck, openDeck, readDeckPage, type Deck } from "./index.js"

function roundedId() {
  const parsed = readDeckId("rounded")
  if (!parsed.ok) throw new Error(parsed.refusal)
  return parsed.deck
}

function indexed(): Deck {
  const opened = indexDeck(
    openDeck(roundedId()),
    { actor: "person" },
    {
      deck: "rounded",
      format: 2,
      once: "rounded",
      offset: 0,
      total: 2,
      palettes: [{ slots: { dk1: "000000", lt1: "FFFFFF", accent1: "4472C4" }, map: { tx1: "dk1", bg1: "lt1" } }],
      slides: [{ id: "258", position: 0 }],
      elements: [
        {
          node: elementId("258.2"),
          kind: "shape",
          value: null,
          box: { x: 0, y: 0, cx: 1_828_800, cy: 914_400 },
          grouped: false,
          design: { fills: ["accent1", "style"] },
        },
        {
          node: elementId("258.3"),
          kind: "shape",
          value: null,
          box: { x: 0, y: 0, cx: 1_828_800, cy: 914_400 },
          grouped: false,
          design: { geometry: ["roundRect"], "geometry.corners": [12] },
        },
      ],
    },
  )
  if (!opened.ok) throw new Error(opened.refusal)
  const running = call(
    "start_run",
    opened.deck,
    { actor: "agent", runId: "run" },
    {
      deck: "rounded",
      runId: "run",
      elements: [{ node: "258.2" }, { node: "258.3" }],
    },
  )
  if (!running.ok) throw new Error(running.refusal)
  return running.deck
}

function set(deck: Deck, target: string, change: object): Deck {
  const next = call(
    "edit_deck",
    deck,
    { actor: "agent", runId: "run" },
    {
      deck: "rounded",
      base: deck.revision,
      changes: [{ op: "set", target, ...change }],
    },
  )
  if (!next.ok) throw new Error(next.refusal)
  return next.deck
}

function line(deck: Deck, node: string): string | undefined {
  return readDeckPage(deck, { runId: "run" }).elements.find((each) => each.node === node)?.design
}

it("rounds a rectangle by an agent's radius in points, keeps it through a resize and squares it at 0", () => {
  const rounded = set(indexed(), "258.2", { geometry: { corners: 12 } })
  expect(line(rounded, "258.2")).toBe("geometry roundRect · geometry.corners 12 · fills accent1 (style)")
  expect(line(set(rounded, "258.2", { box: { h: 144 } }), "258.2")).toBe(
    "geometry roundRect · geometry.corners 12 · fills accent1 (style)",
  )
  expect(line(set(rounded, "258.2", { geometry: { corners: 0 } }), "258.2")).toBe("fills accent1 (style)")
})

it("keeps an imported rounded rectangle's radius through an agent's resize", () => {
  const deck = indexed()
  expect(line(deck, "258.3")).toBe("geometry roundRect · geometry.corners 12")
  expect(line(set(deck, "258.3", { box: { w: 72 } }), "258.3")).toBe("geometry roundRect · geometry.corners 12")
})
