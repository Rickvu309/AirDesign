import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { bottomLimitOf, gapFor } from "./agent-place.js"
import { agentDeck, build, lastChild } from "./agent-fixtures.js"
import { defaultTheme } from "./default-theme-art.js"
import { childrenOf, propOf } from "./doom-walk.js"
import { ladderOf } from "./pattern-parts.js"
import { type Doom, type NodeId } from "./index.js"
import { ids } from "./sample-deck.js"

const slide = ids.slide
const add = (value: Record<string, unknown>) => ({ op: "add", slide, ...value }) as AgentChange
const made = (doom: Doom) => lastChild(doom, slide)
const kpiItems = [
  { title: "Revenue", value: "$4.2M", note: "+12% YoY" },
  { title: "Margin", value: "31%", note: "+2 pts" },
  { title: "Cash", value: "$9.1M" },
]

describe("a grid of words fills the band with its text size", () => {
  const rows = (count: number) =>
    Array.from({ length: count }, (_, at) => (at === 0 ? ["", "Q1", "Q2", "Q3"] : [`Line ${at}`, "3.0", "3.4", "3.8"]))
  const gridOf = (count: number) => {
    const doom = build(agentDeck(), add({ kind: "frame", rows: rows(count) }))
    return { doom, root: made(doom), box: propOf(made(doom), "box")! }
  }
  const styleOf = (doom: Doom, root: NodeId) =>
    new Set(childrenOf(doom, root).map((cell) => propOf(cell, "text")!.style))
  const sizeOfStyle = (name: string) => ladderOf(defaultTheme).indexOf(name as never)

  it("sets header and body in one style, the largest the heading allows when the rows are few", () => {
    const { doom, root } = gridOf(4)
    expect([...styleOf(doom, root.id)]).toEqual(["heading"])
  })

  it("steps down to the one style that keeps every row above the bottom margin", () => {
    const small = gridOf(4)
    const tall = gridOf(11)
    const tallStyles = [...styleOf(tall.doom, tall.root.id)]
    expect(tallStyles).toHaveLength(1)
    expect(sizeOfStyle(tallStyles[0]!)).toBeGreaterThan(sizeOfStyle("heading"))
    expect(tall.box.y + tall.box.h).toBeLessThanOrEqual(bottomLimitOf(1080))
    expect(small.box.y + small.box.h).toBeLessThan(bottomLimitOf(1080))
  })

  it("keeps rows at the height of their words, the theme gap between them, from the top of the band", () => {
    const { doom, root, box } = gridOf(4)
    const kpi = build(agentDeck(), add({ kind: "kpi", items: kpiItems }))
    expect(box.y).toBe(propOf(made(kpi), "box")!.y)
    expect(propOf(root, "layout")).toMatchObject({ rows: ["hug", "hug", "hug", "hug"], gap: gapFor(1920) })
    expect(childrenOf(doom, root.id).length).toBeGreaterThan(0)
  })
})
