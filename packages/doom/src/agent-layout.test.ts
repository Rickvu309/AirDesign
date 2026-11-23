import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { agentDeck, build, lastChild, minter } from "./agent-fixtures.js"
import { childrenOf, get, slidesOf } from "./doom-walk.js"
import { ids } from "./sample-deck.js"
import { measureWith, solveLayout } from "./index.js"

const slide = ids.slide
const kpiItems = [
  { title: "Revenue", value: "$4.2M", note: "+12% YoY" },
  { title: "Margin", value: "31%", note: "+2 pts" },
]
const add = (more: Record<string, unknown>): AgentChange => ({ op: "add", slide, ...more }) as AgentChange
const box = { x: 80, y: 200, w: 1760, h: 420 }
const title = (on: typeof slide) =>
  add({ kind: "text", slide: on, text: "Results", textStyle: "title", box: { x: 80, y: 60, w: 1760, h: 90 } })
const blank = () => {
  const doom = build(agentDeck(), { op: "slide", add: {} }, minter("s"))
  return { doom, on: slidesOf(doom).at(-1)!.id }
}

describe("a frame given a height keeps it", () => {
  it("keeps the height of a KPI row and lets each card fill it", () => {
    const doom = build(agentDeck(), add({ kind: "kpi", items: kpiItems, box }))
    const row = lastChild(doom, slide)
    expect(get(row, "box")).toMatchObject({ h: 420 })
    for (const card of childrenOf(doom, row.id)) expect(get(card, "sizing")).toEqual({ w: "fill", h: "fill" })
  })

  it("keeps the height of a grid and gives the body rows the room", () => {
    const rows = [
      ["", "Q1", "Q2"],
      ["Product", "Beta", "Launch"],
      ["Sales", "Pilot", "Roll out"],
    ]
    const doom = build(agentDeck(), add({ kind: "frame", rows, box: { ...box, h: 600 } }))
    const grid = lastChild(doom, slide)
    expect(get(grid, "box")).toMatchObject({ h: 600 })
    expect(get(grid, "layout")).toMatchObject({ mode: "grid", rows: ["hug", { fr: 1 }, { fr: 1 }] })
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
    const [header, , body] = childrenOf(doom, lastChild(doom, slide).id).map((node) => get(node, "text")!)
    expect(header!.style).toBe(body!.style)
    expect(header!.spans).toMatchObject([{ end: 2, bold: true }])
  })
})

describe("content with no box uses the slide well", () => {
  it("starts at the title's left edge and stops short of the slide's bottom edge", () => {
    const { doom: start, on } = blank()
    const doom = build(
      build(start, title(on), minter("a")),
      add({ kind: "cards", slide: on, items: [{ title: "Grow", points: ["Enter two markets"] }] }),
      minter("b"),
    )
    const cards = get(lastChild(doom, on), "box")!
    expect(cards.x).toBe(80)
    expect(cards.w).toBe(1760)
    expect(cards.y + cards.h).toBeLessThanOrEqual(1080 - 40)
  })

  it("grows a grid to most of the room under the title", () => {
    const { doom: start, on } = blank()
    const grid = add({
      kind: "frame",
      slide: on,
      rows: [
        ["Q1", "Q2"],
        ["Beta", "Launch"],
      ],
    })
    const doom = build(build(start, title(on), minter("a")), grid, minter("b"))
    const box = get(lastChild(doom, on), "box")!
    expect(box.y + box.h).toBeGreaterThan(1080 * 0.66)
  })
})

describe("a labelled shape looks like a card", () => {
  it("rounds its corners like the cards of a pattern", () => {
    let doom = build(agentDeck(), add({ kind: "cards", items: [{ title: "Grow" }], box }), minter("a"))
    const cardRadius = get(childrenOf(doom, lastChild(doom, slide).id)[0]!, "radius")
    doom = build(
      doom,
      add({ kind: "shape", text: "Decision", fill: "accent1", box: { ...box, y: 700, h: 200 } }),
      minter("b"),
    )
    expect(get(lastChild(doom, slide), "radius")).toBe(cardRadius)
    expect(cardRadius).toBeGreaterThan(0)
  })
})

describe("layout none keeps the frame as it looked", () => {
  it("fixes each card where the row put it, so the row does not collapse", () => {
    const doom = build(agentDeck(), add({ kind: "kpi", items: kpiItems, box }))
    const row = lastChild(doom, slide)
    const laid = solveLayout(doom, slide, measureWith({}))
    const off = build(doom, { op: "set", target: row.id, layout: "none" } as AgentChange)
    expect(get(off.nodes.get(row.id)!, "layout")).toEqual({ mode: "none" })
    const kept = solveLayout(off, slide, measureWith({}))
    for (const card of childrenOf(doom, row.id)) {
      expect(kept.get(card.id)).toEqual(laid.get(card.id))
      expect(get(off.nodes.get(card.id)!, "sizing")).toEqual({ w: "fixed", h: "fixed" })
    }
  })
})
