import { describe, expect, it } from "vitest"
import { compileAgentEdit } from "./agent-edit.js"
import { compiled, minter, runName, started } from "./agent-fixtures.js"
import { doomFromTree } from "./doom-tree.js"
import type { NodeId } from "./ids.js"
import { freedLineEnds, invert, orderKeyBetween, type Doom, type Measure } from "./index.js"
import { agent, once } from "./sample-deck.js"
import { block, label, measure, padding, plainTheme, row, spot } from "./testing/doom-fixtures-art.js"
import { attached, deck, detach, freePoint, lineOf, startOf, step } from "./testing/line-end-fixtures.js"

function nested() {
  return doomFromTree({
    theme: plainTheme,
    slides: [
      {
        children: [
          {
            type: "frame",
            name: "nest",
            props: { box: spot(300, 300, 100, 50) },
            children: [
              { type: "shape", name: "t", props: { box: spot(0, 0, 100, 50) } },
              { type: "shape", name: "m", props: attached },
            ],
          },
          {
            type: "frame",
            name: "j",
            props: { box: spot(100, 100, 400, 200) },
            children: [{ type: "shape", name: "l", props: attached }],
          },
        ],
      },
    ],
  })
}

function drop(doom: Doom, once: string, ids: readonly NodeId[]) {
  const gone = detach(ids)
  return step(doom, once, [...gone, ...freedLineEnds(doom, gone, measure)])
}

describe("a line end whose shape is not on the laid-out slide", () => {
  it("keeps painting a hidden shape's site, not the line's frame corner", () => {
    const grown = deck()
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    expect(seen).not.toEqual({ x: 100, y: 100 })
    const hidden = step(grown.doom, "hide", [{ node: grown.ids.t!, prop: "hidden", value: true }]).after
    expect(startOf(hidden, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect(lineOf(hidden, grown.ids.l!).start).toEqual({
      node: grown.ids.t,
      site: "r",
    })
  })

  it("keeps painting a shape inside a hidden frame, not the line's frame corner", () => {
    const grown = nested()
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    const hidden = step(grown.doom, "hide", [{ node: grown.ids.nest!, prop: "hidden", value: true }]).after
    expect(startOf(hidden, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect(lineOf(hidden, grown.ids.l!).start).toEqual({
      node: grown.ids.t,
      site: "r",
    })
  })

  it("keeps painting a shape that moved to another slide, not the line's frame corner", () => {
    const grown = deck()
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    const moved = step(grown.doom, "move", [
      {
        node: grown.ids.t!,
        prop: "parent",
        value: { id: grown.slides[1]!, at: orderKeyBetween(null, null) },
      },
    ]).after
    expect(startOf(moved, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect(lineOf(moved, grown.ids.l!).start).toEqual({
      node: grown.ids.t,
      site: "r",
    })
  })
})

const wide: Measure = (text, theme, width) => {
  const measured = measure(text, theme, width)
  return { ...measured, w: measured.w * 1.6 }
}

function drifted() {
  return doomFromTree({
    theme: plainTheme,
    slides: [
      {
        children: [
          {
            type: "frame",
            name: "f",
            props: {
              box: spot(100, 50, 1, 1),
              layout: row({}, 10, padding(20)),
              sizing: { w: "hug", h: "hug" },
            },
            children: [
              label("words", "Hello world hello", { sizing: { w: "hug", h: "hug" } }, { resize: "widthAndHeight" }),
              block("t", 100, 50),
            ],
          },
          {
            type: "shape",
            name: "l",
            props: (ids) => ({
              box: spot(0, 0, 10, 10),
              geometry: {
                kind: "line" as const,
                start: { node: ids.t!, site: "l" as const },
                end: { x: 5, y: 5 },
                route: "straight" as const,
                arrows: ["none", "none"] as const,
              },
            }),
          },
        ],
      },
    ],
  })
}

describe("a connector whose place depends on text width", () => {
  it("frees the end where the real widths painted it, on the person path and the agent path", () => {
    const grown = drifted()
    const slide = grown.slides[0]!
    const line = grown.ids.l!
    const seen = startOf(grown.doom, slide, line, wide)
    expect(seen.x).not.toBe(startOf(grown.doom, slide, line).x)
    const gone = detach([grown.ids.t!])
    const person = step(grown.doom, "person", [...gone, ...freedLineEnds(grown.doom, gone, wide)]).after
    const agentWrites = compiled(grown.doom, { op: "delete", nodes: [grown.ids.t!] }, minter(), { measure: wide })
    const edited = compileAgentEdit(started(grown.doom), [{ op: "delete", nodes: [grown.ids.t!] }], {
      author: agent(runName),
      once: once(),
      mint: minter(),
      measure: wide,
    })
    if ("refused" in edited) throw new Error(JSON.stringify(edited))
    const byAgent = step(grown.doom, "agent", agentWrites).after
    const byEdit = step(grown.doom, "edit", edited.edit.writes).after
    expect(freePoint(lineOf(person, line).start)).toEqual(seen)
    expect(freePoint(lineOf(byAgent, line).start)).toEqual(seen)
    expect(freePoint(lineOf(byEdit, line).start)).toEqual(seen)
  })
})

describe("a hidden child of an auto-layout frame", () => {
  it("paints the connector at the child's flow position", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "frame",
              name: "f",
              props: {
                box: spot(100, 50, 10, 10),
                layout: row({}, 10, padding(20)),
                sizing: { w: "hug", h: "hug" },
              },
              children: [
                block("a", 80, 40),
                {
                  type: "shape",
                  name: "h",
                  props: { box: spot(0, 0, 100, 50) },
                },
              ],
            },
            {
              type: "shape",
              name: "l",
              props: (ids) => ({
                box: spot(0, 0, 10, 10),
                geometry: {
                  kind: "line" as const,
                  start: { node: ids.h!, site: "l" as const },
                  end: { x: 5, y: 5 },
                  route: "straight" as const,
                  arrows: ["none", "none"] as const,
                },
              }),
            },
          ],
        },
      ],
    })
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    const hidden = step(grown.doom, "hide", [{ node: grown.ids.h!, prop: "hidden", value: true }]).after
    expect(startOf(hidden, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect(lineOf(hidden, grown.ids.l!).start).toEqual({
      node: grown.ids.h,
      site: "l",
    })
  })

  const leftOf = (target: string) => (ids: Readonly<Record<string, NodeId>>) => ({
    box: spot(0, 0, 10, 10),
    geometry: {
      kind: "line" as const,
      start: { node: ids[target]!, site: "l" as const },
      end: { x: 5, y: 5 },
      route: "straight" as const,
      arrows: ["none", "none"] as const,
    },
  })

  it("does not show an already hidden sibling when its frame is hidden", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "frame",
              name: "f",
              props: {
                box: spot(100, 50, 10, 10),
                layout: row({}, 10, padding(20)),
                sizing: { w: "hug", h: "hug" },
              },
              children: [
                block("a", 80, 40),
                {
                  type: "shape",
                  name: "gone",
                  props: { box: spot(0, 0, 100, 40), hidden: true },
                },
                block("t", 100, 50),
              ],
            },
            { type: "shape", name: "l", props: leftOf("t") },
          ],
        },
      ],
    })
    const slide = grown.slides[0]!
    const seen = startOf(grown.doom, slide, grown.ids.l!)
    const hidden = step(grown.doom, "hide", [{ node: grown.ids.f!, prop: "hidden", value: true }]).after
    expect(startOf(hidden, slide, grown.ids.l!)).toEqual(seen)
  })

  it("does not grow a fill frame by its already hidden child when a sibling is hidden", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "frame",
              name: "outer",
              props: {
                box: spot(100, 50, 500, 100),
                layout: {
                  mode: "row",
                  align: "center-left",
                  gap: 10,
                  padding: padding(0),
                },
                sizing: { w: "fixed", h: "hug" },
              },
              children: [
                {
                  type: "frame",
                  name: "inner",
                  props: {
                    box: spot(0, 0, 100, 40),
                    layout: {
                      mode: "column",
                      align: "top-left",
                      gap: 10,
                      padding: padding(0),
                    },
                    sizing: { w: "fill", h: "hug" },
                  },
                  children: [
                    block("v", 100, 40),
                    {
                      type: "shape",
                      name: "gone",
                      props: { box: spot(0, 0, 100, 200), hidden: true },
                    },
                  ],
                },
                block("t", 100, 50),
              ],
            },
            { type: "shape", name: "l", props: leftOf("t") },
          ],
        },
      ],
    })
    const slide = grown.slides[0]!
    const seen = startOf(grown.doom, slide, grown.ids.l!)
    const hidden = step(grown.doom, "hide", [{ node: grown.ids.t!, prop: "hidden", value: true }]).after
    expect(startOf(hidden, slide, grown.ids.l!)).toEqual(seen)
  })
})

describe("deleting the shape a line is attached to", () => {
  it("frees the end at the point it last painted, and undo puts the attachment back", () => {
    const grown = deck()
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    const deleted = drop(grown.doom, "delete", [grown.ids.t!])
    expect(startOf(deleted.after, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect(freePoint(lineOf(deleted.after, grown.ids.l!).start)).not.toEqual({
      x: 0,
      y: 0,
    })
    const undone = step(deleted.after, "undo", invert(deleted.before, deleted.after, deleted.edit)).after
    expect(lineOf(undone, grown.ids.l!).start).toEqual({
      node: grown.ids.t,
      site: "r",
    })
    expect(startOf(undone, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
  })

  it("frees the same point when the agent deletes the shape", () => {
    const grown = deck()
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    const writes = compiled(grown.doom, {
      op: "delete",
      nodes: [grown.ids.t!],
    })
    expect(writes.map((write) => write.prop)).toEqual(["parent", "geometry"])
    const deleted = step(grown.doom, "agent", writes).after
    const personDelete = drop(grown.doom, "person", [grown.ids.t!]).after
    expect(startOf(deleted, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect(freePoint(lineOf(deleted, grown.ids.l!).start)).toEqual(freePoint(lineOf(personDelete, grown.ids.l!).start))
  })

  it("frees a line outside a deleted frame and leaves a line inside it attached", () => {
    const grown = nested()
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    const writes = compiled(grown.doom, {
      op: "delete",
      nodes: [grown.ids.nest!],
    })
    expect(writes.map((write) => write.node)).toEqual([grown.ids.nest, grown.ids.l])
    const deleted = step(grown.doom, "frame", writes).after
    expect(startOf(deleted, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect("node" in lineOf(deleted, grown.ids.l!).start).toBe(false)
    expect(lineOf(deleted, grown.ids.m!).start).toEqual({
      node: grown.ids.t,
      site: "r",
    })
  })

  it("does not invent a corner point for a shape that is already gone", () => {
    const grown = deck()
    const gone = step(grown.doom, "raw", [{ node: grown.ids.t!, prop: "parent", value: null }]).after
    expect(freedLineEnds(gone, detach([grown.ids.t!]), measure)).toEqual([])
  })
})
