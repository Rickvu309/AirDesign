import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { contentAreaOf } from "./agent-place.js"
import { agentDeck, apply, minter } from "./testing/agent-fixtures.js"
import { childrenOf, propOf } from "./doom-walk.js"
import type { Doom } from "./doom.js"
import type { PlacementRules } from "./placement-rules.js"
import { ids } from "./sample-deck.js"
import { placement } from "./testing/placement-rules.js"

const slide = ids.slide
const add = (value: Record<string, unknown>) => ({ op: "add", slide, ...value }) as AgentChange

function built(rules: PlacementRules, change: AgentChange): Doom {
  const deck = agentDeck()
  const writes = compileAgentChange(deck, change, minter(), rules)
  if ("refused" in writes) throw new Error(`refused ${JSON.stringify(writes)}`)
  return apply(deck, writes)
}
const made = (doom: Doom) => childrenOf(doom, slide).at(-1)!

describe("placement follows the rules it is given", () => {
  it("pads a grid's cells by the rules' gap", () => {
    const cellPadding = (rules: PlacementRules) => {
      const doom = built(
        rules,
        add({
          kind: "frame",
          rows: [
            ["Region", "Q3"],
            ["North", "4"],
          ],
        }),
      )
      const cells = childrenOf(doom, made(doom).id).filter((cell) => propOf(cell, "text") !== undefined)
      return propOf(cells[0]!, "text")!.padding
    }
    expect(cellPadding(placement)?.b).toBe(15)
    expect(cellPadding({ ...placement, gapShare: 0.025 })?.b).toBe(24)
  })

  it("reads a total row by the rules' pattern and draws its rule at the rules' weight", () => {
    const rows = [
      ["", "Q3"],
      ["North", "4"],
      ["South", "5"],
      ["Sum", "9"],
    ]
    const rules = (doom: Doom) =>
      childrenOf(doom, made(doom).id)
        .filter((cell) => propOf(cell, "name") === "Rule")
        .map((rule) => ({ row: propOf(rule, "cell")!.row, sides: propOf(rule, "stroke")!.sides }))
    expect(rules(built(placement, add({ kind: "frame", rows })))).toEqual([
      { row: 0, sides: { b: 2 } },
      { row: 1, sides: { b: 1 } },
      { row: 2, sides: { b: 1 } },
    ])
    const summed: PlacementRules = {
      ...placement,
      table: { ...placement.table, totalRow: /^sum\b/iu, headerRule: { ...placement.table.headerRule, weight: 3 } },
    }
    expect(rules(built(summed, add({ kind: "frame", rows })))).toEqual([
      { row: 0, sides: { b: 3 } },
      { row: 1, sides: { b: 1 } },
      { row: 3, sides: { t: 3 } },
    ])
  })

  it("sizes an icon and weighs a line by the rules", () => {
    const rules: PlacementRules = { ...placement, iconSide: 60, iconStrokeDivisor: 6, lineWeight: 5 }
    const icon = made(built(rules, add({ kind: "icon", icon: "star" })))
    expect([propOf(icon, "box")!.w, propOf(icon, "stroke")!.weight]).toEqual([60, 10])
    const line = made(built(rules, add({ kind: "line", box: { x: 0, y: 0, w: 100, h: 0 } })))
    expect(propOf(line, "stroke")!.weight).toBe(5)
  })

  it("keeps a slide's content inside the rules' margins", () => {
    const deck = agentDeck()
    expect(contentAreaOf(deck, slide, placement)).toMatchObject({ x: 160, w: 1600 })
    expect(contentAreaOf(deck, slide, { ...placement, marginShare: 0.125 })).toMatchObject({ x: 240, w: 1440 })
  })
})
