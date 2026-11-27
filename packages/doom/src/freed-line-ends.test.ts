import { describe, expect, it } from "vitest"
import { compiled } from "./testing/agent-fixtures.js"
import { doomFromTree } from "./doom-tree.js"
import { parentOf, propOf } from "./doom-walk.js"
import type { NodeId } from "./ids.js"
import { freeLineEnds, invert, orderKeyBetween, type Doom, type OrderKey, type Write } from "./index.js"
import type { Point } from "./resolved.js"
import { attached, deck, detach, freePoint, lineOf, startOf, step } from "./testing/line-end-fixtures.js"
import { block, measure, plainTheme, row, spot } from "./testing/doom-fixtures-art.js"

function grouped() {
  return doomFromTree({
    theme: plainTheme,
    slides: [
      {
        children: [
          {
            type: "frame",
            name: "grp",
            props: { box: spot(300, 300, 140, 80) },
            children: [block("child", 100, 50), { type: "shape", name: "in", props: grpAttached }],
          },
          {
            type: "shape",
            name: "kidLine",
            props: (ids) => ({
              box: spot(0, 0, 10, 10),
              geometry: {
                kind: "line" as const,
                start: { node: ids.child!, site: "r" as const },
                end: { x: 10, y: 10 },
                route: "straight" as const,
                arrows: ["none", "none"] as const,
              },
            }),
          },
          {
            type: "frame",
            name: "j",
            props: { box: spot(100, 100, 400, 200) },
            children: [{ type: "shape", name: "l", props: (ids) => grpAttached(ids) }],
          },
        ],
      },
    ],
  })
}

const grpAttached = (ids: Readonly<Record<string, NodeId>>) => ({
  box: spot(0, 0, 10, 10),
  geometry: {
    kind: "line" as const,
    start: { node: ids.grp!, site: "r" as const },
    end: { x: 10, y: 10 },
    route: "straight" as const,
    arrows: ["none", "none"] as const,
  },
})

function unwrapWrites(doom: Doom, frame: NodeId, to: NodeId, shift: Point): readonly Write[] {
  const kids = [...doom.nodes.values()].filter((node) => parentOf(node)?.id === frame)
  let at: OrderKey | null = null
  return [
    ...kids.flatMap((kid): Write[] => {
      const box = propOf(kid, "box")
      at = orderKeyBetween(at, null)
      return [
        { node: kid.id, prop: "parent", value: { id: to, at } },
        ...(box === undefined
          ? []
          : [{ node: kid.id, prop: "box" as const, value: { ...box, x: box.x + shift.x, y: box.y + shift.y } }]),
      ]
    }),
    { node: frame, prop: "parent", value: null },
  ]
}

describe("ungrouping the frame a line is attached to", () => {
  it("frees the end at the point it painted, keeps a line on a child attached, and undo restores both", () => {
    const grown = grouped()
    const slide = grown.slides[0]!
    const seen = startOf(grown.doom, slide, grown.ids.l!)
    expect(seen).toEqual({ x: 440, y: 340 })
    const raw = unwrapWrites(grown.doom, grown.ids.grp!, slide, {
      x: 300,
      y: 300,
    })
    const loose = freeLineEnds(grown.doom, raw, measure)
    const ungrouped = step(grown.doom, "ungroup", loose)
    expect(startOf(ungrouped.after, slide, grown.ids.l!)).toEqual(seen)
    expect(freePoint(lineOf(ungrouped.after, grown.ids.l!).start)).toEqual({
      x: 340,
      y: 240,
    })
    expect(lineOf(ungrouped.after, grown.ids.kidLine!).start).toEqual({
      node: grown.ids.child,
      site: "r",
    })
    const undone = step(ungrouped.after, "undo", invert(ungrouped.before, ungrouped.after, ungrouped.edit)).after
    expect(lineOf(undone, grown.ids.l!).start).toEqual({
      node: grown.ids.grp,
      site: "r",
    })
    expect(startOf(undone, slide, grown.ids.l!)).toEqual(seen)
  })

  it("frees the same point when the agent unwraps the frame", () => {
    const grown = grouped()
    const slide = grown.slides[0]!
    const seen = startOf(grown.doom, slide, grown.ids.l!)
    const writes = compiled(grown.doom, { op: "unwrap", node: grown.ids.grp! })
    const after = step(grown.doom, "agent", writes).after
    expect(startOf(after, slide, grown.ids.l!)).toEqual(seen)
    expect("node" in lineOf(after, grown.ids.l!).start).toBe(false)
    expect(lineOf(after, grown.ids.kidLine!).start).toEqual({
      node: grown.ids.child,
      site: "r",
    })
  })

  it("moves a point freed for a line that leaves the frame with it into the line's new parent", () => {
    const grown = grouped()
    const slide = grown.slides[0]!
    const seen = startOf(grown.doom, slide, grown.ids.in!)
    const after = step(grown.doom, "agent", compiled(grown.doom, { op: "unwrap", node: grown.ids.grp! })).after
    expect(startOf(after, slide, grown.ids.in!)).toEqual(seen)
    expect("node" in lineOf(after, grown.ids.in!).start).toBe(false)
  })
})

describe("deleting the slide a line points into", () => {
  function slides() {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "shape",
              name: "t",
              props: { box: spot(300, 300, 100, 50) },
            },
            {
              type: "frame",
              name: "j",
              props: { box: spot(100, 100, 400, 200) },
              children: [{ type: "shape", name: "l", props: attached }],
            },
          ],
        },
        { name: "two", children: [] },
      ],
    })
    const moved = step(grown.doom, "move", [
      {
        node: grown.ids.t!,
        prop: "parent",
        value: { id: grown.slides[1]!, at: orderKeyBetween(null, null) },
      },
    ]).after
    return { ...grown, doom: moved }
  }

  it("frees the end where it painted, on the person path and the agent path, and undo restores it", () => {
    const grown = slides()
    const first = grown.slides[0]!
    const seen = startOf(grown.doom, first, grown.ids.l!)
    expect(seen).toEqual({ x: 400, y: 325 })
    const raw = detach([grown.slides[1]!])
    const deleted = step(grown.doom, "person", freeLineEnds(grown.doom, raw, measure))
    expect(freePoint(lineOf(deleted.after, grown.ids.l!).start)).toEqual({
      x: 300,
      y: 225,
    })
    expect(startOf(deleted.after, first, grown.ids.l!)).toEqual(seen)
    const byAgent = step(grown.doom, "agent", compiled(grown.doom, { op: "slide", delete: grown.slides[1]! })).after
    expect(freePoint(lineOf(byAgent, grown.ids.l!).start)).toEqual({
      x: 300,
      y: 225,
    })
    const undone = step(deleted.after, "undo", invert(deleted.before, deleted.after, deleted.edit)).after
    expect(lineOf(undone, grown.ids.l!).start).toEqual({
      node: grown.ids.t,
      site: "r",
    })
  })

  it("leaves a line on the deleted slide alone", () => {
    const grown = slides()
    expect(freeLineEnds(grown.doom, detach([grown.slides[0]!]), measure)).toEqual(detach([grown.slides[0]!]))
  })
})

describe("a change that only adds", () => {
  it("frees nothing", () => {
    const grown = deck()
    const added = [
      { node: "n:1" as NodeId, prop: "type" as const, value: "shape" },
      {
        node: "n:1" as NodeId,
        prop: "parent" as const,
        value: { id: grown.slides[0]!, at: orderKeyBetween(null, null) },
      },
    ]
    expect(freeLineEnds(grown.doom, added, measure)).toEqual(added)
  })
})

describe("a line whose own frame moves or turns while its shape leaves", () => {
  it("keeps the freed end where it painted when deleting the shape moves the line's frame along a row", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "frame",
              name: "row",
              props: { box: spot(100, 100, 1, 1), layout: row({}, 10), sizing: { w: "hug", h: "hug" } },
              children: [
                block("t", 100, 50),
                {
                  type: "frame",
                  name: "j",
                  props: { box: spot(0, 0, 200, 100) },
                  children: [{ type: "shape", name: "l", props: attached }],
                },
              ],
            },
          ],
        },
      ],
    })
    const slide = grown.slides[0]!
    const seen = startOf(grown.doom, slide, grown.ids.l!)
    expect(seen).toEqual({ x: 200, y: 125 })
    const raw = detach([grown.ids.t!])
    const after = step(grown.doom, "person", freeLineEnds(grown.doom, raw, measure)).after
    expect(freePoint(lineOf(after, grown.ids.l!).start)).toEqual({ x: 100, y: 25 })
    expect(startOf(after, slide, grown.ids.l!)).toEqual(seen)
  })

  it("keeps the freed end where it painted when a turned frame around the line is ungrouped", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "frame",
              name: "grp",
              props: { box: { ...spot(300, 300, 140, 80), rotation: 90 } },
              children: [{ type: "shape", name: "in", props: grpAttached }],
            },
          ],
        },
      ],
    })
    const slide = grown.slides[0]!
    const seen = startOf(grown.doom, slide, grown.ids.in!)
    const raw: readonly Write[] = [
      { node: grown.ids.in!, prop: "parent", value: { id: slide, at: orderKeyBetween(null, null) } },
      { node: grown.ids.grp!, prop: "parent", value: null },
    ]
    const after = step(grown.doom, "ungroup", freeLineEnds(grown.doom, raw, measure)).after
    expect(startOf(after, slide, grown.ids.in!)).toEqual(seen)
  })
})
