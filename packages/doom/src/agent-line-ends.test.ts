import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { agentDeck, build, lastChild, minter, more, richDeck } from "./agent-fixtures.js"
import { get } from "./doom-walk.js"
import { ids } from "./sample-deck.js"

const slide = ids.slide
const set = (target: string, look: Record<string, unknown>): AgentChange =>
  ({ op: "set", target, ...look }) as AgentChange
const refusal = (doom = richDeck(), change: AgentChange) => compileAgentChange(doom, change, minter())

describe("a line's ends and route from an agent", () => {
  it("connects two layers with an elbow, each end on the side facing the other", () => {
    const made = lastChild(
      build(agentDeck(), {
        op: "add",
        kind: "line",
        slide,
        from: { layer: ids.card },
        to: { layer: ids.side },
        route: "elbow",
      } as AgentChange),
      slide,
    )
    expect(get(made, "geometry")).toMatchObject({
      start: { node: ids.card, site: "r" },
      end: { node: ids.side, site: "l" },
      route: "elbow",
    })
  })

  it("attaches a line's ends to layers' sides and changes its route", () => {
    const doom = build(
      richDeck(),
      set(more.line, { from: { layer: ids.card, side: "right" }, to: { layer: ids.side }, route: "elbow" }),
    )
    expect(get(doom.nodes.get(more.line)!, "geometry")).toEqual({
      kind: "line",
      start: { node: ids.card, site: "r" },
      end: { node: ids.side, site: "l" },
      route: "elbow",
      arrows: ["none", "none"],
    })
  })

  it("frees an end to a point and refuses an end on a layer it cannot hold", () => {
    const attached = build(richDeck(), set(more.line, { from: { layer: ids.card, side: "top" } }))
    const freed = build(attached, set(more.line, { from: { x: 10, y: 20 } }))
    expect(get(freed.nodes.get(more.line)!, "geometry")).toMatchObject({ start: { x: 10, y: 20 } })
    expect(refusal(richDeck(), set(more.line, { to: { layer: more.line } }))).toMatchObject({ field: "to" })
    expect(refusal(richDeck(), set(more.line, { to: { layer: more.titled } }))).toMatchObject({ field: "to" })
    expect(refusal(richDeck(), set(ids.card, { route: "curve" }))).toMatchObject({ field: "route" })
  })
})
