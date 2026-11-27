import { describe, expect, it } from "vitest"
import { block, label, measure, plainTheme, spot } from "./testing/doom-fixtures-art.js"
import { type TreeNode, doomFromTree } from "./doom-tree.js"
import { layoutFindings } from "./layout-findings.js"

function found(children: readonly TreeNode[]) {
  const grown = doomFromTree({ theme: plainTheme, slides: [{ children }] })
  return { ids: grown.ids, findings: layoutFindings(grown.doom, grown.slides, measure) }
}

describe("layout findings: a layer painted by some of its sides", () => {
  it("judges a rule drawn by one side's stroke by that side alone, so words beside it that run past its box stay quiet", () => {
    const rule = {
      strokes: [{ kind: "solid", color: { var: "text" } }],
      stroke: { weight: 4, align: "inside", dash: "solid", sides: { t: 4 } },
    }
    const { findings } = found([
      block("rule", 160, 60, { box: spot(100, 100, 160, 60), ...rule }),
      label("cell", "aaaa bbbb cccc dddd", { box: spot(100, 120, 200, 30) }),
    ])
    expect(findings).toEqual([])
    const crossing = found([
      block("rule", 160, 60, { box: spot(100, 120, 160, 60), ...rule }),
      label("cell", "aaaa bbbb", { box: spot(100, 110, 200, 30) }),
    ])
    expect(crossing.findings).toEqual([
      expect.objectContaining({ code: "overlap", node: crossing.ids.cell, with: crossing.ids.rule }),
    ])
  })
})
