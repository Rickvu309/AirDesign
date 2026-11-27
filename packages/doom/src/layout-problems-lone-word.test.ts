import { describe, expect, it } from "vitest"
import { label, measure, plainTheme, spot } from "./testing/doom-fixtures-art.js"
import { doomFromTree, type TreeNode } from "./doom-tree.js"
import { layoutProblems, type ProblemRules } from "./layout-problems.js"

const headings: ProblemRules = { onHeight: 1080, loneWord: ["title", "heading", "bigNumber"], readable: 20 }

function found(title: TreeNode, rules = headings) {
  const grown = doomFromTree({ theme: plainTheme, slides: [{ children: [title] }] })
  return { ids: grown.ids, problems: layoutProblems(grown.doom, grown.slides, measure, rules) }
}

describe("lone words on the last line", () => {
  it.each(["title", "heading", "bigNumber"] as const)("names a lone word on the last line of %s text", (style) => {
    const { ids, problems } = found(
      label(
        "headline",
        "aaaa bbbb cccc",
        { box: spot(100, 100, plainTheme.textStyles[style].size * 6, 250) },
        { style },
      ),
    )
    expect(problems).toEqual([{ code: "lone-word", node: ids.headline, extra: expect.any(Number) }])
    expect(problems[0]).toHaveProperty(
      "extra",
      expect.toSatisfy((extra: number) => extra > 0),
    )
  })

  it.each([
    ["aaaa bbbb cccc", 600, "title"],
    ["aaaa", 380, "title"],
    ["aaaa bbbb\ncccc", 380, "title"],
    ["aaaa bbbb cccc", 120, "body"],
  ] as const)("leaves %j alone at %i px in %s text", (chars, w, style) => {
    expect(found(label("headline", chars, { box: spot(100, 100, w, 200) }, { style })).problems).toEqual([])
  })

  it("judges only the styles the rules name", () => {
    const box = { box: spot(100, 100, plainTheme.textStyles.body.size * 6, 250) }
    const headline = label("headline", "aaaa bbbb cccc", box, { style: "body" })
    expect(found(headline).problems).toEqual([])
    const named = found(headline, { ...headings, loneWord: ["body"] })
    expect(named.problems).toEqual([{ code: "lone-word", node: named.ids.headline, extra: expect.any(Number) }])
  })
})
