import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { build, minter, more, richDeck } from "./agent-fixtures.js"
import { ids, land } from "./sample-deck.js"
import { childrenOf, parentOf, propOf } from "./doom-walk.js"
import type { Doom } from "./doom.js"

const change = (value: Record<string, unknown>) => value as AgentChange
const kids = (doom: Doom, id: string) => childrenOf(doom, id as never).map((node) => node.id)
const refusal = (doom: Doom, value: Record<string, unknown>) => compileAgentChange(doom, change(value), minter())

describe("move", () => {
  it("puts a node first, after a sibling, or last among its parent's children", () => {
    const base = richDeck()
    expect(kids(base, ids.slide)).toEqual([ids.card, ids.side, more.chart, more.line, more.icon])
    expect(kids(build(base, change({ op: "move", node: more.icon, after: null })), ids.slide)).toEqual([
      more.icon,
      ids.card,
      ids.side,
      more.chart,
      more.line,
    ])
    expect(kids(build(base, change({ op: "move", node: more.icon, after: ids.card })), ids.slide)).toEqual([
      ids.card,
      more.icon,
      ids.side,
      more.chart,
      more.line,
    ])
    expect(kids(build(base, change({ op: "move", node: ids.card })), ids.slide)).toEqual([
      ids.side,
      more.chart,
      more.line,
      more.icon,
      ids.card,
    ])
  })

  it("puts a node into another frame and keeps it where it was on the slide", () => {
    const doom = build(richDeck(), change({ op: "move", node: ids.title, into: ids.side }))
    expect(parentOf(doom.nodes.get(ids.title)!)?.id).toBe(ids.side)
    expect(propOf(doom.nodes.get(ids.title)!, "box")).toMatchObject({ x: -300, y: 0, w: 200, h: 100 })
  })

  it("moves a node to the slide from a frame, adding the frame's offset", () => {
    const doom = build(richDeck(), change({ op: "move", node: ids.title, into: ids.slide }))
    expect(propOf(doom.nodes.get(ids.title)!, "box")).toMatchObject({ x: 100, y: 0 })
  })

  it("moves to another slide", () => {
    const doom = build(richDeck(), change({ op: "move", node: ids.card, into: more.slide2 }))
    expect(parentOf(doom.nodes.get(ids.card)!)?.id).toBe(more.slide2)
  })

  it("refuses a cycle, a slide as a node, a shape as a parent, an unknown sibling and itself", () => {
    expect(refusal(richDeck(), { op: "move", node: ids.card, into: ids.title })).toMatchObject({
      refused: "shape",
      field: "into",
    })
    expect(refusal(richDeck(), { op: "move", node: ids.card, into: ids.card })).toMatchObject({
      refused: "cycle",
      node: ids.card,
    })
    expect(refusal(richDeck(), { op: "move", node: ids.slide })).toMatchObject({ refused: "shape", field: "node" })
    expect(refusal(richDeck(), { op: "move", node: ids.card, after: "z:9" })).toMatchObject({
      refused: "missing",
      field: "after",
    })
    expect(refusal(richDeck(), { op: "move", node: ids.card, after: ids.card })).toMatchObject({
      refused: "shape",
      field: "after",
    })
    expect(refusal(richDeck(), { op: "move", node: "z:9" })).toEqual({
      refused: "missing",
      node: "z:9",
      field: "node",
      change: "move z:9",
    })
  })

  it("refuses a move into a chart", () => {
    expect(refusal(richDeck(), { op: "move", node: ids.card, into: more.chart })).toMatchObject({
      refused: "shape",
      field: "into",
    })
  })

  it("refuses a move of a frame into one of its own descendants", () => {
    const nested = build(richDeck(), change({ op: "move", node: ids.side, into: ids.card }))
    expect(refusal(nested, { op: "move", node: ids.card, into: ids.side })).toMatchObject({
      refused: "cycle",
      node: ids.card,
    })
  })
})

describe("wrap and unwrap", () => {
  const wrapped = (more2: Record<string, unknown> = {}) =>
    build(richDeck(), change({ op: "wrap", nodes: [ids.side, ids.card], ...more2 }))

  it("wraps siblings into one frame that covers them, where the first of them was, in their order", () => {
    const doom = wrapped()
    const frame = childrenOf(doom, ids.slide)[0]!
    expect(frame.type).toBe("frame")
    expect(propOf(frame, "box")).toMatchObject({ x: 100, y: 0, w: 500, h: 100 })
    expect(propOf(frame, "layout")).toBeUndefined()
    expect(propOf(frame, "sizing")).toEqual({ w: "hug", h: "hug" })
    expect(kids(doom, frame.id)).toEqual([ids.card, ids.side])
    expect(propOf(doom.nodes.get(ids.card)!, "box")).toMatchObject({ x: 0, y: 0 })
    expect(propOf(doom.nodes.get(ids.side)!, "box")).toMatchObject({ x: 300, y: 0 })
    expect(kids(doom, ids.slide)).toEqual([frame.id, more.chart, more.line, more.icon])
  })

  it("wraps a frame that clips its children, as the frame gesture does, with no hug sizing", () => {
    const frame = childrenOf(wrapped({ clip: true }), ids.slide)[0]!
    expect(propOf(frame, "clip")).toBe(true)
    expect(propOf(frame, "sizing")).toBeUndefined()
  })

  it("wraps into a row or column that places the children itself", () => {
    const frame = childrenOf(wrapped({ layout: "row" }), ids.slide)[0]!
    expect(propOf(frame, "layout")).toMatchObject({
      mode: "row",
      padding: { t: 0, r: 0, b: 0, l: 0 },
      align: "top-left",
    })
  })

  it("unwraps a frame: its children take its place and position, and the frame goes", () => {
    const doom = build(wrapped(), change({ op: "unwrap", node: childrenOf(wrapped(), ids.slide)[0]!.id }))
    expect(kids(doom, ids.slide)).toEqual([ids.card, ids.side, more.chart, more.line, more.icon])
    expect(propOf(doom.nodes.get(ids.card)!, "box")).toMatchObject({ x: 100, y: 0 })
    expect(propOf(doom.nodes.get(ids.side)!, "box")).toMatchObject({ x: 400, y: 0 })
  })

  it("unwraps a laid-out frame by the boxes it was solved to", () => {
    const boxes = new Map([[ids.title, { x: 7, y: 8, w: 9, h: 10, rotation: 0, flipH: false, flipV: false }]])
    const writes = compileAgentChange(richDeck(), change({ op: "unwrap", node: ids.card }), minter(), { boxes })
    expect(writes).toContainEqual(
      expect.objectContaining({ node: ids.title, prop: "box", value: expect.objectContaining({ x: 107, y: 8 }) }),
    )
  })

  it("refuses nodes from different parents, an empty list, a slide, a shape unwrapped and a chart unwrapped", () => {
    expect(refusal(richDeck(), { op: "wrap", nodes: [ids.card, ids.title] })).toMatchObject({
      refused: "shape",
      field: "nodes",
    })
    expect(refusal(richDeck(), { op: "wrap", nodes: [ids.slide] })).toMatchObject({ refused: "shape", field: "nodes" })
    expect(refusal(richDeck(), { op: "unwrap", node: ids.title })).toMatchObject({ refused: "shape", field: "node" })
    expect(refusal(richDeck(), { op: "unwrap", node: more.chart })).toMatchObject({ refused: "shape", field: "node" })
    expect(refusal(richDeck(), { op: "wrap", nodes: ["z:9"] })).toMatchObject({
      refused: "missing",
      field: "nodes",
      change: "wrap z:9",
    })
  })
})

describe("delete", () => {
  it("removes nodes by clearing their parent, which undo can put back", () => {
    const doom = build(richDeck(), change({ op: "delete", nodes: [ids.card, more.line] }))
    expect(kids(doom, ids.slide)).toEqual([ids.side, more.chart, more.icon])
    expect(parentOf(doom.nodes.get(ids.card)!)).toBeNull()
  })

  it("refuses a slide, a missing node and a node already deleted", () => {
    expect(refusal(richDeck(), { op: "delete", nodes: [ids.slide] })).toMatchObject({
      refused: "shape",
      field: "nodes",
    })
    expect(refusal(richDeck(), { op: "delete", nodes: ["z:9"] })).toMatchObject({ refused: "missing", field: "nodes" })
    const gone = land(richDeck(), [{ node: ids.card, prop: "parent", value: null }])
    expect(refusal(gone, { op: "delete", nodes: [ids.card] })).toMatchObject({ refused: "missing" })
  })
})
