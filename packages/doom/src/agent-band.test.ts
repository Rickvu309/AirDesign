import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { agentDeck, build, lastChild, minter, titledSlide } from "./agent-fixtures.js"
import { bottomLimitOf } from "./agent-place.js"
import { childrenOf, propOf } from "./doom-walk.js"
import type { Doom } from "./index.js"
import { ids } from "./sample-deck.js"

const slide = ids.slide
const add = (value: Record<string, unknown>) => ({ op: "add", slide, ...value }) as AgentChange
const made = (doom: Doom) => lastChild(doom, slide)

const kpiItems = [
  { title: "Revenue", value: "$4.2M", note: "+12% YoY" },
  { title: "Margin", value: "31%", note: "+2 pts" },
  { title: "Cash", value: "$9.1M" },
]

describe("a pattern under a title", () => {
  const titled = () => titledSlide()

  it.each(["kpi", "cards"] as const)(
    "keeps %s at content height under the title, short of the bottom margin",
    (kind) => {
      const { doom: start, on } = titled()
      const items =
        kind === "kpi"
          ? kpiItems
          : [
              { title: "Grow", icon: "trending-up", points: ["Enter two markets", "Double the sales team"] },
              { title: "Protect", icon: "shield", points: ["Cut cost to serve", "Raise retention"] },
              { title: "Build", icon: "hammer", points: ["Ship the platform", "Open the API"] },
            ]
      const doom = build(start, { op: "add", slide: on, kind, items } as AgentChange, minter("p"))
      const title = childrenOf(start, on).find((node) => propOf(node, "role") === "title")!
      const titleBox = propOf(title, "box")!
      const box = propOf(lastChild(doom, on), "box")!
      expect(box.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.h)
      expect(box.y + box.h).toBeLessThan(bottomLimitOf(1080))
    },
  )

  it.each(["timeline", "flow", "matrix"] as const)("fills the band down to the bottom margin for %s", (kind) => {
    const { doom: start, on } = titled()
    const items =
      kind === "matrix"
        ? [{ title: "Quick wins" }, { title: "Big bets" }, { title: "Fill-ins" }, { title: "Avoid" }]
        : kind === "timeline"
          ? [
              { value: "Q1", title: "Antidisestablishmentarianism", note: "One word" },
              { value: "Q2", title: "Build", note: "Core platform" },
              { value: "Q3", title: "Pilot", note: "Ten customers" },
            ]
          : [
              { title: "Collect the customer order" },
              { title: "Check stock in every warehouse" },
              { title: "Pack and label the parcels" },
            ]
    const doom = build(
      start,
      {
        op: "add",
        slide: on,
        kind,
        items,
        ...(kind === "matrix" ? { axes: ["Effort", "Impact"] } : {}),
      } as AgentChange,
      minter("p"),
    )
    const box = propOf(lastChild(doom, on), "box")!
    expect(box.y + box.h).toBeGreaterThan(bottomLimitOf(1080) - items.length)
    expect(box.y + box.h).toBeLessThanOrEqual(bottomLimitOf(1080))
  })

  it("keeps a timeline that runs across at content height, short of the bottom margin", () => {
    const { doom: start, on } = titled()
    const doom = build(
      start,
      {
        op: "add",
        slide: on,
        kind: "timeline",
        items: [
          { value: "Q1", title: "Plan" },
          { value: "Q2", title: "Build" },
          { value: "Q3", title: "Launch" },
        ],
      } as AgentChange,
      minter("p"),
    )
    const box = propOf(lastChild(doom, on), "box")!
    expect(box.y + box.h).toBeLessThan(bottomLimitOf(1080))
  })

  it("keeps a flow that runs across at content height, short of the bottom margin", () => {
    const { doom: start, on } = titled()
    const doom = build(
      start,
      {
        op: "add",
        slide: on,
        kind: "flow",
        items: [{ title: "Sign up" }, { title: "Verify" }, { title: "Pay" }],
      } as AgentChange,
      minter("p"),
    )
    const box = propOf(lastChild(doom, on), "box")!
    expect(box.y + box.h).toBeLessThan(bottomLimitOf(1080))
  })

  it("fills a lone chart down to the bottom margin", () => {
    const { doom: start, on } = titled()
    const doom = build(
      start,
      {
        op: "add",
        slide: on,
        kind: "chart",
        chart: { kind: "bar", categories: ["Q1", "Q2"], series: [{ name: "Plan", values: [3, 4] }] },
      } as AgentChange,
      minter("c"),
    )
    const box = propOf(lastChild(doom, on), "box")!
    expect(box.y + box.h).toBe(bottomLimitOf(1080))
  })
})

describe("cards sized to their words", () => {
  const shortCards = [
    { title: "Grow", icon: "trending-up", points: ["Enter two markets", "Double the sales team"] },
    { title: "Protect", icon: "shield", points: ["Cut cost to serve", "Raise retention"] },
    { title: "Build", icon: "hammer", points: ["Ship the platform", "Open the API"] },
  ]
  const row = (items: unknown) => made(build(agentDeck(), add({ kind: "cards", items })))

  it("keeps three short cards at content height, short of the bottom margin", () => {
    const doom = build(agentDeck(), add({ kind: "cards", items: shortCards }))
    const box = propOf(made(doom), "box")!
    expect(box.y + box.h).toBeLessThan(bottomLimitOf(1080))
    expect(box.h).toBeLessThan(0.55 * (1080 - box.y))
  })

  it("keeps a KPI row and a single card at the height of their words", () => {
    const kpis = build(agentDeck(), add({ kind: "kpi", items: kpiItems }))
    const box = propOf(made(kpis), "box")!
    expect(box.h).toBeLessThan(0.55 * (1080 - box.y))
    const one = build(agentDeck(), add({ kind: "cards", items: [shortCards[0]] }))
    expect(propOf(made(one), "box")!.h).toBeLessThan(0.4 * (1080 - propOf(made(one), "box")!.y))
  })

  it("keeps every card in the row as tall as the row", () => {
    const doom = build(agentDeck(), add({ kind: "cards", items: shortCards }))
    for (const card of childrenOf(doom, made(doom).id)) expect(propOf(card, "sizing")).toMatchObject({ h: "fill" })
  })

  it("grows a row to the height its words need, short of the bottom margin", () => {
    const tall = [
      shortCards[0]!,
      { title: "Long", points: Array.from({ length: 14 }, (_, at) => `A line of words ${at}`) },
    ]
    const box = propOf(row(tall), "box")!
    const short = propOf(row(shortCards), "box")!
    expect(box.h).toBeGreaterThan(short.h)
    expect(box.y + box.h).toBeLessThanOrEqual(bottomLimitOf(1080))
  })
})
