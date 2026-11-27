import { describe, expect, it } from "vitest"
import { label, measure, plainTheme, spot } from "./testing/doom-fixtures-art.js"
import { doomFromTree, type TreeNode } from "./doom-tree.js"
import { layoutFindings } from "./layout-findings.js"

function found(title: TreeNode) {
  const grown = doomFromTree({ theme: plainTheme, slides: [{ children: [title] }] })
  return { ids: grown.ids, findings: layoutFindings(grown.doom, grown.slides, measure) }
}

describe("lone words on the last line", () => {
  it.each(["title", "heading", "bigNumber"] as const)("names a lone word on the last line of %s text", (style) => {
    const { ids, findings } = found(
      label(
        "headline",
        "aaaa bbbb cccc",
        { box: spot(100, 100, plainTheme.textStyles[style].size * 6, 250) },
        { style },
      ),
    )
    expect(findings).toEqual([
      { code: "lone-word", node: ids.headline, note: expect.stringMatching(/widen its box by [1-9]\d* px/) },
    ])
  })

  it.each([
    ["aaaa bbbb cccc", 600, "title"],
    ["aaaa", 380, "title"],
    ["aaaa bbbb\ncccc", 380, "title"],
    ["aaaa bbbb cccc", 120, "body"],
  ] as const)("leaves %j alone at %i px in %s text", (chars, w, style) => {
    expect(found(label("headline", chars, { box: spot(100, 100, w, 200) }, { style })).findings).toEqual([])
  })
})
