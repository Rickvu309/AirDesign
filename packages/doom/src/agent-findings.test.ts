import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentEdit } from "./agent-edit.js"
import { agentDeck, minter, runName } from "./agent-fixtures.js"
import { agentFindings } from "./agent-findings.js"
import { agent, hex, ids, sampleDeck, textOf, theme } from "./sample-deck.js"

const red = hex(0xff0000)
const nearRed = hex(0xff0001)

const edited = (changes: readonly Record<string, unknown>[]) => {
  const edit = compileAgentEdit(agentDeck(), changes as readonly AgentChange[], {
    author: agent(runName),
    once: "findings-1",
    mint: minter(),
  })
  if ("refused" in edit) throw new Error(edit.refused)
  return edit
}

describe("value findings: the edit lands, and the answer names the nearest named choice", () => {
  it("names a hex that is not a theme colour, in a fill, an outline or the words, and lands it", () => {
    const edit = edited([
      { op: "set", target: ids.title, color: red },
      { op: "set", target: ids.card, fill: nearRed, stroke: "accent2" },
    ])
    expect(edit.edit.writes.some((write) => write.prop === "fills")).toBe(true)
    expect(edit.findings).toHaveLength(2)
    expect(edit.findings).toMatchObject([
      { code: "off-palette", node: ids.title, color: red },
      { code: "off-palette", node: ids.card, color: nearRed },
    ])
    const { to } = edit.findings[0] as { readonly to: keyof ReturnType<typeof theme>["colors"] }
    expect(edit.findings[0]!.note).toBe(
      `t:6: ${red} is not a theme colour, so a new template will not recolour it; the nearest is ${to} (${theme().colors[to]}).`,
    )
  })

  it("names a size off the type scale and a font that is not the theme's, with the nearest style", () => {
    const sized = { ...textOf("Revenue"), spans: [{ end: 7, size: 72, font: "Comic Neue" }] }
    const found = agentFindings(sampleDeck(), [{ node: ids.title, prop: "text", value: sized }])
    expect(found).toMatchObject([
      { code: "off-scale", node: ids.title, size: 72 },
      { code: "off-font", node: ids.title, font: "Comic Neue" },
    ])
    expect(found[0]!.note).toContain(`size 72 is off the deck's type scale; the nearest text style is`)
    expect(found[1]!.note).toBe(`t:6: Comic Neue is not the deck's heading or body font (${theme().fonts.heading}).`)
  })

  it("finds nothing when the edit names the theme's own colours, styles and fonts", () => {
    const own = {
      ...textOf("Revenue"),
      spans: [{ end: 7, size: theme().textStyles.title.size, font: theme().fonts.body }],
    }
    expect(agentFindings(sampleDeck(), [{ node: ids.title, prop: "text", value: own }])).toEqual([])
    expect(edited([{ op: "set", target: ids.title, textStyle: "title", color: "accent1" }]).findings).toEqual([])
    expect(edited([{ op: "set", target: ids.card, fill: theme().colors.accent2 }]).findings).toEqual([])
  })
})
