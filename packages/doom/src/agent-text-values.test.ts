import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { readAgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { agentDeck, build, minter, started } from "./agent-fixtures.js"
import { readForAgent } from "./agent-read.js"
import { get } from "./doom-walk.js"
import type { Doom } from "./doom.js"
import { ids, land, revOf, sampleDeck, textOf } from "./sample-deck.js"

const set = (target: string, look: Record<string, unknown>): AgentChange =>
  ({ op: "set", target, ...look }) as AgentChange
const textAt = (doom: Doom) => get(doom.nodes.get(ids.title)!, "text")!

describe("raw text values: an agent sets what the panel's text controls set", () => {
  it("writes size, font, line height, letter spacing, case, underline, strike and justify, and reads them back", () => {
    const doom = build(
      agentDeck(),
      set(ids.title, {
        size: 72,
        font: "Montserrat",
        lineHeight: 1.1,
        letterSpacing: -1,
        case: "upper",
        underline: true,
        strike: true,
        align: "justify",
      }),
    )
    expect(textAt(doom).spans).toEqual([
      { end: 7, size: 72, font: "Montserrat", tracking: -1, case: "upper", underline: true, strike: true },
    ])
    expect(textAt(doom).paras).toEqual([{ align: "justify", lineHeight: 1.1 }])
    expect(readForAgent(doom, [ids.slide])).toContain(
      'align=justify size=72 font="Montserrat" letterSpacing=-1 case=upper underline strike lineHeight=1.1',
    )
  })

  it("lets a text style clear the size, font, spacing and case, as the panel's style picker does", () => {
    let doom = build(agentDeck(), set(ids.title, { size: 72, font: "Montserrat", lineHeight: 1.1, underline: true }))
    doom = build(doom, set(ids.title, { textStyle: "heading" }))
    expect(textAt(doom)).toMatchObject({ style: "heading", spans: [{ end: 7, underline: true }], paras: [{}] })
    const cased = build(build(doom, set(ids.title, { case: "upper" })), set(ids.title, { case: "none" }))
    expect(textAt(cased).spans).toEqual([{ end: 7, underline: true }])
  })

  it("refuses a value past what the panel takes, before anything compiles", () => {
    for (const look of [
      { size: 5000 },
      { size: 0 },
      { lineHeight: 9 },
      { letterSpacing: 500 },
      { font: "</style><script>" },
      { font: "" },
      { case: "shout" },
      { underline: "yes" },
    ])
      expect(readAgentChange(set(ids.title, look))).toMatchObject({ refused: "shape" })
  })

  it("refuses text values on a frame, and justify as where a frame places its children", () => {
    for (const look of [{ size: 40 }, { font: "Inter" }, { align: "justify" }])
      expect(compileAgentChange(agentDeck(), set(ids.card, look), minter())).toMatchObject({ refused: "shape" })
  })
})

describe("new words keep the look a person gave the old ones", () => {
  it("carries a size, font, underline and strike set on all the words across a rewrite", () => {
    const sized = {
      ...textOf("Revenue"),
      spans: [{ end: 7, size: 31, font: "Inter", underline: true, strike: true, tracking: 2, case: "upper" as const }],
      paras: [{ lineHeight: 1.4 }],
    }
    const before = sampleDeck()
    const typed = land(before, [
      { node: ids.title, prop: "text", value: sized, base: revOf(before, ids.title, "text")! },
    ])
    const doom = build(started(typed), set(ids.title, { text: "Revenue **grew**" }))
    expect(textAt(doom).spans).toEqual([
      { end: 8, size: 31, font: "Inter", underline: true, strike: true, tracking: 2, case: "upper" },
      { end: 12, bold: true, size: 31, font: "Inter", underline: true, strike: true, tracking: 2, case: "upper" },
    ])
    expect(textAt(doom).paras).toEqual([{ lineHeight: 1.4 }])
  })
})
