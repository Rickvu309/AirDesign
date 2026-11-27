import { describe, expect, it } from "vitest"
import type { Intent } from "./intent-read.js"
import { compileIntent } from "./intent-compile.js"
import { build, minter } from "./testing/agent-fixtures.js"
import { more, richDeck } from "./testing/rich-deck.js"
import { ids, land } from "./sample-deck.js"
import { childrenOf, parentOf, propOf } from "./doom-walk.js"
import type { Doom } from "./doom.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

const change = (value: Record<string, unknown>) => value as Intent
const kids = (doom: Doom, id: string) => childrenOf(doom, id as never).map((node) => node.id)
const refusal = (doom: Doom, value: Record<string, unknown>) =>
  compileIntent(doom, change(value), minter(), placement, starts)

describe("move", () => {
  it("puts a node first, after a sibling, or last among its parent's children", () => {
    const base = richDeck()
    expect(kids(base, ids.slide)).toEqual([ids.card, ids.side, more.frame, more.line, more.icon])
    expect(kids(build(base, change({ op: "move", targets: [more.icon], after: null })), ids.slide)).toEqual([
      more.icon,
      ids.card,
      ids.side,
      more.frame,
      more.line,
    ])
    expect(kids(build(base, change({ op: "move", targets: [more.icon], after: ids.card })), ids.slide)).toEqual([
      ids.card,
      more.icon,
      ids.side,
      more.frame,
      more.line,
    ])
    expect(kids(build(base, change({ op: "move", targets: [ids.card] })), ids.slide)).toEqual([
      ids.side,
      more.frame,
      more.line,
      more.icon,
      ids.card,
    ])
  })

  it("puts a node into another frame and keeps it where it was on the slide", () => {
    const doom = build(richDeck(), change({ op: "move", targets: [ids.title], parent: ids.side }))
    expect(parentOf(doom.nodes.get(ids.title)!)?.id).toBe(ids.side)
    expect(propOf(doom.nodes.get(ids.title)!, "box")).toMatchObject({ x: -300, y: 0, w: 200, h: 100 })
  })

  it("moves a node to the slide from a frame, adding the frame's offset", () => {
    const doom = build(richDeck(), change({ op: "move", targets: [ids.title], parent: ids.slide }))
    expect(propOf(doom.nodes.get(ids.title)!, "box")).toMatchObject({ x: 100, y: 0 })
  })

  it("moves to another slide", () => {
    const doom = build(richDeck(), change({ op: "move", targets: [ids.card], parent: more.slide2 }))
    expect(parentOf(doom.nodes.get(ids.card)!)?.id).toBe(more.slide2)
  })

  it("refuses a cycle, a slide with no place, a shape as a parent, an unknown sibling and itself", () => {
    expect(refusal(richDeck(), { op: "move", targets: [ids.card], parent: ids.title })).toMatchObject({
      refused: "shape",
      field: "parent",
    })
    expect(refusal(richDeck(), { op: "move", targets: [ids.card], parent: ids.card })).toMatchObject({
      refused: "cycle",
      node: ids.card,
    })
    expect(refusal(richDeck(), { op: "move", targets: [ids.slide] })).toMatchObject({
      refused: "shape",
      field: "after",
    })
    expect(refusal(richDeck(), { op: "move", targets: [ids.card], after: "z:9" })).toMatchObject({
      refused: "missing",
      field: "after",
    })
    expect(refusal(richDeck(), { op: "move", targets: [ids.card], after: ids.card })).toMatchObject({
      refused: "shape",
      field: "after",
    })
    expect(refusal(richDeck(), { op: "move", targets: ["z:9"] })).toEqual({
      refused: "missing",
      node: "z:9",
      field: "targets",
      change: "move z:9",
    })
  })

  it("refuses a move of a frame into one of its own descendants", () => {
    const nested = build(richDeck(), change({ op: "move", targets: [ids.side], parent: ids.card }))
    expect(refusal(nested, { op: "move", targets: [ids.card], parent: ids.side })).toMatchObject({
      refused: "cycle",
      node: ids.card,
    })
  })
})

describe("wrap and unwrap", () => {
  it("styles the group it makes in the same change", () => {
    const doom = build(
      richDeck(),
      change({ op: "group", targets: [ids.side, more.frame], fill: "background2", radius: 12, name: "Card" }),
    )
    const frame = kids(doom, ids.slide).find((id) => kids(doom, id).includes(ids.side))!
    expect(kids(doom, frame)).toEqual([ids.side, more.frame])
    expect(propOf(doom.nodes.get(frame)!, "fills")).toEqual([{ kind: "solid", color: { var: "background2" } }])
    expect(propOf(doom.nodes.get(frame)!, "radius")).toBe(12)
    expect(propOf(doom.nodes.get(frame)!, "name")).toBe("Card")
  })

  it("makes no group when its style is refused", () => {
    expect(refusal(richDeck(), { op: "group", targets: [ids.side, more.frame], textStyle: "title" })).toMatchObject({
      refused: "shape",
      field: "textStyle",
      kind: "frame",
    })
  })

  const wrapped = (more2: Record<string, unknown> = {}) =>
    build(richDeck(), change({ op: "group", targets: [ids.side, ids.card], ...more2 }))

  it("wraps siblings into one frame that covers them, where the frontmost of them was, in their order", () => {
    const doom = wrapped()
    const frame = childrenOf(doom, ids.slide)[0]!
    expect(frame.type).toBe("frame")
    expect(propOf(frame, "box")).toMatchObject({ x: 100, y: 0, w: 500, h: 100 })
    expect(propOf(frame, "layout")).toBeUndefined()
    expect(propOf(frame, "sizing")).toEqual({ w: "hug", h: "hug" })
    expect(kids(doom, frame.id)).toEqual([ids.card, ids.side])
    expect(propOf(doom.nodes.get(ids.card)!, "box")).toMatchObject({ x: 0, y: 0 })
    expect(propOf(doom.nodes.get(ids.side)!, "box")).toMatchObject({ x: 300, y: 0 })
    expect(kids(doom, ids.slide)).toEqual([frame.id, more.frame, more.line, more.icon])
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
    const doom = build(wrapped(), change({ op: "ungroup", target: childrenOf(wrapped(), ids.slide)[0]!.id }))
    expect(kids(doom, ids.slide)).toEqual([ids.card, ids.side, more.frame, more.line, more.icon])
    expect(propOf(doom.nodes.get(ids.card)!, "box")).toMatchObject({ x: 100, y: 0 })
    expect(propOf(doom.nodes.get(ids.side)!, "box")).toMatchObject({ x: 400, y: 0 })
  })

  it("unwraps a laid-out frame by the boxes it was solved to", () => {
    const boxes = new Map([[ids.title, { x: 7, y: 8, w: 9, h: 10, rotation: 0, flipH: false, flipV: false }]])
    const writes = compileIntent(richDeck(), change({ op: "ungroup", target: ids.card }), minter(), placement, starts, {
      boxes,
    })
    expect(writes).toContainEqual(
      expect.objectContaining({ node: ids.title, prop: "box", value: expect.objectContaining({ x: 107, y: 8 }) }),
    )
  })

  it("refuses nodes from different parents, an empty list, a slide and an unwrapped shape", () => {
    expect(refusal(richDeck(), { op: "group", targets: [ids.card, ids.title] })).toMatchObject({
      refused: "shape",
      field: "targets",
    })
    expect(refusal(richDeck(), { op: "group", targets: [ids.slide] })).toMatchObject({
      refused: "shape",
      field: "targets",
    })
    expect(refusal(richDeck(), { op: "ungroup", target: ids.title })).toMatchObject({
      refused: "shape",
      field: "target",
    })
    expect(refusal(richDeck(), { op: "group", targets: ["z:9"] })).toMatchObject({
      refused: "missing",
      field: "targets",
      change: "group z:9",
    })
  })
})

describe("delete", () => {
  it("removes nodes by clearing their parent, which undo can put back", () => {
    const doom = build(richDeck(), change({ op: "remove", targets: [ids.card, more.line] }))
    expect(kids(doom, ids.slide)).toEqual([ids.side, more.frame, more.icon])
    expect(parentOf(doom.nodes.get(ids.card)!)).toBeNull()
  })

  it("removes layers and slides together in one change", () => {
    const doom = build(richDeck(), change({ op: "remove", targets: [ids.card, more.slide2] }))
    expect(parentOf(doom.nodes.get(ids.card)!)).toBeNull()
    expect(parentOf(doom.nodes.get(more.slide2)!)).toBeNull()
    expect(kids(doom, ids.slide)).not.toContain(ids.card)
  })

  it("refuses a missing node and a node already deleted", () => {
    expect(refusal(richDeck(), { op: "remove", targets: ["z:9"] })).toMatchObject({
      refused: "missing",
      field: "targets",
    })
    const gone = land(richDeck(), [{ node: ids.card, prop: "parent", value: null }])
    expect(refusal(gone, { op: "remove", targets: [ids.card] })).toMatchObject({ refused: "missing" })
  })
})
