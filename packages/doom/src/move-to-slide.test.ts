import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { build, compiled, minter } from "./agent-fixtures.js"
import { doomFromTree } from "./doom-tree.js"
import { boxOf, childrenOf, parentOf, propOf } from "./doom-walk.js"
import { compileAgentEdit, invert, isRefusal, moveToSlide, type Doom, type NodeId } from "./index.js"
import { apply, boxMatrix, identity } from "./matrix.js"
import { ids, land, person } from "./sample-deck.js"
import { column, measure, padding, plainTheme, spot } from "./testing/doom-fixtures-art.js"
import { step } from "./testing/invert-edit.js"
import { more, richDeck } from "./testing/rich-deck.js"
import { solveLayout } from "./solve-layout.js"
import type { Point } from "./resolved.js"

const change = (value: Record<string, unknown>) => value as AgentChange
const refusal = (doom: Doom, value: Record<string, unknown>) => compileAgentChange(doom, change(value), minter())

function across(view: Doom, moved: readonly NodeId[], slide: NodeId, at: Point) {
  const result = moveToSlide(view, moved, slide, at)
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return { result, landed: step(view, result.writes) }
}

function joined() {
  return doomFromTree({
    theme: plainTheme,
    slides: [
      {
        children: [
          { type: "shape", name: "a", props: { box: spot(100, 100, 80, 40), mask: true } },
          { type: "shape", name: "b", props: { box: spot(300, 100, 80, 40) } },
          {
            type: "shape",
            name: "line",
            props: (named) => ({
              box: spot(100, 120, 280, 0),
              geometry: {
                kind: "line" as const,
                start: { node: named.a!, site: "r" as const },
                end: { node: named.b!, site: "l" as const },
                route: "straight" as const,
                arrows: ["none", "none"] as const,
              },
            }),
          },
          {
            type: "frame",
            name: "nest",
            props: { box: spot(40, 400, 120, 80) },
            children: [{ type: "shape", name: "inner", props: { box: spot(8, 6, 20, 10) } }],
          },
        ],
      },
      { name: "two", children: [{ type: "shape", name: "kept", props: { box: spot(0, 0, 10, 10) } }] },
    ],
  })
}

describe("moveToSlide", () => {
  it("moves a frame's subtree onto the slide at one place and keeps each node's id", () => {
    const deck = richDeck()
    const { result, landed } = across(deck, [ids.side, ids.card], more.slide2, { x: 40, y: 60 })
    expect(result.writes.some((write) => write.prop === "type")).toBe(false)
    expect([...landed.after.nodes.keys()].sort()).toEqual([...deck.nodes.keys()].sort())
    expect(parentOf(landed.after.nodes.get(ids.card)!)?.id).toBe(more.slide2)
    expect(parentOf(landed.after.nodes.get(ids.side)!)?.id).toBe(more.slide2)
    expect(parentOf(landed.after.nodes.get(ids.title)!)?.id).toBe(ids.card)
    expect(propOf(landed.after.nodes.get(ids.card)!, "box")).toMatchObject({ x: 40, y: 60, w: 200, h: 100 })
    expect(propOf(landed.after.nodes.get(ids.side)!, "box")).toMatchObject({ x: 340, y: 60 })
    expect(propOf(landed.after.nodes.get(ids.title)!, "box")).toMatchObject({ x: 0, y: 0 })
    expect(
      childrenOf(landed.after, more.slide2)
        .map((node) => node.id)
        .slice(-2),
    ).toEqual([ids.card, ids.side])
  })

  it("keeps a selected child inside its frame when the frame moves too", () => {
    const grown = joined()
    const { landed } = across(grown.doom, [grown.ids.nest!, grown.ids.inner!], grown.slides[1]!, { x: 12, y: 18 })
    expect(parentOf(landed.after.nodes.get(grown.ids.inner!)!)?.id).toBe(grown.ids.nest)
    expect(propOf(landed.after.nodes.get(grown.ids.inner!)!, "box")).toMatchObject({ x: 8, y: 6 })
    expect(propOf(landed.after.nodes.get(grown.ids.nest!)!, "box")).toMatchObject({ x: 12, y: 18 })
  })

  it("keeps a mask on the layer that moves", () => {
    const grown = joined()
    const { landed } = across(grown.doom, [grown.ids.a!], grown.slides[1]!, { x: 5, y: 6 })
    expect(propOf(landed.after.nodes.get(grown.ids.a!)!, "mask")).toBe(true)
  })

  it("moves a connector with both shapes, and leaves it attached when one shape stays", () => {
    const grown = joined()
    const both = across(grown.doom, [grown.ids.a!, grown.ids.b!], grown.slides[1]!, { x: 10, y: 20 })
    expect(parentOf(both.landed.after.nodes.get(grown.ids.line!)!)?.id).toBe(grown.slides[1])
    expect(propOf(both.landed.after.nodes.get(grown.ids.line!)!, "geometry")).toMatchObject({
      start: { node: grown.ids.a, site: "r" },
      end: { node: grown.ids.b, site: "l" },
    })
    expect(propOf(both.landed.after.nodes.get(grown.ids.a!)!, "box")).toMatchObject({ x: 10, y: 20 })
    expect(propOf(both.landed.after.nodes.get(grown.ids.b!)!, "box")).toMatchObject({ x: 210, y: 20 })
    expect(childrenOf(both.landed.after, grown.slides[1]!).map((node) => node.id)).toEqual([
      grown.ids.kept,
      grown.ids.a,
      grown.ids.b,
      grown.ids.line,
    ])
    expect(both.result.moved).toEqual([grown.ids.a, grown.ids.b, grown.ids.line])
    const one = across(grown.doom, [grown.ids.a!], grown.slides[1]!, { x: 10, y: 20 })
    expect(one.result.moved).toEqual([grown.ids.a])
    expect(parentOf(one.landed.after.nodes.get(grown.ids.line!)!)?.id).toBe(grown.slides[0])
    expect(propOf(one.landed.after.nodes.get(grown.ids.line!)!, "geometry")).toMatchObject({
      start: { node: grown.ids.a, site: "r" },
      end: { node: grown.ids.b, site: "l" },
    })
  })

  it("moves a free line's ends by the same shift as its box", () => {
    const deck = richDeck()
    const { landed } = across(deck, [more.line], more.slide2, { x: 10, y: 30 })
    expect(propOf(landed.after.nodes.get(more.line)!, "box")).toMatchObject({ x: 10, y: 30 })
    expect(propOf(landed.after.nodes.get(more.line)!, "geometry")).toMatchObject({
      start: { x: 10, y: 30 },
      end: { x: 310, y: 30 },
    })
  })

  it("moves an auto-layout child out of its frame, and moves the frame with the child still inside", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "frame",
              name: "flow",
              props: { box: spot(0, 0, 200, 200), layout: column() },
              children: [{ type: "shape", name: "kid", props: { box: spot(0, 0, 40, 20) } }],
            },
          ],
        },
        { name: "two", children: [] },
      ],
    })
    const child = across(grown.doom, [grown.ids.kid!], grown.slides[1]!, { x: 12, y: 34 })
    expect(parentOf(child.landed.after.nodes.get(grown.ids.kid!)!)?.id).toBe(grown.slides[1])
    expect(propOf(child.landed.after.nodes.get(grown.ids.kid!)!, "box")).toMatchObject({ x: 12, y: 34, w: 40, h: 20 })
    const frame = across(grown.doom, [grown.ids.flow!], grown.slides[1]!, { x: 4, y: 8 })
    expect(parentOf(frame.landed.after.nodes.get(grown.ids.kid!)!)?.id).toBe(grown.ids.flow)
    expect(propOf(frame.landed.after.nodes.get(grown.ids.flow!)!, "layout")).toMatchObject({ mode: "column" })
  })

  it("one undo puts parents, boxes, order and a connector back", () => {
    const grown = joined()
    const { landed } = across(grown.doom, [grown.ids.a!, grown.ids.b!], grown.slides[1]!, { x: 10, y: 20 })
    const back = step(landed.after, invert(landed.before, landed.after, landed.edit))
    expect(parentOf(back.after.nodes.get(grown.ids.a!)!)?.id).toBe(grown.slides[0])
    expect(parentOf(back.after.nodes.get(grown.ids.line!)!)?.id).toBe(grown.slides[0])
    expect(propOf(back.after.nodes.get(grown.ids.a!)!, "box")).toMatchObject({ x: 100, y: 100 })
    expect(propOf(back.after.nodes.get(grown.ids.b!)!, "box")).toMatchObject({ x: 300, y: 100 })
    expect(childrenOf(back.after, grown.slides[0]!).map((node) => node.id)).toEqual(
      childrenOf(grown.doom, grown.slides[0]!).map((node) => node.id),
    )
  })

  it("refuses a slide, a locked layer, a missing layer and an empty list", () => {
    const deck = richDeck()
    const locked = land(deck, [{ node: ids.card, prop: "locked", value: true }])
    expect(moveToSlide(deck, [ids.slide], more.slide2, { x: 0, y: 0 })).toMatchObject({
      refused: "shape",
      form: "A frame or a shape.",
    })
    expect(moveToSlide(locked, [ids.card], more.slide2, { x: 0, y: 0 })).toMatchObject({
      refused: "shape",
      form: "This layer is locked. Unlock it or choose another.",
    })
    expect(moveToSlide(deck, ["z:9" as NodeId], more.slide2, { x: 0, y: 0 })).toMatchObject({
      refused: "missing",
      field: "node",
    })
    expect(moveToSlide(deck, [], more.slide2, { x: 0, y: 0 })).toMatchObject({ refused: "shape", field: "nodes" })
    expect(moveToSlide(deck, [ids.card], ids.card, { x: 0, y: 0 })).toMatchObject({
      refused: "shape",
      form: "A slide.",
    })
  })
})

describe("an agent move onto a slide", () => {
  it("places several layers in one edit, and one undo restores them", () => {
    const before = richDeck()
    const asked = change({
      op: "move",
      nodes: [ids.side, ids.card],
      into: more.slide2,
      box: { x: 40, y: 60, w: 200, h: 100 },
    })
    const writes = compiled(before, asked)
    const landed = step(before, writes)
    expect(parentOf(landed.after.nodes.get(ids.title)!)?.id).toBe(ids.card)
    expect(propOf(landed.after.nodes.get(ids.card)!, "box")).toMatchObject({ x: 40, y: 60 })
    expect(
      childrenOf(landed.after, more.slide2)
        .map((node) => node.id)
        .slice(-2),
    ).toEqual([ids.card, ids.side])
    const back = step(landed.after, invert(landed.before, landed.after, landed.edit))
    expect(parentOf(back.after.nodes.get(ids.card)!)?.id).toBe(ids.slide)
    expect(propOf(back.after.nodes.get(ids.card)!, "box")).toMatchObject({ x: 100, y: 0 })
  })

  it("keeps the place when the box is left out", () => {
    const doom = build(richDeck(), change({ op: "move", nodes: [ids.card], into: more.slide2 }))
    expect(parentOf(doom.nodes.get(ids.card)!)?.id).toBe(more.slide2)
    expect(propOf(doom.nodes.get(ids.card)!, "box")).toMatchObject({ x: 100, y: 0 })
  })

  it("refuses a slide, both node and nodes, and a move with no target", () => {
    expect(refusal(richDeck(), { op: "move", nodes: [ids.slide], into: more.slide2 })).toMatchObject({
      refused: "shape",
      field: "node",
    })
    expect(refusal(richDeck(), { op: "move", node: ids.card, nodes: [ids.side], into: more.slide2 })).toMatchObject({
      refused: "shape",
      field: "nodes",
    })
    expect(refusal(richDeck(), { op: "move", nodes: [ids.card] })).toMatchObject({
      refused: "shape",
      field: "into",
      fault: "needs",
      needs: "a destination slide id",
    })
  })
})

describe("a move composes the transforms it crosses", () => {
  function turned() {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "frame",
              name: "group",
              props: { box: { ...spot(50, 50, 100, 100), rotation: 90 } },
              children: [{ type: "shape", name: "nested", props: { box: { ...spot(20, 10, 30, 10), flipH: true } } }],
            },
            {
              type: "frame",
              name: "flow",
              props: { box: spot(0, 0, 200, 180), layout: column({}, 0, padding(20)) },
              children: [{ type: "shape", name: "flowChild", props: { box: spot(7, 9, 20, 20) } }],
            },
            {
              type: "shape",
              name: "rotated",
              props: { box: { ...spot(100, 200, 80, 40), rotation: 90, flipV: true } },
            },
            { type: "shape", name: "flat", props: { box: spot(160, 235, 30, 30) } },
            {
              type: "shape",
              name: "loose",
              props: {
                box: spot(10, 20, 40, 0),
                geometry: {
                  kind: "line" as const,
                  start: { x: 10, y: 20 },
                  end: { x: 50, y: 20 },
                  route: "straight" as const,
                  arrows: ["none", "none"] as const,
                },
              },
            },
          ],
        },
        { children: [] },
      ],
    })
    return { view: grown.doom, named: grown.ids, from: grown.slides[0]!, to: grown.slides[1]! }
  }

  const corners = (view: Doom, id: NodeId, parent?: NodeId) => {
    const box = boxOf(view.nodes.get(id)!)
    const matrix = boxMatrix(parent === undefined ? identity : boxMatrix(identity, boxOf(view.nodes.get(parent)!)), box)
    return [
      apply(matrix, { x: 0, y: 0 }),
      apply(matrix, { x: box.w, y: 0 }),
      apply(matrix, { x: 0, y: box.h }),
      apply(matrix, { x: box.w, y: box.h }),
    ]
  }

  it("places the painted union of a turned layer and a flat layer at the requested point", () => {
    const { view, named, to } = turned()
    const moved = across(view, [named.rotated!, named.flat!], to, { x: 330, y: 440 }).landed.after
    expect(propOf(moved.nodes.get(named.rotated!)!, "box")).toMatchObject({ rotation: 90, flipV: true })
    const painted = [...corners(moved, named.rotated!), ...corners(moved, named.flat!)]
    expect({ x: Math.min(...painted.map(({ x }) => x)), y: Math.min(...painted.map(({ y }) => y)) }).toEqual({
      x: 330,
      y: 440,
    })
  })

  it("keeps a child's painted edge when it leaves a turned group", () => {
    const { view, named, to } = turned()
    const id = named.nested!
    const before = corners(view, id, named.group!)
    const moved = across(view, [id], to, { x: 330, y: 440 }).landed.after
    const after = corners(moved, id)
    expect(after[1]!.x - after[0]!.x).toBeCloseTo(before[1]!.x - before[0]!.x, 6)
    expect(after[1]!.y - after[0]!.y).toBeCloseTo(before[1]!.y - before[0]!.y, 6)
    expect(propOf(moved.nodes.get(id)!, "box")).toMatchObject({ flipH: true, rotation: 90 })
  })

  it("carries a free line's ends through the frame that held them", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "frame",
              name: "group",
              props: { box: { ...spot(50, 50, 100, 100), rotation: 90 } },
              children: [
                {
                  type: "shape",
                  name: "loose",
                  props: {
                    box: spot(10, 20, 40, 0),
                    geometry: {
                      kind: "line" as const,
                      start: { x: 10, y: 20 },
                      end: { x: 50, y: 20 },
                      route: "straight" as const,
                      arrows: ["none", "none"] as const,
                    },
                  },
                },
              ],
            },
          ],
        },
        { children: [] },
      ],
    })
    const holder = boxOf(grown.doom.nodes.get(grown.ids.group!)!)
    const matrix = boxMatrix(identity, holder)
    const at = apply(matrix, { x: 10, y: 20 })
    const moved = across(grown.doom, [grown.ids.loose!], grown.slides[1]!, { x: at.x, y: at.y }).landed.after
    const line = propOf(moved.nodes.get(grown.ids.loose!)!, "geometry")
    const end = apply(matrix, { x: 50, y: 20 })
    expect(line).toMatchObject({
      start: { x: Math.round(at.x), y: Math.round(at.y) },
      end: { x: Math.round(end.x), y: Math.round(end.y) },
    })
  })

  it("bakes the layout box when the drop is the child's apparent place", () => {
    const { view, named, from, to } = turned()
    const boxes = solveLayout(view, from, measure)
    const effective = boxes.get(named.flowChild!)!
    const holder = boxes.get(named.flow!)!
    expect(effective).not.toEqual(boxOf(view.nodes.get(named.flowChild!)!))
    const at = { x: holder.x + effective.x, y: holder.y + effective.y }
    const result = moveToSlide(view, [named.flowChild!], to, at, { boxes })
    if (isRefusal(result)) throw new Error(JSON.stringify(result))
    const after = step(view, result.writes).after
    expect(propOf(after.nodes.get(named.flowChild!)!, "box")).toEqual({ ...effective, ...at })
  })

  it("bakes the resolved place for an agent's boxless move out of auto layout", () => {
    const { view, named, from, to } = turned()
    const boxes = solveLayout(view, from, measure)
    const child = boxes.get(named.flowChild!)!
    const frame = boxes.get(named.flow!)!
    const result = compileAgentEdit(view, [change({ op: "move", nodes: [named.flowChild!], into: to })], {
      author: person,
      once: "agent",
      mint: minter(),
      measure,
    })
    if (isRefusal(result)) throw new Error(JSON.stringify(result))
    expect(propOf(result.after.nodes.get(named.flowChild!)!, "box")).toMatchObject({
      x: frame.x + child.x,
      y: frame.y + child.y,
      w: child.w,
      h: child.h,
    })
  })
})
