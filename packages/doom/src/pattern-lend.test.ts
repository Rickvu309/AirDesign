import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentEdit } from "./agent-edit.js"
import { agentDeck, apply, lastChild, minter, runName } from "./agent-fixtures.js"
import { defaultTheme } from "./default-theme-art.js"
import { type NodeId, type Doom, applyEdit, isRefusal, rev } from "./index.js"
import { agent, ids } from "./sample-deck.js"
import { childrenOf, descendantsOf, propOf } from "./doom-walk.js"

const slide = ids.slide
const add = (value: Record<string, unknown>) => ({ op: "add", slide, ...value }) as AgentChange
const made = (doom: Doom) => lastChild(doom, slide)
const styled = (doom: Doom, root: NodeId) =>
  descendantsOf(doom, root).flatMap((node) => propOf(node, "text")?.style ?? [])

const kpiItems = [
  { title: "Revenue", value: "$4.2M", note: "+12% YoY" },
  { title: "Margin", value: "31%", note: "+2 pts" },
  { title: "Cash", value: "$9.1M" },
]

describe("a card under a KPI row on the slide type scale", () => {
  const mint = minter("ls")
  const scaled = () => apply(agentDeck(), [{ node: ids.deck, prop: "theme", value: defaultTheme }])
  const send = (doom: Doom, change: AgentChange): Doom => {
    const result = compileAgentEdit(doom, [change], { author: agent(runName), once: `lend-${doom.rev}`, mint })
    if ("refused" in result) throw new Error(JSON.stringify(result))
    const landed = applyEdit(doom, { ...result.edit, rev: rev(doom.rev + 1) })
    if (isRefusal(landed)) throw new Error(JSON.stringify(landed))
    return landed
  }
  const decision = add({
    kind: "cards",
    items: [{ title: "Decision requested", points: ["Approve the $2M expansion budget", "Vote by Friday"] }],
  })
  const longDecision = add({
    kind: "cards",
    items: [
      {
        title: "Decision requested",
        points: [
          "Approve the $2M expansion budget",
          "Name an owner for each new region",
          "Hold the margin at 31% through Q4",
          "Vote by Friday",
        ],
      },
    ],
  })
  const sizesOf = (doom: Doom, root: NodeId) => styled(doom, root).map((style) => defaultTheme.textStyles[style].size)
  const rowIn = (doom: Doom) => childrenOf(doom, slide).find((node) => propOf(node, "name") === "KPI")!

  it("keeps its heading at 40 and its bullets at 32, under the row", () => {
    const withKpi = send(scaled(), add({ kind: "kpi", items: kpiItems }))
    const before = propOf(rowIn(withKpi), "box")!
    const doom = send(withKpi, longDecision)
    const card = made(doom)
    expect(sizesOf(doom, card.id)).toEqual([40, 32])
    const after = propOf(rowIn(doom), "box")!
    expect(after.h).toBe(before.h)
    const box = propOf(card, "box")!
    expect(box.y).toBeGreaterThanOrEqual(after.y + after.h)
    expect(box.y + box.h).toBeLessThanOrEqual(1000)
  })

  it("leaves the KPI row as tall as its own words need", () => {
    const doom = send(send(scaled(), add({ kind: "kpi", items: kpiItems })), decision)
    const need = Math.max(
      ...childrenOf(doom, rowIn(doom).id).map((card) => {
        const layout = propOf(card, "layout")!
        const pad = layout.mode === "column" ? layout.padding.t + layout.padding.b : 0
        const lines = childrenOf(doom, card.id).map((node) => defaultTheme.textStyles[propOf(node, "text")!.style])
        return pad + lines.reduce((sum, style) => sum + style.size * style.lineHeight, 0)
      }),
    )
    expect(propOf(rowIn(doom), "box")!.h).toBeGreaterThanOrEqual(need)
  })

  it("leaves the row above alone when the card already fits at the start scale", () => {
    const box = { x: 80, y: 199, w: 1760, h: 400 }
    const withKpi = send(scaled(), add({ kind: "kpi", items: kpiItems, box }))
    const doom = send(withKpi, decision)
    expect(propOf(rowIn(doom), "box")).toEqual(propOf(rowIn(withKpi), "box"))
  })
})
