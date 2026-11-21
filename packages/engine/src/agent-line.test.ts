import { readDeckId } from "@airdesign/catalog"
import {
  connectorEnds,
  elementId,
  landedPatch,
  placeOf,
  type DeckIndex,
  type IndexElement,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, openDeck, readDeckPage, type Deck } from "./index.js"

const agent = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const
const size = { width: 12_192_000, height: 6_858_000 }
const node = (shape: number) => elementId(`258.${shape}`)
const square = { cx: 1_000_000, cy: 1_000_000 }

const elements: readonly IndexElement[] = [
  { node: node(2), kind: "shape", value: "", box: { x: 1_000_000, y: 1_000_000, ...square }, grouped: false },
  { node: node(3), kind: "shape", value: "", box: { x: 4_000_000, y: 3_000_000, ...square }, grouped: false },
]

function indexed(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const opened = openDeck(id.deck)
  const index: DeckIndex = {
    format: 2,
    total: elements.length,
    slides: [{ id: "258", position: 0, size, free: 9 }],
    elements,
    pages: [],
  }
  return { ...opened, register: { ...opened.register, index } }
}

function edit(deck: Deck, ...changes: readonly object[]) {
  return call("edit_deck", deck, agent, { deck: "deck", base: deck.revision, changes })
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function patchOf(register: Register, shape: number) {
  const body = register.elements[node(shape)]
  if (body === undefined) throw new Error("body")
  return landedPatch(body, "text")
}

const ends = { start: { shape: { node: "258.2", site: 3 } }, end: { shape: { node: "258.3", site: 1 } } }

describe("an agent adds a line or an arrow", () => {
  it("adds an arrow from one shape's right site to another's left site, as the Shapes tray's Arrow, all under the run", () => {
    const deck = landed(edit(indexed(), { op: "add", kind: "arrow", slide: "258", connection: ends }))
    const added = deck.register.order.find((command) => command.slide === "element-add")
    expect(added).toMatchObject({
      slide: "element-add",
      geometry: "straightConnector1",
      runId: "run",
      element: { node: "258.9", kind: "connector", value: null, grouped: false },
    })
    expect(placeOf(deck.register, node(9))).toEqual({
      box: { x: 2_000_000, y: 1_500_000, cx: 2_000_000, cy: 2_000_000 },
      rot: 0,
      flipH: false,
      flipV: false,
    })
    expect(patchOf(deck.register, 9).connection).toEqual({
      start: { set: { shape: { node: node(2), site: 3 } } },
      end: { set: { shape: { node: node(3), site: 1 } } },
    })
    const read = readDeckPage(deck, { runId: "run", slide: "258" }).elements.find((each) => each.node === "258.9")
    expect(read).toMatchObject({ kind: "connector", box: { x: 157.5, y: 118.1, w: 157.5, h: 157.5 } })
    expect(read?.design).toContain("connection.start 258.2 site 3 · connection.end 258.3 site 1")
    const undone = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
    expect(readDeckPage(undone, { runId: "run", slide: "258" }).elements.map((each) => each.node)).not.toContain(
      "258.9",
    )
  })

  it("flips an arrow that climbs from its start to its end", () => {
    const climbing = { start: ends.end, end: { shape: { node: "258.2", site: 2 } } }
    const deck = landed(edit(indexed(), { op: "add", kind: "arrow", slide: "258", connection: climbing }))
    expect(placeOf(deck.register, node(9))).toEqual({
      box: { x: 1_500_000, y: 2_000_000, cx: 2_500_000, cy: 1_500_000 },
      rot: 0,
      flipH: true,
      flipV: true,
    })
  })

  it("adds a free divider line in its box, zero points high", () => {
    const deck = landed(
      edit(indexed(), { op: "add", kind: "line", slide: "258", box: { x: 72, y: 400, w: 600, h: 0 } }),
    )
    const added = deck.register.order.find((command) => command.slide === "element-add")
    expect(added).toMatchObject({
      geometry: "line",
      element: { kind: "connector", box: { x: 914_400, y: 5_080_000, cx: 7_620_000, cy: 0 } },
    })
    expect(deck.register.elements[node(9)]?.landed ?? []).toEqual([])
  })

  it("refuses an end on a site the shape lacks and an end on another slide's layer", () => {
    const missing = { ...ends, end: { shape: { node: "258.3", site: 4 } } }
    expect(edit(indexed(), { op: "add", kind: "arrow", slide: "258", connection: missing })).toEqual({
      ok: false,
      refusal: "site",
    })
    const away = { ...ends, end: { shape: { node: "259.3", site: 1 } } }
    expect(edit(indexed(), { op: "add", kind: "line", slide: "258", connection: away })).toEqual({
      ok: false,
      refusal: "site",
    })
  })

  it("adds an elbow from a parent's bottom site to a child's top site, its ends on both sites", () => {
    const tree = { start: { shape: { node: "258.2", site: 2 } }, end: { shape: { node: "258.3", site: 0 } } }
    const deck = landed(edit(indexed(), { op: "add", kind: "elbow", slide: "258", connection: tree }))
    const added = deck.register.order.find((command) => command.slide === "element-add")
    expect(added).toMatchObject({ geometry: "bentConnector3", element: { kind: "connector", value: null } })
    const place = placeOf(deck.register, node(9))
    if (place === null) throw new Error("no place")
    expect(connectorEnds(place)).toEqual({ start: { x: 1_500_000, y: 2_000_000 }, end: { x: 4_500_000, y: 3_000_000 } })
    expect(patchOf(deck.register, 9).connection).toEqual({
      start: { set: { shape: { node: node(2), site: 2 } } },
      end: { set: { shape: { node: node(3), site: 0 } } },
    })
    const read = readDeckPage(deck, { runId: "run", slide: "258" }).elements.find((each) => each.node === "258.9")
    expect(read?.design).toContain("geometry bentConnector3")
  })
})
