import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { agentDeck, build, lastChild, minter } from "./testing/agent-fixtures.js"
import { more, richDeck } from "./testing/rich-deck.js"
import { propOf } from "./doom-walk.js"
import { ids, land } from "./sample-deck.js"
import { placement } from "./testing/placement-rules.js"

const slide = ids.slide
const set = (target: string, look: Record<string, unknown>): AgentChange =>
  ({ op: "set", target, ...look }) as AgentChange
const refusal = (doom = richDeck(), change: AgentChange) => compileAgentChange(doom, change, minter(), placement)

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
    expect(propOf(made, "geometry")).toMatchObject({
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
    expect(propOf(doom.nodes.get(more.line)!, "geometry")).toEqual({
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
    expect(propOf(freed.nodes.get(more.line)!, "geometry")).toMatchObject({ start: { x: 10, y: 20 } })
    expect(refusal(richDeck(), set(more.line, { to: { layer: more.line } }))).toMatchObject({ field: "to" })
    expect(refusal(richDeck(), set(more.line, { to: { layer: more.titled } }))).toMatchObject({ field: "to" })
    expect(refusal(richDeck(), set(ids.card, { route: "curve" }))).toMatchObject({ field: "route" })
  })

  it("holds an end on any layer a person can attach to: text and icons too, never a locked one", () => {
    const text = build(
      richDeck(),
      set(more.line, { from: { layer: ids.title, side: "left" }, to: { layer: more.icon } }),
    )
    expect(propOf(text.nodes.get(more.line)!, "geometry")).toMatchObject({
      start: { node: ids.title, site: "l" },
      end: { node: more.icon, site: "l" },
    })
    const locked = land(richDeck(), [{ node: ids.card, prop: "locked", value: true }])
    expect(refusal(locked, set(more.line, { to: { layer: ids.card } }))).toMatchObject({ field: "to" })
    expect(refusal(locked, set(more.line, { to: { layer: ids.title } }))).toMatchObject({ field: "to" })
  })
})

describe("a connector's ends", () => {
  it("joins two shapes on a full slide with no box, spanning the centres of its ends", () => {
    const full = build(agentDeck(), { op: "add", kind: "shape", slide, box: { x: 0, y: 0, w: 1920, h: 1080 } })
    const one = build(full, { op: "add", kind: "shape", slide, box: { x: 100, y: 100, w: 200, h: 100 } }, minter("b"))
    const left = lastChild(one, slide).id
    const two = build(one, { op: "add", kind: "shape", slide, box: { x: 700, y: 400, w: 200, h: 100 } }, minter("c"))
    const right = lastChild(two, slide).id
    const made = lastChild(
      build(
        two,
        { op: "add", kind: "line", slide, from: { layer: left }, to: { layer: right, side: "left" } },
        minter("d"),
      ),
      slide,
    )
    expect(propOf(made, "geometry")).toMatchObject({ start: { node: left }, end: { node: right, site: "l" } })
    expect(propOf(made, "box")).toMatchObject({ x: 200, y: 150, w: 600, h: 300 })
  })

  it("leaves a side at a point along it and runs an elbow's middle leg in its lane", () => {
    const one = build(agentDeck(), { op: "add", kind: "shape", slide, box: { x: 100, y: 100, w: 400, h: 100 } })
    const top = lastChild(one, slide).id
    const two = build(one, { op: "add", kind: "shape", slide, box: { x: 700, y: 500, w: 200, h: 100 } }, minter("b"))
    const low = lastChild(two, slide).id
    const lined = build(
      two,
      {
        op: "add",
        kind: "line",
        slide,
        route: "elbow",
        lane: 420,
        from: { layer: top, side: "bottom", along: 0.75 },
        to: { layer: low, side: "top" },
      },
      minter("c"),
    )
    const line = lastChild(lined, slide)
    expect(propOf(line, "geometry")).toMatchObject({
      start: { node: top, site: "b", along: 0.75 },
      end: { node: low, site: "t" },
      route: "elbow",
      channels: [{ axis: "y", at: 420 }],
    })
    const moved = build(
      lined,
      { op: "set", target: line.id, lane: 380, from: { layer: top, side: "right" } },
      minter("d"),
    )
    expect(propOf(lastChild(moved, slide), "geometry")).toMatchObject({
      start: { node: top, site: "r" },
      channels: [{ axis: "x", at: 380 }],
    })
    expect(
      compileAgentChange(agentDeck(), { op: "add", kind: "shape", slide, lane: 10 }, minter(), placement),
    ).toMatchObject({
      field: "lane",
    })
  })
})
