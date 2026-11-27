import { describe, expect, it } from "vitest"
import type { Intent } from "./intent-read.js"
import { agentDeck, build, lastChild, minter } from "./testing/agent-fixtures.js"
import { childrenOf, propOf, slidesOf } from "./doom-walk.js"
import { bottomLimitOf } from "./intent-place.js"
import { ids } from "./sample-deck.js"
import { measureWith, solveLayout } from "./index.js"
import { placement } from "./testing/placement-rules.js"

const slide = ids.slide
const add = (more: Record<string, unknown>): Intent => ({ op: "insert", parent: slide, ...more }) as Intent
const box = { x: 80, y: 200, w: 1760, h: 420 }
const title = (on: typeof slide) =>
  add({ kind: "text", parent: on, text: "Results", textStyle: "title", box: { x: 80, y: 60, w: 1760, h: 90 } })
const blank = () => {
  const doom = build(agentDeck(), { op: "insert", kind: "slide" }, minter("s"))
  return { doom, on: slidesOf(doom).at(-1)!.id }
}

describe("a grid given a height keeps it", () => {
  it("keeps the height of a grid and hugs every row", () => {
    const rows = [
      ["", "Q1", "Q2"],
      ["Product", "Beta", "Launch"],
      ["Sales", "Pilot", "Roll out"],
    ]
    const doom = build(agentDeck(), add({ kind: "frame", rows, box: { ...box, h: 600 } }))
    const grid = lastChild(doom, slide)
    expect(propOf(grid, "box")).toMatchObject({ h: 600 })
    expect(propOf(grid, "layout")).toMatchObject({ mode: "grid", rows: ["hug", "hug", "hug"], gap: 0 })
  })
})

describe("a grid header reads as a header", () => {
  it("uses the style of the body rows in bold, not the small label style", () => {
    const doom = build(
      agentDeck(),
      add({
        kind: "frame",
        rows: [
          ["Q1", "Q2"],
          ["Beta", "Launch"],
        ],
      }),
    )
    const [header, , body] = childrenOf(doom, lastChild(doom, slide).id).flatMap((node) => propOf(node, "text") ?? [])
    expect(header!.style).toBe(body!.style)
    expect(header!.spans).toMatchObject([{ end: 2, bold: true }])
  })
})

describe("content with no box uses the slide well", () => {
  it("keeps a grid at the height of its words under the title", () => {
    const { doom: start, on } = blank()
    const grid = add({
      kind: "frame",
      parent: on,
      rows: [
        ["Q1", "Q2"],
        ["Beta", "Launch"],
      ],
    })
    const doom = build(build(start, title(on), minter("a")), grid, minter("b"))
    const node = lastChild(doom, on)
    const box = propOf(node, "box")!
    expect(box.y + box.h).toBeLessThan(bottomLimitOf(1080, placement))
    expect(propOf(node, "layout")).toMatchObject({ rows: ["hug", "hug"], gap: 0 })
  })
})

it("rounds a labelled shape's corners", () => {
  const doom = build(agentDeck(), add({ kind: "shape", text: "Decision", box }))
  expect(propOf(lastChild(doom, slide), "radius")).toBeGreaterThan(0)
})

describe("layout none keeps the frame as it looked", () => {
  it("fixes each layer where the row put it, so the row does not collapse", () => {
    const mint = minter("a")
    const initial = build(agentDeck(), add({ kind: "frame", layout: "row", box }), mint)
    const row = lastChild(initial, slide)
    const first = build(initial, add({ kind: "text", parent: row.id, text: "Plan" }), mint)
    const doom = build(first, add({ kind: "text", parent: row.id, text: "Build" }), mint)
    const laid = solveLayout(doom, slide, measureWith({}))
    const off = build(doom, { op: "update", target: row.id, layout: "none" } as Intent)
    expect(propOf(off.nodes.get(row.id)!, "layout")).toEqual({ mode: "none" })
    const kept = solveLayout(off, slide, measureWith({}))
    for (const layer of childrenOf(doom, row.id)) {
      expect(kept.get(layer.id)).toEqual(laid.get(layer.id))
      expect(propOf(off.nodes.get(layer.id)!, "sizing")).toEqual({ w: "fixed", h: "hug" })
    }
  })
})
