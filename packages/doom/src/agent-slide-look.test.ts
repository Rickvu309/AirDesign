import { describe, expect, it } from "vitest"
import { readAgentChange, type AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { agentDeck, build, minter } from "./testing/agent-fixtures.js"
import { readForAgent } from "./agent-read.js"
import { propOf } from "./doom-walk.js"
import { ids, theme } from "./sample-deck.js"
import { placement } from "./testing/placement-rules.js"

const set = (target: string, look: Record<string, unknown>): AgentChange =>
  ({ op: "set", target, ...look }) as AgentChange
const refusal = (change: AgentChange) => compileAgentChange(agentDeck(), change, minter(), placement)

describe("skip, transition, paragraph spacing, vertical align and blur", () => {
  it("skips a slide and reads the skip back, and refuses a skip on a layer", () => {
    const doom = build(agentDeck(), set(ids.slide, { skipped: true }))
    expect(propOf(doom.nodes.get(ids.slide)!, "skipped")).toBe(true)
    expect(readForAgent(doom, [ids.slide])).toContain("skipped")
    const shown = build(doom, set(ids.slide, { skipped: false }))
    expect(propOf(shown.nodes.get(ids.slide)!, "skipped")).toBe(false)
    expect(readForAgent(shown, [ids.slide])).not.toContain("skipped")
    expect(refusal(set(ids.card, { skipped: true }))).toMatchObject({ refused: "shape", field: "skipped" })
    expect(readAgentChange({ op: "set", target: ids.slide, skipped: "yes" })).toMatchObject({
      refused: "shape",
      field: "skipped",
    })
  })

  it("sets how a slide arrives and refuses a kind or a duration the prop does not take", () => {
    const doom = build(agentDeck(), set(ids.slide, { transition: { kind: "fade", ms: 400 } }))
    expect(propOf(doom.nodes.get(ids.slide)!, "transition")).toEqual({ kind: "fade", ms: 400 })
    expect(readForAgent(doom, [ids.slide])).toContain("transition=fade/400")
    expect(refusal(set(ids.title, { transition: { kind: "push", ms: 200 } }))).toMatchObject({
      refused: "shape",
      field: "transition",
    })
    expect(readAgentChange({ op: "set", target: ids.slide, transition: { kind: "wipe", ms: 200 } })).toMatchObject({
      refused: "shape",
      field: "transition.kind",
    })
    expect(readAgentChange({ op: "set", target: ids.slide, transition: { kind: "fade", ms: 1.5 } })).toMatchObject({
      refused: "shape",
      field: "transition.ms",
    })
    expect(readAgentChange({ op: "set", target: ids.slide, transition: "fade" })).toMatchObject({
      refused: "shape",
      field: "transition",
    })
  })

  it("writes vertical align and paragraph spacing on the text a person would, and reads them back", () => {
    const doom = build(agentDeck(), set(ids.title, { alignV: "bottom", spaceBefore: 12, spaceAfter: 8 }))
    expect(propOf(doom.nodes.get(ids.title)!, "text")).toMatchObject({
      alignV: "bottom",
      paras: [{ spaceBefore: 12, spaceAfter: 8 }],
    })
    const line = readForAgent(doom, [ids.slide])
    expect(line).toContain("alignV=bottom")
    expect(line).toContain("spaceBefore=12")
    expect(line).toContain("spaceAfter=8")
    expect(refusal(set(ids.slide, { alignV: "center" }))).toMatchObject({ refused: "shape", field: "alignV" })
    expect(refusal(set(ids.card, { spaceBefore: 4 }))).toMatchObject({ refused: "shape", field: "spaceBefore" })
    expect(readAgentChange({ op: "set", target: ids.title, alignV: "middle" })).toMatchObject({
      refused: "shape",
      field: "alignV",
    })
    expect(readAgentChange({ op: "set", target: ids.title, spaceAfter: -1 })).toMatchObject({
      refused: "shape",
      field: "spaceAfter",
    })
  })

  it("keeps fractions of a pixel in paragraph spacing, so a deck holding 2.5 can be set to it again", () => {
    expect(readAgentChange({ op: "set", target: ids.title, spaceBefore: 2.5, spaceAfter: 0.25 })).not.toHaveProperty(
      "refused",
    )
    const doom = build(agentDeck(), set(ids.title, { spaceBefore: 2.5, spaceAfter: 0.25 }))
    expect(propOf(doom.nodes.get(ids.title)!, "text")).toMatchObject({
      paras: [{ spaceBefore: 2.5, spaceAfter: 0.25 }],
    })
    expect(readForAgent(doom, [ids.slide])).toContain("spaceBefore=2.5 spaceAfter=0.25")
  })

  it("reads back each fraction an agent saved exactly, and not the float noise around it", () => {
    const doom = build(
      agentDeck(),
      set(ids.title, { spaceBefore: 0.125, lineHeight: 1.15, letterSpacing: -0.25, opacity: 0.25 }),
    )
    const read = readForAgent(doom, [ids.slide])
    expect(read).toContain("spaceBefore=0.125")
    expect(read).toContain("lineHeight=1.15")
    expect(read).toContain("letterSpacing=-0.25")
    expect(read).toContain("opacity=0.25")
    const noisy = build(agentDeck(), set(ids.title, { spaceBefore: 0.1 + 0.2 }))
    expect(readForAgent(noisy, [ids.slide])).toContain("spaceBefore=0.3 ")
  })

  it("blurs a layer without dropping its shadow, reads the radius, and refuses a blur on a slide", () => {
    const shadowed = build(agentDeck(), set(ids.card, { effect: "lifted" }))
    const doom = build(shadowed, set(ids.card, { blur: 8 }))
    expect(propOf(doom.nodes.get(ids.card)!, "effects")).toEqual([
      ...theme().effectStyles.lifted,
      { kind: "layerBlur", radius: 8 },
    ])
    expect(readForAgent(doom, [ids.slide])).toContain("blur=8")
    const clear = build(doom, set(ids.card, { blur: 0 }))
    expect(propOf(clear.nodes.get(ids.card)!, "effects")).toEqual([...theme().effectStyles.lifted])
    expect(readForAgent(clear, [ids.slide])).not.toContain("blur=")
    expect(refusal(set(ids.slide, { blur: 4 }))).toMatchObject({ refused: "shape", field: "blur" })
    expect(readAgentChange({ op: "set", target: ids.card, blur: -1 })).toMatchObject({
      refused: "shape",
      field: "blur",
    })
  })
})
