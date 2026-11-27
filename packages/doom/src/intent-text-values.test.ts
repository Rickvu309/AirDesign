import { describe, expect, it } from "vitest"
import type { Intent } from "./intent-read.js"
import { readIntent } from "./intent-read.js"
import { compileIntent } from "./intent-compile.js"
import { agentDeck, build, minter, started } from "./testing/agent-fixtures.js"
import { propOf } from "./doom-walk.js"
import type { Doom } from "./doom.js"
import { ids, land, revOf, sampleDeck, textOf } from "./sample-deck.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

const set = (target: string, look: Record<string, unknown>): Intent => ({ op: "set", target, ...look }) as Intent
const textAt = (doom: Doom) => propOf(doom.nodes.get(ids.title)!, "text")!

describe("raw text values: an agent sets what the panel's text controls set", () => {
  it("writes size, font, line height, letter spacing, case, underline, strike and justify", () => {
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
  })

  it("lets a text style clear the size, font, spacing and case, as the panel's style picker does", () => {
    let doom = build(agentDeck(), set(ids.title, { size: 72, font: "Montserrat", lineHeight: 1.1, underline: true }))
    doom = build(doom, set(ids.title, { textStyle: "heading" }))
    expect(textAt(doom)).toMatchObject({ style: "heading", spans: [{ end: 7, underline: true }], paras: [{}] })
    const cased = build(build(doom, set(ids.title, { case: "upper" })), set(ids.title, { case: "none" }))
    expect(textAt(cased).spans).toEqual([{ end: 7, underline: true }])
  })

  it("sets the weight on a named face", () => {
    const before = sampleDeck()
    const held = { ...textOf("Revenue"), spans: [{ end: 7, font: "Inter SemiBold", bold: false as const }] }
    const seeded = started(
      land(before, [{ node: ids.title, prop: "text", value: held, base: revOf(before, ids.title, "text")! }]),
    )
    const bold = build(seeded, set(ids.title, { weight: "Bold" }))
    expect(textAt(bold).spans[0]).toMatchObject({ bold: true })
    expect(textAt(bold).spans[0]?.font).toBeUndefined()
    const again = build(bold, set(ids.title, { weight: "SemiBold" }))
    expect(textAt(again).spans).toEqual([{ end: 7, font: "Inter SemiBold", bold: false }])
  })

  it("sets Regular on a style that rests bold", () => {
    let doom = build(agentDeck(), set(ids.title, { textStyle: "title" }))
    doom = build(doom, set(ids.title, { weight: "Bold" }))
    doom = build(doom, set(ids.title, { weight: "Regular" }))
    expect(textAt(doom).spans[0]).toMatchObject({ bold: false })
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
      expect(readIntent(set(ids.title, look))).toMatchObject({ refused: "shape" })
  })

  it("refuses text values on a frame, and justify as where a frame places its children", () => {
    for (const look of [{ size: 40 }, { font: "Inter" }, { align: "justify" }])
      expect(compileIntent(agentDeck(), set(ids.card, look), minter(), placement, starts)).toMatchObject({
        refused: "shape",
      })
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
