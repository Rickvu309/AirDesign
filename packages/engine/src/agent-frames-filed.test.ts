import { readDeckId } from "@airdesign/catalog"
import { elementId, type DeckIndex, type IndexElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, openDeck, readDeckPage, type Deck } from "./index.js"

const teal = "1E9AA8"

const agent = { actor: "agent", runId: "run" } as const
const size = { width: 12_192_000, height: 6_858_000 }
const node = (shape: number) => elementId(`256.${shape}`)
const frameBox = { x: 1_000_000, y: 1_000_000, cx: 3_627_000, cy: 1_000_000 }

const elements: readonly IndexElement[] = [
  {
    node: node(2),
    kind: "group",
    value: null,
    box: frameBox,
    grouped: false,
    frame: frameBox,
    framing: {
      backdrop: node(3),
      children: [node(4), node(5)],
      layout: { flow: "horizontal", gap: 127_000, padding: [0, 0, 0, 0], align: "topLeft" },
    },
  },
  { node: node(3), kind: "shape", value: null, box: frameBox, grouped: true, group: node(2) },
  {
    node: node(4),
    kind: "shape",
    value: null,
    box: { x: 1_000_000, y: 1_000_000, cx: 2_000_000, cy: 1_000_000 },
    grouped: true,
    group: node(2),
  },
  {
    node: node(5),
    kind: "shape",
    value: null,
    box: { x: 3_127_000, y: 1_000_000, cx: 1_500_000, cy: 600_000 },
    grouped: true,
    group: node(2),
  },
]

function indexed(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const opened = openDeck(id.deck)
  const index: DeckIndex = {
    format: 2,
    total: elements.length,
    slides: [{ id: "256", position: 0, size, free: 6 }],
    elements,
    pages: [],
  }
  return { ...opened, register: { ...opened.register, index } }
}

it("sets the layout and fill of a frame read from a PowerPoint file", () => {
  const started = call("start_run", indexed(), agent, { deck: "deck", runId: "run", elements: [{ node: "256.2" }] })
  if (!started.ok) throw new Error(started.refusal)
  const edited = call("edit_deck", started.deck, agent, {
    deck: "deck",
    base: started.deck.revision,
    changes: [{ op: "set", target: "256.2", layout: { flow: "vertical", gap: 24 }, fills: { paint: `#${teal}` } }],
  })
  if (!edited.ok) throw new Error(edited.refusal)
  const read = new Map(readDeckPage(edited.deck, { runId: "run" }).elements.map((each) => [each.node, each]))
  expect(read.get(node(2))).toMatchObject({ frame: "auto" })
  expect(read.has(node(3))).toBe(false)
  expect(read.get(node(5))?.box?.y).toBe(1_000_000 + 1_000_000 + 24 * 12_700)
})
