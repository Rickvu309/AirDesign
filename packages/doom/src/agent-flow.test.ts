import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { bottomLimitOf } from "./agent-place.js"
import { agentDeck, build, lastChild, minter } from "./agent-fixtures.js"
import { childrenOf, propOf, slidesOf } from "./doom-walk.js"
import { type Doom, type NodeId } from "./index.js"
import { ids, land } from "./sample-deck.js"

const slide = ids.slide
const add = (value: Record<string, unknown>) => ({ op: "add", slide, ...value }) as AgentChange
const made = (doom: Doom) => lastChild(doom, slide)

describe("a flow that fits a row", () => {
  const shortSteps = [
    { title: "Order", note: "Customer buys" },
    { title: "Pack", note: "Warehouse picks" },
    { title: "Ship", note: "Carrier collects" },
    { title: "Deliver", note: "Two days" },
  ]
  const narrow = () => {
    const resized = land(agentDeck(), [{ node: ids.deck, prop: "size", value: { w: 1440, h: 1080 } }])
    const opened = build(resized, { op: "slide", add: {} }, minter("s"))
    return { doom: opened, on: slidesOf(opened).at(-1)!.id }
  }

  it("runs left to right, each arrow from a step's right side to the next one's left side", () => {
    const doom = build(agentDeck(), add({ kind: "flow", items: shortSteps }))
    const [lane, ...arrows] = childrenOf(doom, made(doom).id)
    expect(propOf(lane!, "layout")).toMatchObject({ mode: "row" })
    const steps = childrenOf(doom, lane!.id)
    expect(steps).toHaveLength(4)
    expect(arrows).toHaveLength(3)
    expect(propOf(arrows[0]!, "geometry")).toMatchObject({
      kind: "line",
      start: { node: steps[0]!.id, site: "r" },
      end: { node: steps[1]!.id, site: "l" },
      arrows: ["none", "arrow"],
    })
    expect(propOf(arrows[2]!, "geometry")).toMatchObject({ start: { node: steps[2]!.id }, end: { node: steps[3]!.id } })
  })

  it("keeps every label on one line, in the same step for every card", () => {
    const doom = build(agentDeck(), add({ kind: "flow", items: shortSteps }))
    const [lane] = childrenOf(doom, made(doom).id)
    const box = propOf(made(doom), "box")!
    const styles = childrenOf(doom, lane!.id).map((step) =>
      childrenOf(doom, step.id).map((word) => propOf(word, "text")!.style),
    )
    expect(new Set(styles.map((each) => each.join())).size).toBe(1)
    expect(box.x + box.w).toBeLessThanOrEqual(1920)
    expect(box.h).toBeLessThan(0.4 * (1080 - box.y))
  })

  it("runs top to bottom when a label would wrap in its card, at the same slide", () => {
    const doom = build(
      agentDeck(),
      add({ kind: "flow", items: [...shortSteps.slice(0, 3), { title: "Collect the signed receipt" }] }),
    )
    const [lane] = childrenOf(doom, made(doom).id)
    expect(propOf(lane!, "layout")).toMatchObject({ mode: "column" })
  })

  it("falls back to a row with wrapped labels when six long steps fit neither way", () => {
    const six = Array.from({ length: 6 }, (_, at) => ({ title: `Step ${at + 1}: collect the customer order` }))
    const doom = build(agentDeck(), add({ kind: "flow", items: six }))
    const [lane] = childrenOf(doom, made(doom).id)
    expect(propOf(lane!, "layout")).toMatchObject({ mode: "row" })
    const box = propOf(made(doom), "box")!
    expect(box.y + box.h).toBeLessThanOrEqual(bottomLimitOf(1080))
  })

  it("decides by the slide's ratio: four steps that fit a row at 16:9 can run down a 4:3 slide", () => {
    const steps = [
      { title: "Order", note: "Customer buys goods" },
      { title: "Pack", note: "Warehouse picks them" },
      { title: "Ship", note: "Carrier collects them" },
      { title: "Deliver", note: "Within two days" },
      { title: "Return", note: "Free for thirty days" },
    ]
    const wide = build(agentDeck(), add({ kind: "flow", items: steps }))
    const { doom, on } = narrow()
    const tight = build(doom, { op: "add", slide: on, kind: "flow", items: steps } as AgentChange, minter("f"))
    const modeOf = (deck: Doom, parent: NodeId) => propOf(childrenOf(deck, lastChild(deck, parent).id)[0]!, "layout")
    expect(modeOf(wide, slide)).toMatchObject({ mode: "row" })
    expect(modeOf(tight, on)).toMatchObject({ mode: "column" })
  })
})

describe("a timeline", () => {
  const doom = build(
    agentDeck(),
    add({
      kind: "timeline",
      items: [
        { value: "Q1", title: "Plan" },
        { value: "Q2", title: "Build" },
        { value: "Q3", title: "Launch" },
      ],
    }),
  )
  const root = made(doom)

  it("sits centred on the slide at the width of its words, not against the left edge", () => {
    const box = propOf(root, "box")!
    expect(box.w).toBeLessThan(0.5 * 1920)
    expect(Math.abs(box.x + box.w / 2 - 960)).toBeLessThanOrEqual(1)
  })

  it("keeps the explicit box's corner and width", () => {
    const placed = build(
      agentDeck(),
      add({
        kind: "timeline",
        box: { x: 200, y: 300, w: 1200, h: 500 },
        items: [
          { value: "Q1", title: "Plan" },
          { value: "Q2", title: "Build" },
        ],
      }),
    )
    expect(propOf(made(placed), "box")).toMatchObject({ x: 200, y: 300, w: 1200 })
  })
})
