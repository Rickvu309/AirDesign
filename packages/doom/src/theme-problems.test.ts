import { describe, expect, it } from "vitest"
import type { Intent } from "./intent-read.js"
import { compileIntents } from "./intent-edit.js"
import { agentDeck, minter, runName } from "./testing/agent-fixtures.js"
import { paletteColorVars } from "./paint.js"
import { themeProblems } from "./theme-problems.js"
import { agent, hex, ids, land, sampleDeck, textOf, theme } from "./sample-deck.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

const red = hex(0xff0000)
const nearRed = hex(0xff0001)

const edited = (changes: readonly Record<string, unknown>[]) => {
  const edit = compileIntents(agentDeck(), changes as readonly Intent[], {
    placement,
    starts,
    author: agent(runName),
    once: "problems-1",
    mint: minter(),
  })
  if ("refused" in edit) throw new Error(edit.refused)
  return edit
}

describe("value problems: the edit lands, and the answer names the nearest named choice", () => {
  it("names a hex that is not a theme colour, in a fill, an outline or the words, and lands it", () => {
    const edit = edited([
      { op: "update", target: ids.title, color: red },
      { op: "update", target: ids.card, fill: nearRed, stroke: "accent2" },
    ])
    expect(edit.edit.writes.some((write) => write.prop === "fills")).toBe(true)
    expect(edit.problems).toHaveLength(2)
    expect(edit.problems).toMatchObject([
      { code: "off-palette", node: ids.title, color: red },
      { code: "off-palette", node: ids.card, color: nearRed },
    ])
    expect(edit.problems[0]).toHaveProperty(
      "to",
      expect.toSatisfy((to: string) => to in theme().colors),
    )
    expect(edit.problems.every((problem) => !("note" in problem))).toBe(true)
  })

  it("suggests palette colours for literals close to semantic chart colours", () => {
    const signedTheme = {
      ...theme(),
      colors: { ...theme().colors, positive: hex(0x00775e), negative: hex(0xa53e42), total: hex(0x325da9) },
    }
    const deck = land(sampleDeck(), [{ node: ids.deck, prop: "theme", value: signedTheme }])
    for (const role of ["positive", "negative", "total"] as const) {
      const near = hex(Number.parseInt(signedTheme.colors[role].slice(1), 16) ^ 1)
      const [problem] = themeProblems(deck, [
        { node: ids.card, prop: "fills", value: [{ kind: "solid", color: near }] },
      ])
      expect(problem?.code).toBe("off-palette")
      if (problem?.code === "off-palette") expect(paletteColorVars).toContain(problem.to)
    }
  })

  it("names a size off the type scale and a font that is not the theme's, with the nearest style", () => {
    const sized = { ...textOf("Revenue"), spans: [{ end: 7, size: 72, font: "Comic Neue" }] }
    const found = themeProblems(sampleDeck(), [{ node: ids.title, prop: "text", value: sized }])
    expect(found).toEqual([
      { code: "off-scale", node: ids.title, size: 72, style: "title", to: theme().textStyles.title.size },
      { code: "off-font", node: ids.title, font: "Comic Neue", to: [theme().fonts.heading] },
    ])
  })

  it("finds nothing when the edit names the theme's own colours, styles and fonts", () => {
    const own = {
      ...textOf("Revenue"),
      spans: [{ end: 7, size: theme().textStyles.title.size, font: theme().fonts.body }],
    }
    expect(themeProblems(sampleDeck(), [{ node: ids.title, prop: "text", value: own }])).toEqual([])
    expect(edited([{ op: "update", target: ids.title, textStyle: "title", color: "accent1" }]).problems).toEqual([])
    expect(edited([{ op: "update", target: ids.card, fill: theme().colors.accent2 }]).problems).toEqual([])
  })
})
