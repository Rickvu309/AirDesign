import { describe, expect, it } from "vitest"
import { doomFromTree } from "./doom-tree.js"
import { freeLineEnds, invert, nodeId, type Doom, type Write } from "./index.js"
import { measure, plainTheme, spot } from "./testing/doom-fixtures-art.js"
import { attached, deck, detach, freePoint, lineOf, startOf, step } from "./testing/line-end-fixtures.js"

const landed = (doom: Doom, writes: readonly Write[]) => step(doom, "late", writes).after

const moved = (node: string, x: number, y: number): Write => ({
  node: node as Write["node"],
  prop: "box",
  value: spot(x, y, 100, 50),
})

function framed() {
  return doomFromTree({
    theme: plainTheme,
    slides: [
      {
        children: [
          {
            type: "frame",
            name: "f",
            props: { box: spot(200, 200, 300, 200) },
            children: [{ type: "shape", name: "t", props: { box: spot(100, 100, 100, 50) } }],
          },
          { type: "frame", name: "j", props: { box: spot(0, 0, 100, 100) }, children: [] },
          { type: "shape", name: "l", props: attached },
        ],
      },
    ],
  })
}

describe("a change that takes a shape off the deck while a line's end is on it", () => {
  it("lands and frees the end where the shape's stored box paints, as from a tab that never saw the line attach", () => {
    const grown = deck()
    const [l, slide] = [grown.ids.l!, grown.slides[0]!]
    const gone = landed(grown.doom, detach([grown.ids.t!]))
    expect(freePoint(lineOf(gone, l).start)).toBeDefined()
    expect(startOf(gone, slide, l)).toEqual(startOf(grown.doom, slide, l))
  })

  it("lands where this tab painted when another tab moved the shape first", () => {
    const grown = deck()
    const [t, l, slide] = [grown.ids.t!, grown.ids.l!, grown.slides[0]!]
    const freed = freeLineEnds(grown.doom, detach([t]), measure)
    const theirs = step(grown.doom, "theirs", [moved(t, 550, 300)]).after
    expect(startOf(landed(theirs, freed), slide, l)).toEqual(startOf(grown.doom, slide, l))
  })

  it("lands where this tab painted when another tab moved the frame the shape sits in", () => {
    const grown = framed()
    const [t, f, l, slide] = [grown.ids.t!, grown.ids.f!, grown.ids.l!, grown.slides[0]!]
    const freed = freeLineEnds(grown.doom, detach([t]), measure)
    const theirs = step(grown.doom, "theirs", [{ node: f, prop: "box", value: spot(260, 200, 300, 200) }]).after
    expect(startOf(landed(theirs, freed), slide, l)).toEqual(startOf(grown.doom, slide, l))
  })

  it("frees a shape inside a frame it deletes where it painted", () => {
    const grown = framed()
    const [f, l, slide] = [grown.ids.f!, grown.ids.l!, grown.slides[0]!]
    const seen = startOf(grown.doom, slide, l)
    const gone = step(grown.doom, "gone", freeLineEnds(grown.doom, detach([f]), measure)).after
    expect(freePoint(lineOf(gone, l).start)).toEqual(seen)
  })

  it("preserves the original point when an inverse batch both restores the line and removes its new target", () => {
    const grown = deck()
    const [l, slide] = [grown.ids.l!, grown.slides[0]!]
    const original = { x: 230, y: 145 }
    const free = landed(grown.doom, [
      { node: l, prop: "geometry", value: { ...lineOf(grown.doom, l), start: original } },
    ])
    const target = nodeId("t3:1")
    const attached = step(free, "attach", [
      { node: target, prop: "type", value: "frame" },
      { node: target, prop: "parent", value: { id: slide, at: "a9" } },
      { node: target, prop: "box", value: spot(400, 200, 200, 100) },
      { node: l, prop: "geometry", value: { ...lineOf(free, l), start: { node: target, site: "r" } } },
    ])
    const undo = invert(attached.before, attached.after, attached.edit)
    expect(lineOf(step(attached.after, "undo", undo).after, l).start).toEqual(original)
    expect(
      lineOf(step(attached.after, "measured-undo", freeLineEnds(attached.after, undo, measure)).after, l).start,
    ).toEqual(original)
  })

  it("keeps both an explicit reattachment and the other end that still needs freeing", () => {
    const grown = deck()
    const [t, j, l] = [grown.ids.t!, grown.ids.j!, grown.ids.l!]
    const geometry = lineOf(grown.doom, l)
    const connected = landed(grown.doom, [{ node: l, prop: "geometry", value: { ...geometry, end: geometry.start } }])
    const live = { node: j, site: "l" }
    const writes: readonly Write[] = [
      { node: l, prop: "geometry", value: { ...lineOf(connected, l), start: live } },
      ...detach([t]),
    ]
    const freed = step(connected, "delete", freeLineEnds(connected, writes, measure)).after
    expect(lineOf(freed, l)).toMatchObject({ start: live, end: { x: 300, y: 225 } })
  })

  it("restores the first delete’s free point when redoing it after the shape moved", () => {
    const grown = deck()
    const [t, slide, l] = [grown.ids.t!, grown.slides[0]!, grown.ids.l!]
    const deleted = step(grown.doom, "delete", freeLineEnds(grown.doom, detach([t]), measure))
    const undone = step(deleted.after, "undo", invert(deleted.before, deleted.after, deleted.edit))
    expect(lineOf(undone.after, l).start).toEqual(attached(grown.ids).geometry.start)
    const nudged = step(undone.after, "nudge", [moved(t, 300, 360)]).after
    expect(startOf(nudged, slide, l)).not.toEqual(startOf(deleted.after, slide, l))
    const redo = invert(undone.before, nudged, undone.edit)
    const redone = step(nudged, "redo", freeLineEnds(nudged, redo, measure)).after
    expect(startOf(redone, slide, l)).toEqual(startOf(deleted.after, slide, l))
  })
})

describe("a batch that takes a shape off the deck and draws a line onto it", () => {
  const drawn = (id: string, onto: string): readonly Write[] => [
    { node: id as Write["node"], prop: "type", value: "shape" },
    { node: id as Write["node"], prop: "geometry", value: { ...attached({ t: onto as Write["node"] }).geometry } },
  ]

  it("frees the end where the shape last painted when the line is new", () => {
    const grown = deck()
    const [t, slide] = [grown.ids.t!, grown.slides[0]!]
    const writes: readonly Write[] = [
      ...detach([t]),
      ...drawn("z:1", t),
      { node: "z:1" as Write["node"], prop: "parent", value: { id: slide, at: "a9" } },
    ]
    expect(startOf(landed(grown.doom, writes), slide, "z:1" as Write["node"])).toEqual({ x: 400, y: 325 })
    const drawnFreed = step(grown.doom, "drawn", freeLineEnds(grown.doom, writes, measure)).after
    const line = "z:1" as Write["node"]
    expect("node" in lineOf(drawnFreed, line).start).toBe(false)
    expect(startOf(drawnFreed, slide, line)).toEqual({ x: 400, y: 325 })
  })

  it("frees the end where the shape last painted when the line moves to another frame in the same batch", () => {
    const grown = deck()
    const [t, l, slide] = [grown.ids.t!, grown.ids.l!, grown.slides[0]!]
    const free = step(grown.doom, "free", [
      { node: l, prop: "geometry", value: { ...lineOf(grown.doom, l), start: { x: 5, y: 5 } } },
    ])
    const writes: readonly Write[] = [
      ...detach([t]),
      { node: l, prop: "parent", value: { id: slide, at: "a9" } },
      { node: l, prop: "geometry", value: attached(grown.ids).geometry },
    ]
    expect(startOf(landed(free.after, writes), slide, l)).toEqual({ x: 400, y: 325 })
  })
})

describe("a move that puts an attached shape inside a frame already off the deck", () => {
  function shelved() {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            { type: "shape", name: "t", props: { box: spot(300, 300, 100, 50) } },
            {
              type: "frame",
              name: "g",
              props: { box: spot(0, 0, 200, 200) },
              children: [{ type: "frame", name: "h", props: { box: spot(10, 10, 50, 50) }, children: [] }],
            },
            { type: "shape", name: "l", props: attached },
          ],
        },
      ],
    })
    return { ...grown, doom: step(grown.doom, "shelve", detach([grown.ids.g!])).after }
  }

  it("frees the end where the shape painted before the move", () => {
    const grown = shelved()
    const [t, h, l, slide] = [grown.ids.t!, grown.ids.h!, grown.ids.l!, grown.slides[0]!]
    const into: Write = { node: t, prop: "parent", value: { id: h, at: "a0" } }
    expect(startOf(landed(grown.doom, [into]), slide, l)).toEqual(startOf(grown.doom, slide, l))
  })

  it("lands freed where the end painted", () => {
    const grown = shelved()
    const [t, h, l, slide] = [grown.ids.t!, grown.ids.h!, grown.ids.l!, grown.slides[0]!]
    const seen = startOf(grown.doom, slide, l)
    const into: Write = { node: t, prop: "parent", value: { id: h, at: "a0" } }
    const moved = step(grown.doom, "into", freeLineEnds(grown.doom, [into], measure)).after
    expect(freePoint(lineOf(moved, l).start)).toEqual(seen)
  })
})

describe("a geometry write alone that turns a shape into a line on a shape off the deck", () => {
  function plain() {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            { type: "shape", name: "t", props: { box: spot(300, 300, 100, 50) } },
            { type: "shape", name: "m", props: { box: spot(0, 0, 100, 50) } },
          ],
        },
      ],
    })
    return { ...grown, doom: step(grown.doom, "gone", detach([grown.ids.t!])).after }
  }

  it("frees the start at the shape's stored box", () => {
    const grown = plain()
    const [m, slide] = [grown.ids.m!, grown.slides[0]!]
    const drawn: Write = { node: m, prop: "geometry", value: attached(grown.ids).geometry }
    const freed = landed(grown.doom, [drawn])
    expect(freePoint(lineOf(freed, m).start)).toBeDefined()
    expect(startOf(freed, slide, m)).toEqual({ x: 400, y: 325 })
  })

  it("lands freed where the shape painted", () => {
    const grown = plain()
    const [m, slide] = [grown.ids.m!, grown.slides[0]!]
    const drawn: Write = { node: m, prop: "geometry", value: attached(grown.ids).geometry }
    const freed = step(grown.doom, "drawn", freeLineEnds(grown.doom, [drawn], measure)).after
    expect(startOf(freed, slide, m)).toEqual({ x: 400, y: 325 })
  })
})

describe("restoring a frame whose line names a shape deleted while the frame was off the deck", () => {
  function restoring() {
    const grown = deck()
    const [t, j] = [grown.ids.t!, grown.ids.j!]
    const dropped = step(grown.doom, "drop", freeLineEnds(grown.doom, detach([j]), measure))
    const gone = step(dropped.after, "gone", freeLineEnds(dropped.after, detach([t]), measure)).after
    return { grown, dropped, gone, restore: invert(dropped.before, gone, dropped.edit) }
  }

  it("lands and frees the end at the shape's stored box when the device never saw the line paint", () => {
    const { grown, gone, restore } = restoring()
    const [l, slide] = [grown.ids.l!, grown.slides[0]!]
    expect(freeLineEnds(gone, restore, measure)).toEqual(restore)
    const back = landed(gone, restore)
    expect(freePoint(lineOf(back, l).start)).toBeDefined()
    expect(startOf(back, slide, l)).toEqual(startOf(grown.doom, slide, l))
  })

  it("lands freed where the line last painted, before the frame left", () => {
    const { grown, dropped, gone, restore } = restoring()
    const [l, slide] = [grown.ids.l!, grown.slides[0]!]
    const back = step(gone, "back", freeLineEnds(gone, restore, measure, gone, dropped.before)).after
    expect(freePoint(lineOf(back, l).start)).toBeDefined()
    expect(startOf(back, slide, l)).toEqual(startOf(grown.doom, slide, l))
  })
})
