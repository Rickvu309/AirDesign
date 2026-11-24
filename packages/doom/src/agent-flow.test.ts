import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { bottomLimitOf } from "./agent-place.js"
import { agentDeck, build, lastChild, minter, titledSlide } from "./agent-fixtures.js"
import { defaultTheme } from "./default-theme-art.js"
import { childrenOf, propOf, slidesOf } from "./doom-walk.js"
import { widestWord } from "./text-estimate.js"
import { type Doom, type NodeId } from "./index.js"
import { ids, land } from "./sample-deck.js"

const slide = ids.slide
const add = (value: Record<string, unknown>) => ({ op: "add", slide, ...value }) as AgentChange
const made = (doom: Doom) => lastChild(doom, slide)

const longSteps = [
  { title: "Collect the customer order", note: "Web shop or call centre" },
  { title: "Check stock in every warehouse", note: "Pick the nearest one" },
  { title: "Pack and label the parcels", note: "Two people per shift" },
  { title: "Hand over to the carrier", note: "Collected before noon" },
  { title: "Confirm delivery with a photo", note: "Driver app records it" },
  { title: "Handle returns within thirty days", note: "Refund on arrival" },
]

function roomsOf(doom: Doom, root: NodeId) {
  const [lane] = childrenOf(doom, root)
  const layout = propOf(lane!, "layout")!
  if (layout.mode !== "row" && layout.mode !== "column") throw new Error("lane")
  const cards = childrenOf(doom, lane!.id)
  const laneW = propOf(lane!, "box")!.w
  return cards.map((card) => {
    const pad = propOf(card, "layout")!
    if (pad.mode !== "column") throw new Error("card")
    const wide = layout.mode === "row" ? (laneW - layout.gap * (cards.length - 1)) / cards.length : laneW
    const room = wide - pad.padding.l - pad.padding.r
    return { room, words: childrenOf(doom, card.id).map((word) => propOf(word, "text")!) }
  })
}

const splitWords = (doom: Doom, root: NodeId) =>
  roomsOf(doom, root).flatMap(({ room, words }) =>
    words.filter((text) => widestWord([text.chars], defaultTheme, text.style) > room).map((text) => text.chars),
  )

const titlesAt = (doom: Doom, root: NodeId) => new Set(roomsOf(doom, root).map(({ words }) => words[0]!.style))

const narrowDeck = () => {
  const resized = land(agentDeck(), [{ node: ids.deck, prop: "size", value: { w: 1440, h: 1080 } }])
  const opened = build(resized, { op: "slide", add: {} }, minter("s"))
  return { doom: opened, on: slidesOf(opened).at(-1)!.id }
}

describe("a flow never splits a word", () => {
  it("sets six long steps across a 16:9 slide in whole words, inside the bottom margin", () => {
    const doom = build(agentDeck(), add({ kind: "flow", items: longSteps }))
    expect(splitWords(doom, made(doom).id)).toEqual([])
    const box = propOf(made(doom), "box")!
    expect(box.y + box.h).toBeLessThanOrEqual(bottomLimitOf(1080))
  })

  it.each([
    ["16:9", agentDeck],
    ["4:3", () => narrowDeck().doom],
  ])("sets six short steps across a %s slide in whole words", (_, deck) => {
    const items = ["Order", "Pack", "Ship", "Deliver", "Return", "Refund"].map((title) => ({
      title,
      note: "Same week",
    }))
    const start = deck()
    const on = slidesOf(start).at(-1)!.id
    const doom = build(start, { op: "add", slide: on, kind: "flow", items } as AgentChange, minter("f"))
    const root = lastChild(doom, on)
    expect(propOf(childrenOf(doom, root.id)[0]!, "layout")).toMatchObject({ mode: "row" })
    expect(splitWords(doom, root.id)).toEqual([])
  })

  it("refuses six long steps on a 4:3 slide, naming shorter labels or fewer steps, rather than split a word", () => {
    const { doom: start, on } = narrowDeck()
    const change = { op: "add", slide: on, kind: "flow", items: longSteps } as AgentChange
    expect(() => build(start, change, minter("f"))).toThrow(/shorter labels or fewer steps/)
  })

  it("steps the text down only as far as the longest word needs, the same step for every card", () => {
    const doom = build(agentDeck(), add({ kind: "flow", items: longSteps }))
    expect(titlesAt(doom, made(doom).id).size).toBe(1)
    expect([...titlesAt(doom, made(doom).id)][0]).not.toBe("heading")
  })

  it("refuses when no step fits a single word in its card", () => {
    const items = longSteps.map((step, at) => ({ ...step, title: at === 2 ? "Internationalisationally" : step.title }))
    expect(() => build(agentDeck(), add({ kind: "flow", items }))).toThrow(/limit/)
  })
})

describe("a flow keeps its full size when it can run down", () => {
  it("runs three long labels down at heading, not across in smaller text", () => {
    const doom = build(agentDeck(), add({ kind: "flow", items: longSteps.slice(0, 3) }))
    const [lane] = childrenOf(doom, made(doom).id)
    expect(propOf(lane!, "layout")).toMatchObject({ mode: "column" })
    expect([...titlesAt(doom, made(doom).id)]).toEqual(["heading"])
    expect(splitWords(doom, made(doom).id)).toEqual([])
  })

  it("runs five labels across at heading when every one fits on a line", () => {
    const items = ["Order", "Pack", "Ship", "Deliver", "Return"].map((title) => ({ title }))
    const doom = build(agentDeck(), add({ kind: "flow", items }))
    expect(propOf(childrenOf(doom, made(doom).id)[0]!, "layout")).toMatchObject({ mode: "row" })
    expect([...titlesAt(doom, made(doom).id)]).toEqual(["heading"])
  })
})

describe("a flow that fits a row", () => {
  const shortSteps = [
    { title: "Order", note: "Customer buys" },
    { title: "Pack", note: "Warehouse picks" },
    { title: "Ship", note: "Carrier collects" },
    { title: "Deliver", note: "Two days" },
  ]
  const narrow = narrowDeck

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
  it("starts at the title's left edge and runs the width of the band", () => {
    const { doom: start, on } = titledSlide()
    const items = [
      { value: "Q1", title: "Plan" },
      { value: "Q2", title: "Build" },
      { value: "Q3", title: "Launch" },
    ]
    const doom = build(start, { op: "add", slide: on, kind: "timeline", items } as AgentChange, minter("p"))
    const title = childrenOf(start, on).find((node) => propOf(node, "role") === "title")!
    const titleBox = propOf(title, "box")!
    const box = propOf(lastChild(doom, on), "box")!
    expect(box.x).toBe(titleBox.x)
    expect(box.x + box.w).toBe(titleBox.x + titleBox.w)
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

describe("a timeline of many steps", () => {
  const stages = [
    { value: "Q1", title: "Design", note: "Scope and team" },
    { value: "Q2", title: "Build", note: "Core platform" },
    { value: "Q3", title: "Pilot", note: "Ten customers" },
    { value: "Q4", title: "Launch", note: "General release" },
    { value: "Q5", title: "Scale", note: "Three new markets" },
    { value: "Q6", title: "Optimise", note: "Cost to serve down 20%" },
    { value: "Q7", title: "Extend", note: "Partner programme" },
    { value: "Q8", title: "Renew", note: "Second platform" },
  ]

  it.each([2, 6, 8])("places %i steps on a 16:9 slide, inside the bottom margin", (count) => {
    const { doom: start, on } = titledSlide()
    const doom = build(
      start,
      { op: "add", slide: on, kind: "timeline", items: stages.slice(0, count) } as AgentChange,
      minter("p"),
    )
    const box = propOf(lastChild(doom, on), "box")!
    expect(box.y + box.h).toBeLessThanOrEqual(bottomLimitOf(1080))
  })

  it.each([6, 8])("places %i steps on a 4:3 slide, inside the bottom margin", (count) => {
    const { doom: start, on } = titledSlide({ w: 1440, h: 1080 })
    const doom = build(
      start,
      { op: "add", slide: on, kind: "timeline", items: stages.slice(0, count) } as AgentChange,
      minter("p"),
    )
    const box = propOf(lastChild(doom, on), "box")!
    expect(box.y + box.h).toBeLessThanOrEqual(bottomLimitOf(1080))
  })
})
