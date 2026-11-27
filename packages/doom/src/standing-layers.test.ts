import { describe, expect, it } from "vitest"
import { applyEdit, isRefusal, nodeId, rev, type Landed, type Doom, type NodeId, type Write } from "./index.js"
import { invert } from "./invert.js"
import { box, create, ids, land, once, person, place, sampleDeck } from "./sample-deck.js"

function step(doom: Doom, writes: readonly Write[]) {
  const edit: Landed = { once: once(), author: person, writes, rev: rev(doom.rev + 1) }
  const after = applyEdit(doom, edit)
  if (isRefusal(after)) throw new Error(`refused ${JSON.stringify(after)}`)
  return { before: doom, after, edit }
}

describe("an undo that leaves a layer in its new frame", () => {
  it("puts back a flip the step gave a layer it leaves in its new frame", () => {
    const { before, after, edit } = step(sampleDeck(), [
      { node: ids.title, prop: "parent", value: place(ids.side) },
      { node: ids.title, prop: "box", value: { ...box(30, 40), flipH: true, flipV: true } },
    ])
    const later = step(after, [{ node: ids.card, prop: "parent", value: null }])
    expect(invert(before, later.after, edit)).toEqual([
      { node: ids.title, prop: "box", value: box(30, 40), base: edit.rev },
    ])
  })

  it("takes back the turn a step gave a layer it leaves in its new frame", () => {
    const { before, after, edit } = step(sampleDeck(), [
      { node: ids.title, prop: "parent", value: place(ids.side) },
      { node: ids.title, prop: "box", value: { ...box(30, 40), rotation: 45 } },
    ])
    const later = step(after, [{ node: ids.card, prop: "parent", value: null }])
    expect(invert(before, later.after, edit)).toEqual([
      { node: ids.title, prop: "box", value: box(30, 40), base: edit.rev },
    ])
  })

  it("takes back only the step's own turn, and keeps a turn someone else gave the new frame after it", () => {
    const turned = land(sampleDeck(), [{ node: ids.card, prop: "box", value: { ...box(100), rotation: 30 } }])
    const { before, after, edit } = step(turned, [
      { node: ids.title, prop: "parent", value: place(ids.side) },
      { node: ids.title, prop: "box", value: { ...box(130), rotation: 45 } },
    ])
    const theirs = step(after, [{ node: ids.side, prop: "box", value: { ...box(400), rotation: 25 } }])
    const later = step(theirs.after, [{ node: ids.card, prop: "parent", value: null }])
    expect(invert(before, later.after, edit)).toEqual([
      { node: ids.title, prop: "box", value: { ...box(130), rotation: 30 }, base: edit.rev },
    ])
  })

  it("takes back the step's own turn from a layer someone moved out of the frame the step left it in", () => {
    const turned = land(sampleDeck(), [{ node: ids.card, prop: "box", value: { ...box(100), rotation: 30 } }])
    const { before, after, edit } = step(turned, [
      { node: ids.title, prop: "box", value: { ...box(0, 20), rotation: 15 } },
    ])
    const moved = step(after, [{ node: ids.title, prop: "parent", value: place(ids.side) }])
    expect(invert(before, moved.after, edit)).toEqual([
      { node: ids.title, prop: "box", value: box(0, 20), base: edit.rev },
    ])
  })

  it("puts back a turn the step gave the new frame, so the layer it leaves there turns back with it", () => {
    const { before, after, edit } = step(sampleDeck(), [
      { node: ids.title, prop: "parent", value: place(ids.side) },
      { node: ids.title, prop: "box", value: box(30, 40) },
      { node: ids.side, prop: "box", value: { ...box(400), rotation: 30 } },
    ])
    const later = step(after, [{ node: ids.card, prop: "parent", value: null }])
    expect(invert(before, later.after, edit)).toEqual([
      { node: ids.side, prop: "box", value: box(400), base: edit.rev },
    ])
  })

  it("never turns a layer against a turn someone else gave its new frame after the step", () => {
    const turned = land(sampleDeck(), [{ node: ids.card, prop: "box", value: { ...box(100), rotation: 30 } }])
    const { before, after, edit } = step(turned, [
      { node: ids.title, prop: "parent", value: place(ids.side) },
      { node: ids.title, prop: "box", value: { ...box(130), rotation: 30 } },
    ])
    const theirs = step(after, [{ node: ids.side, prop: "box", value: { ...box(400), rotation: 25 } }])
    const later = step(theirs.after, [{ node: ids.card, prop: "parent", value: null }])
    expect(invert(before, later.after, edit)).toEqual([])
  })

  it("keeps a turn someone else gave the frame a step made around the layer, and keeps that frame", () => {
    const wrap = nodeId("t:10")
    const turned = land(sampleDeck(), [{ node: ids.card, prop: "box", value: { ...box(100), rotation: 30 } }])
    const { before, after, edit } = step(turned, [
      ...create(wrap, "frame", ids.card, { node: wrap, prop: "box", value: box(0) }),
      { node: ids.title, prop: "parent", value: place(wrap) },
      { node: ids.title, prop: "box", value: box(5) },
    ])
    const theirs = step(after, [{ node: wrap, prop: "box", value: { ...box(0), rotation: 45 } }])
    const later = step(theirs.after, [{ node: ids.card, prop: "parent", value: null }])
    expect(invert(before, later.after, edit)).toEqual([])
  })

  it("keeps both ends a line has, attached or free, when the step moved the line and someone moved the frame it left", () => {
    const line = nodeId("t:10")
    const anchor = nodeId("t:11")
    const lineOf = (start: unknown, end: unknown, route = "straight") => ({
      kind: "line",
      start,
      end,
      route,
      arrows: ["none", "none"],
    })
    const [toAnchor, toCaption, free, moved, onAnchor] = [
      { node: anchor, site: "r" },
      { node: ids.caption, site: "l" },
      { x: 10, y: 10 },
      { x: 50, y: 60 },
      { x: -200, y: 50 },
    ]
    for (const [was, now, back] of [
      [lineOf(toAnchor, free), lineOf(onAnchor, moved, "elbow"), [lineOf(onAnchor, moved)]],
      [lineOf(free, toAnchor), lineOf(toCaption, onAnchor), []],
    ] as const) {
      const deck = land(sampleDeck(), [
        ...create(anchor, "shape", ids.slide, { node: anchor, prop: "box", value: box(0) }),
        ...create(line, "shape", ids.card, { node: line, prop: "geometry", value: was }),
      ])
      const { before, after, edit } = step(deck, [
        { node: line, prop: "parent", value: place(ids.side) },
        { node: line, prop: "geometry", value: now },
      ])
      const later = step(after, [{ node: ids.card, prop: "parent", value: null }])
      expect(invert(before, later.after, edit)).toEqual(
        back.map((value) => ({ node: line, prop: "geometry", value, base: edit.rev })),
      )
    }
  })

  it("keeps the end a line has when the shape it was attached to would draw that end somewhere else", () => {
    const line = nodeId("t:10")
    const anchor = nodeId("t:11")
    const lineOf = (start: unknown) => ({
      kind: "line",
      start,
      end: { x: 10, y: 10 },
      route: "straight",
      arrows: ["none", "none"],
    })
    const deck = land(sampleDeck(), [
      ...create(anchor, "shape", ids.slide, { node: anchor, prop: "box", value: box(0) }),
      ...create(line, "shape", ids.card, { node: line, prop: "geometry", value: lineOf({ node: anchor, site: "r" }) }),
    ])
    const { before, after, edit } = step(deck, [
      { node: line, prop: "parent", value: place(ids.side) },
      { node: line, prop: "geometry", value: lineOf({ x: -200, y: 50 }) },
    ])
    const theirs = step(after, [
      { node: ids.card, prop: "parent", value: null },
      { node: anchor, prop: "box", value: box(50) },
    ])
    expect(invert(before, theirs.after, edit)).toEqual([])
  })

  it("keeps the end a line has when another person deleted the shape it was attached to and the frame the step moved it out of", () => {
    const line = nodeId("t:10")
    const anchor = nodeId("t:11")
    const lineOf = (start: unknown) => ({
      kind: "line",
      start,
      end: { x: 10, y: 10 },
      route: "straight",
      arrows: ["none", "none"],
    })
    const deck = land(sampleDeck(), [
      ...create(anchor, "shape", ids.slide, { node: anchor, prop: "box", value: box(0) }),
      ...create(line, "shape", ids.card, { node: line, prop: "geometry", value: lineOf({ node: anchor, site: "r" }) }),
    ])
    const { before, after, edit } = step(deck, [
      { node: line, prop: "parent", value: place(ids.side) },
      { node: line, prop: "geometry", value: lineOf({ x: 60, y: 40 }) },
    ])
    const theirs = step(after, [
      { node: ids.card, prop: "parent", value: null },
      { node: anchor, prop: "parent", value: null },
    ])
    expect(invert(before, theirs.after, edit)).toEqual([])
  })

  it("keeps the end a line has when another person moved the line and deleted the shape it was attached to since the step freed that end", () => {
    const line = nodeId("t:10")
    const anchor = nodeId("t:11")
    const lineOf = (start: unknown) => ({
      kind: "line",
      start,
      end: { x: 10, y: 10 },
      route: "straight",
      arrows: ["none", "none"],
    })
    const deck = land(sampleDeck(), [
      ...create(anchor, "shape", ids.slide, { node: anchor, prop: "box", value: box(0) }),
      ...create(line, "shape", ids.card, { node: line, prop: "geometry", value: lineOf({ node: anchor, site: "r" }) }),
    ])
    const { before, after, edit } = step(deck, [{ node: line, prop: "geometry", value: lineOf({ x: 60, y: 40 }) }])
    const theirs = step(after, [
      { node: line, prop: "parent", value: place(ids.side) },
      { node: anchor, prop: "parent", value: null },
    ])
    expect(invert(before, theirs.after, edit)).toEqual([])
  })

  it("keeps the end a line has when the shape it was attached to is hidden, under a hidden frame, or on another slide, since the layout gives that shape no box on the line's slide", () => {
    const line = nodeId("t:10")
    const anchor = nodeId("t:11")
    const wrap = nodeId("t:12")
    const other = nodeId("t:13")
    const lineOf = (start: unknown) => ({
      kind: "line",
      start,
      end: { x: 10, y: 10 },
      route: "straight",
      arrows: ["none", "none"],
    })
    const hide = (node: NodeId): Write => ({ node, prop: "hidden", value: true })
    for (const takeAway of [
      [hide(anchor)],
      [hide(wrap), { node: anchor, prop: "parent", value: place(wrap) }],
      [{ node: anchor, prop: "parent", value: place(other) }],
    ] as const) {
      const deck = land(sampleDeck(), [
        ...create(other, "slide", ids.row),
        ...create(wrap, "frame", ids.slide, { node: wrap, prop: "box", value: box(0) }),
        ...create(anchor, "shape", ids.slide, { node: anchor, prop: "box", value: box(0) }),
        ...create(line, "shape", ids.card, {
          node: line,
          prop: "geometry",
          value: lineOf({ node: anchor, site: "r" }),
        }),
      ])
      const { before, after, edit } = step(deck, [
        { node: line, prop: "parent", value: place(ids.side) },
        { node: line, prop: "geometry", value: lineOf({ x: 60, y: 40 }) },
      ])
      const theirs = step(after, [{ node: ids.card, prop: "parent", value: null }, ...takeAway])
      expect(invert(before, theirs.after, edit)).toEqual([])
    }
  })

  it("keeps the end a line has when the undo itself puts the shape back into a frame hidden since", () => {
    const line = nodeId("t:10")
    const anchor = nodeId("t:11")
    const wrap = nodeId("t:12")
    const lineOf = (start: unknown) => ({
      kind: "line",
      start,
      end: { x: 10, y: 10 },
      route: "straight",
      arrows: ["none", "none"],
    })
    const deck = land(sampleDeck(), [
      ...create(wrap, "frame", ids.slide, { node: wrap, prop: "box", value: box(0) }),
      ...create(anchor, "shape", wrap, { node: anchor, prop: "box", value: box(0) }),
      ...create(line, "shape", ids.card, { node: line, prop: "geometry", value: lineOf({ node: anchor, site: "r" }) }),
    ])
    const { before, after, edit } = step(deck, [
      { node: anchor, prop: "parent", value: place(ids.slide) },
      { node: line, prop: "parent", value: place(ids.side) },
      { node: line, prop: "geometry", value: lineOf({ x: -200, y: 50 }) },
    ])
    const theirs = step(after, [
      { node: ids.card, prop: "parent", value: null },
      { node: wrap, prop: "hidden", value: true },
    ])
    const writes = invert(before, theirs.after, edit)
    expect(writes).toContainEqual({ node: anchor, prop: "parent", value: place(wrap), base: edit.rev })
    expect(writes.filter((each) => each.node === line)).toEqual([])
  })

  it("keeps the end a line has when the undo itself shows the shape it was attached to again", () => {
    const line = nodeId("t:10")
    const anchor = nodeId("t:11")
    const lineOf = (start: unknown) => ({
      kind: "line",
      start,
      end: { x: 10, y: 10 },
      route: "straight",
      arrows: ["none", "none"],
    })
    const deck = land(sampleDeck(), [
      ...create(anchor, "shape", ids.slide, { node: anchor, prop: "box", value: box(0) }),
      ...create(line, "shape", ids.card, { node: line, prop: "geometry", value: lineOf({ node: anchor, site: "r" }) }),
    ])
    const { before, after, edit } = step(deck, [
      { node: anchor, prop: "hidden", value: true },
      { node: line, prop: "parent", value: place(ids.side) },
      { node: line, prop: "geometry", value: lineOf({ x: -200, y: 50 }) },
    ])
    const later = step(after, [{ node: ids.card, prop: "parent", value: null }])
    const writes = invert(before, later.after, edit)
    expect(writes.map((each) => each.node)).toEqual([anchor])
    expect(writes.filter((each) => each.node === line)).toEqual([])
  })

  it("keeps the end a line has once the shape it was attached to shows on the line's slide again", () => {
    const line = nodeId("t:10")
    const anchor = nodeId("t:11")
    const lineOf = (start: unknown) => ({
      kind: "line",
      start,
      end: { x: 10, y: 10 },
      route: "straight",
      arrows: ["none", "none"],
    })
    const deck = land(sampleDeck(), [
      ...create(anchor, "shape", ids.slide, { node: anchor, prop: "box", value: box(0) }),
      ...create(line, "shape", ids.card, { node: line, prop: "geometry", value: lineOf({ node: anchor, site: "r" }) }),
    ])
    const { before, after, edit } = step(deck, [
      { node: line, prop: "parent", value: place(ids.side) },
      { node: line, prop: "geometry", value: lineOf({ x: -200, y: 50 }) },
    ])
    const hidden = step(after, [{ node: anchor, prop: "hidden", value: true }])
    const shown = step(hidden.after, [{ node: anchor, prop: "hidden", value: false }])
    const later = step(shown.after, [{ node: ids.card, prop: "parent", value: null }])
    expect(invert(before, later.after, edit)).toEqual([])
  })

  it("puts back the size of a frame that had no box, and keeps where it sits", () => {
    const bare = nodeId("t:10")
    const deck = land(sampleDeck(), create(bare, "frame", ids.card))
    const { before, after, edit } = step(deck, [
      { node: bare, prop: "parent", value: place(ids.side) },
      { node: bare, prop: "box", value: box(30, 40, 300, 150) },
    ])
    const later = step(after, [{ node: ids.card, prop: "parent", value: null }])
    expect(invert(before, later.after, edit)).toEqual([
      { node: bare, prop: "box", value: box(30, 40, 0, 0), base: edit.rev },
    ])
  })
})
