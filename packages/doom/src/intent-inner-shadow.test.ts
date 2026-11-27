import { describe, expect, it } from "vitest"

import { readIntent, type Intent } from "./intent-read.js"
import { compileIntent } from "./intent-compile.js"
import { agentDeck, build, minter } from "./testing/agent-fixtures.js"
import { propOf } from "./doom-walk.js"
import { ids, theme } from "./sample-deck.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

const set = (target: string, look: Record<string, unknown>): Intent => ({ op: "set", target, ...look }) as Intent

const shadow = { color: "accent1", x: 0, y: 2, blur: 4, spread: 0 }

describe("an inner shadow", () => {
  it("writes one inner shadow, keeps a named shadow beside it, and reads the same words back", () => {
    const lifted = build(agentDeck(), set(ids.card, { effect: "lifted" }))
    const doom = build(lifted, set(ids.card, { innerShadow: shadow }))
    expect(propOf(doom.nodes.get(ids.card)!, "effects")).toEqual([
      ...theme().effectStyles.lifted,
      { kind: "innerShadow", color: { var: "accent1" }, x: 0, y: 2, blur: 4, spread: 0 },
    ])
    const cleared = build(doom, set(ids.card, { innerShadow: "none" }))
    expect(propOf(cleared.nodes.get(ids.card)!, "effects")).toEqual(theme().effectStyles.lifted)
  })

  it("refuses a slide, a bad colour, a negative blur, and a value that is not a shadow", () => {
    const deck = agentDeck()
    expect(compileIntent(deck, set(ids.slide, { innerShadow: shadow }), minter(), placement, starts)).toMatchObject({
      field: "innerShadow",
    })
    expect(readIntent({ op: "set", target: ids.card, innerShadow: { ...shadow, color: "nope" } })).toMatchObject({
      field: "innerShadow.color",
    })
    expect(readIntent({ op: "set", target: ids.card, innerShadow: { ...shadow, blur: -1 } })).toMatchObject({
      field: "innerShadow.blur",
    })
    expect(readIntent({ op: "set", target: ids.card, innerShadow: 4 })).toMatchObject({ field: "innerShadow" })
  })
})
