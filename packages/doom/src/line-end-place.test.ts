import { describe, expect, it } from "vitest"
import { compileAgentEdit } from "./agent-edit.js"
import { compiled, minter, runName, started } from "./agent-fixtures.js"
import { doomFromTree } from "./doom-tree.js"
import { propOf } from "./doom-walk.js"
import type { End } from "./geometry.js"
import type { NodeId } from "./ids.js"
import {
  applyEdit,
  freedLineEnds,
  invert,
  isRefusal,
  orderKeyBetween,
  resolveSlide,
  rev,
  type Doom,
  type Landed,
  type Measure,
  type Write,
} from "./index.js"
import type { Point, Resolved } from "./resolved.js"
import { agent, once } from "./sample-deck.js"
import { block, label, measure, padding, plainTheme, row, spot } from "./testing/doom-fixtures-art.js"

const person = { kind: "person" as const, id: "p" }

function placed(
  nodes: readonly Resolved[],
  id: string,
  x = 0,
  y = 0,
): { readonly x: number; readonly y: number; readonly node: Resolved } | null {
  for (const node of nodes) {
    const at = { node, x: x + node.box.x, y: y + node.box.y }
    if (node.id === id) return at
    const kid = placed(node.children, id, at.x, at.y)
    if (kid !== null) return kid
  }
  return null
}

function startOf(doom: Doom, slide: NodeId, line: NodeId, by: Measure = measure): Point {
  const found = placed(resolveSlide(doom, slide, by), line)
  if (found?.node.geometry?.kind !== "line") throw new Error("no line")
  return { x: found.x + found.node.geometry.from.x, y: found.y + found.node.geometry.from.y }
}

function lineOf(doom: Doom, id: NodeId) {
  const geometry = propOf(doom.nodes.get(id), "geometry")
  if (geometry?.kind !== "line") throw new Error("no line")
  return geometry
}

const attached = (ids: Readonly<Record<string, NodeId>>) => ({
  geometry: {
    kind: "line" as const,
    start: { node: ids.t!, site: "r" as const },
    end: { x: 10, y: 10 },
    route: "straight" as const,
    arrows: ["none", "none"] as const,
  },
})

function deck() {
  return doomFromTree({
    theme: plainTheme,
    slides: [
      {
        children: [
          { type: "shape", name: "t", props: { box: spot(300, 300, 100, 50) } },
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
}

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

function step(doom: Doom, once: string, writes: readonly Write[]) {
  const edit: Landed = { once, author: person, writes, rev: rev(doom.rev + 1) }
  const after = applyEdit(doom, edit)
  if (isRefusal(after)) throw new Error(JSON.stringify(after))
  return { before: doom, after, edit }
}

function drop(doom: Doom, once: string, ids: readonly NodeId[]) {
  return step(doom, once, [
    ...freedLineEnds(doom, ids, measure),
    ...ids.map((id) => ({ node: id, prop: "parent" as const, value: null })),
  ])
}

function freePoint(end: End): Point {
  if ("node" in end) throw new Error("still attached")
  return { x: end.x, y: end.y }
}

describe("a line end whose shape is not on the laid-out slide", () => {
  it("keeps painting a hidden shape's site, not the line's frame corner", () => {
    const grown = deck()
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    expect(seen).not.toEqual({ x: 100, y: 100 })
    const hidden = step(grown.doom, "hide", [{ node: grown.ids.t!, prop: "hidden", value: true }]).after
    expect(startOf(hidden, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect(lineOf(hidden, grown.ids.l!).start).toEqual({ node: grown.ids.t, site: "r" })
  })

  it("keeps painting a shape inside a hidden frame, not the line's frame corner", () => {
    const grown = nested()
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    const hidden = step(grown.doom, "hide", [{ node: grown.ids.nest!, prop: "hidden", value: true }]).after
    expect(startOf(hidden, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect(lineOf(hidden, grown.ids.l!).start).toEqual({ node: grown.ids.t, site: "r" })
  })

  it("keeps painting a shape that moved to another slide, not the line's frame corner", () => {
    const grown = deck()
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    const moved = step(grown.doom, "move", [
      { node: grown.ids.t!, prop: "parent", value: { id: grown.slides[1]!, at: orderKeyBetween(null, null) } },
    ]).after
    expect(startOf(moved, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect(lineOf(moved, grown.ids.l!).start).toEqual({ node: grown.ids.t, site: "r" })
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
    const gone = [{ node: grown.ids.t!, prop: "parent" as const, value: null }]
    const person = step(grown.doom, "person", [...freedLineEnds(grown.doom, [grown.ids.t!], wide), ...gone]).after
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
              children: [block("a", 80, 40), { type: "shape", name: "h", props: { box: spot(0, 0, 100, 50) } }],
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
    expect(lineOf(hidden, grown.ids.l!).start).toEqual({ node: grown.ids.h, site: "l" })
  })
})

describe("deleting the shape a line is attached to", () => {
  it("frees the end at the point it last painted, and undo puts the attachment back", () => {
    const grown = deck()
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    const deleted = drop(grown.doom, "delete", [grown.ids.t!])
    expect(startOf(deleted.after, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect(freePoint(lineOf(deleted.after, grown.ids.l!).start)).not.toEqual({ x: 0, y: 0 })
    const undone = step(deleted.after, "undo", invert(deleted.before, deleted.after, deleted.edit)).after
    expect(lineOf(undone, grown.ids.l!).start).toEqual({ node: grown.ids.t, site: "r" })
    expect(startOf(undone, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
  })

  it("frees the same point when the agent deletes the shape", () => {
    const grown = deck()
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    const writes = compiled(grown.doom, { op: "delete", nodes: [grown.ids.t!] })
    expect(writes.map((write) => write.prop)).toEqual(["geometry", "parent"])
    const deleted = step(grown.doom, "agent", writes).after
    const personDelete = drop(grown.doom, "person", [grown.ids.t!]).after
    expect(startOf(deleted, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect(freePoint(lineOf(deleted, grown.ids.l!).start)).toEqual(freePoint(lineOf(personDelete, grown.ids.l!).start))
  })

  it("frees a line outside a deleted frame and leaves a line inside it attached", () => {
    const grown = nested()
    const seen = startOf(grown.doom, grown.slides[0]!, grown.ids.l!)
    const writes = compiled(grown.doom, { op: "delete", nodes: [grown.ids.nest!] })
    expect(writes.map((write) => write.node)).toEqual([grown.ids.l, grown.ids.nest])
    const deleted = step(grown.doom, "frame", writes).after
    expect(startOf(deleted, grown.slides[0]!, grown.ids.l!)).toEqual(seen)
    expect("node" in lineOf(deleted, grown.ids.l!).start).toBe(false)
    expect(lineOf(deleted, grown.ids.m!).start).toEqual({ node: grown.ids.t, site: "r" })
  })

  it("does not invent a corner point for a shape that is already gone", () => {
    const grown = deck()
    const gone = step(grown.doom, "raw", [{ node: grown.ids.t!, prop: "parent", value: null }]).after
    expect(freedLineEnds(gone, [grown.ids.t!], measure)).toEqual([])
  })
})
