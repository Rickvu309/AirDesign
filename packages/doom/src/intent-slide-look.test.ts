import { describe, expect, it } from "vitest"
import { readIntent, type Intent } from "./intent-read.js"
import { compileIntent } from "./intent-compile.js"
import { agentDeck, build, minter } from "./testing/agent-fixtures.js"
import { propOf } from "./doom-walk.js"
import { ids, theme } from "./sample-deck.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

const set = (target: string, look: Record<string, unknown>): Intent => ({ op: "update", target, ...look }) as Intent
const refusal = (change: Intent) => compileIntent(agentDeck(), change, minter(), placement, starts)

describe("skip, transition, paragraph spacing, vertical align and blur", () => {
  it("skips a slide and refuses a skip on a layer", () => {
    const doom = build(agentDeck(), set(ids.slide, { skipped: true }))
    expect(propOf(doom.nodes.get(ids.slide)!, "skipped")).toBe(true)
    const shown = build(doom, set(ids.slide, { skipped: false }))
    expect(propOf(shown.nodes.get(ids.slide)!, "skipped")).toBe(false)
    expect(refusal(set(ids.card, { skipped: true }))).toMatchObject({ refused: "shape", field: "skipped" })
    expect(readIntent({ op: "update", target: ids.slide, skipped: "yes" })).toMatchObject({
      refused: "shape",
      field: "skipped",
    })
  })

  it("sets how a slide arrives and refuses a kind or a duration the prop does not take", () => {
    const doom = build(agentDeck(), set(ids.slide, { transition: { kind: "fade", ms: 400 } }))
    expect(propOf(doom.nodes.get(ids.slide)!, "transition")).toEqual({ kind: "fade", ms: 400 })
    expect(refusal(set(ids.title, { transition: { kind: "push", ms: 200 } }))).toMatchObject({
      refused: "shape",
      field: "transition",
    })
    expect(readIntent({ op: "update", target: ids.slide, transition: { kind: "wipe", ms: 200 } })).toMatchObject({
      refused: "shape",
      field: "transition.kind",
    })
    expect(readIntent({ op: "update", target: ids.slide, transition: { kind: "fade", ms: 1.5 } })).toMatchObject({
      refused: "shape",
      field: "transition.ms",
    })
    expect(readIntent({ op: "update", target: ids.slide, transition: "fade" })).toMatchObject({
      refused: "shape",
      field: "transition",
    })
  })

  it("writes vertical align and paragraph spacing on the text a person would", () => {
    const doom = build(agentDeck(), set(ids.title, { alignV: "bottom", spaceBefore: 12, spaceAfter: 8 }))
    expect(propOf(doom.nodes.get(ids.title)!, "text")).toMatchObject({
      alignV: "bottom",
      paras: [{ spaceBefore: 12, spaceAfter: 8 }],
    })
    expect(refusal(set(ids.slide, { alignV: "center" }))).toMatchObject({ refused: "shape", field: "alignV" })
    expect(refusal(set(ids.card, { spaceBefore: 4 }))).toMatchObject({ refused: "shape", field: "spaceBefore" })
    expect(readIntent({ op: "update", target: ids.title, alignV: "middle" })).toMatchObject({
      refused: "shape",
      field: "alignV",
    })
    expect(readIntent({ op: "update", target: ids.title, spaceAfter: -1 })).toMatchObject({
      refused: "shape",
      field: "spaceAfter",
    })
  })

  it("keeps fractions of a pixel in paragraph spacing, so a deck holding 2.5 can be set to it again", () => {
    expect(readIntent({ op: "update", target: ids.title, spaceBefore: 2.5, spaceAfter: 0.25 })).not.toHaveProperty(
      "refused",
    )
    const doom = build(agentDeck(), set(ids.title, { spaceBefore: 2.5, spaceAfter: 0.25 }))
    expect(propOf(doom.nodes.get(ids.title)!, "text")).toMatchObject({
      paras: [{ spaceBefore: 2.5, spaceAfter: 0.25 }],
    })
  })

  it("blurs a layer without dropping its shadow and refuses a blur on a slide", () => {
    const shadowed = build(agentDeck(), set(ids.card, { effect: "lifted" }))
    const doom = build(shadowed, set(ids.card, { blur: 8 }))
    expect(propOf(doom.nodes.get(ids.card)!, "effects")).toEqual([
      ...theme().effectStyles.lifted,
      { kind: "layerBlur", radius: 8 },
    ])
    const clear = build(doom, set(ids.card, { blur: 0 }))
    expect(propOf(clear.nodes.get(ids.card)!, "effects")).toEqual([...theme().effectStyles.lifted])
    expect(refusal(set(ids.slide, { blur: 4 }))).toMatchObject({ refused: "shape", field: "blur" })
    expect(readIntent({ op: "update", target: ids.card, blur: -1 })).toMatchObject({
      refused: "shape",
      field: "blur",
    })
  })
})
