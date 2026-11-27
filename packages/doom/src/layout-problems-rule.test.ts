import { describe, expect, it } from "vitest"
import { rules } from "./testing/problem-rules.js"
import { type TreeNode, doomFromTree } from "./doom-tree.js"
import { layoutProblems, type ProblemRules } from "./layout-problems.js"
import { block, label, measure, plainTheme, spot } from "./testing/doom-fixtures-art.js"

const ruled: ProblemRules = { ...rules, thinRule: 4 }

const hairline = (name: string, x: number, y: number, w: number, h: number): TreeNode =>
  block(name, w, h, { box: spot(x, y, w, h), fills: [{ kind: "solid", color: { var: "text" }, opacity: 0.2 }] })

const cell = (name: string, chars: string, y = 10) =>
  label(name, chars, { box: spot(10, y, 110, 60) }, { resize: "height" })

function found(children: readonly TreeNode[], given = ruled) {
  const grown = doomFromTree({ theme: plainTheme, slides: [{ children }] })
  return { ids: grown.ids, problems: layoutProblems(grown.doom, grown.slides, measure, given) }
}

describe("layout problems: a thin painted rule through words", () => {
  it.each([
    ["over", 0],
    ["under", 1],
  ])("names a wrapped table cell whose second line runs %s the row's hairline from the cell's left edge", (_, at) => {
    const rule = hairline("Row rule", 10, 54, 590, 1)
    const words = cell("Region", "North west offices")
    const { ids, problems } = found([
      {
        ...block("Table", 600, 200, { box: spot(100, 100, 600, 200) }),
        children: at === 0 ? [rule, words] : [words, rule],
      },
    ])
    expect(problems).toEqual([{ code: "rule-crosses-text", node: ids.Region, with: ids["Row rule"] }])
  })

  it("names a thin upright rule through words, turned with its frame", () => {
    const { ids, problems } = found([
      {
        ...block("Table", 600, 200, { box: { ...spot(100, 400, 600, 200), rotation: 90 } }),
        children: [hairline("Column rule", 50, 0, 2, 200), cell("Region", "North")],
      },
    ])
    expect(problems).toEqual([{ code: "rule-crosses-text", node: ids.Region, with: ids["Column rule"] }])
  })

  it("leaves alone a rule between two lines, one under the words and a bar as thick as the rule names", () => {
    const { problems } = found([
      {
        ...block("Table", 600, 300, { box: spot(100, 100, 600, 300) }),
        children: [
          hairline("Between", 0, 39, 600, 1),
          hairline("Under", 0, 75, 600, 1),
          cell("Region", "North west offices"),
          block("Bar", 600, 4, {
            box: spot(0, 150, 600, 4),
            fills: [{ kind: "solid", color: { var: "accent1" } }],
          }),
          cell("Below", "North", 140),
        ],
      },
    ])
    expect(problems.filter((problem) => problem.code === "rule-crosses-text")).toEqual([])
  })

  it("judges no painted rule when the rules name no thickness", () => {
    const { problems } = found(
      [
        {
          ...block("Table", 600, 200, { box: spot(100, 100, 600, 200) }),
          children: [hairline("Row rule", 0, 54, 600, 1), cell("Region", "North west offices")],
        },
      ],
      rules,
    )
    expect(problems).toEqual([])
  })
})
