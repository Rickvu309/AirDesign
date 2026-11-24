import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { landed } from "./testing/doom-fixtures"
import { deleteWrites } from "./delete-writes"

const box = (x: number, y: number, w: number, h: number) => ({
  x,
  y,
  w,
  h,
  rotation: 0,
  flipH: false,
  flipV: false,
})

describe("deleteWrites", () => {
  it("frees a connector at the point it last painted, then clears the shape", () => {
    const grown = doom.doomFromTree({
      theme: doom.defaultTheme,
      slides: [
        {
          children: [
            { type: "shape", name: "t", props: { box: box(300, 300, 100, 50) } },
            {
              type: "frame",
              name: "j",
              props: { box: box(100, 100, 400, 200) },
              children: [
                {
                  type: "shape",
                  name: "l",
                  props: (ids) => ({
                    geometry: {
                      kind: "line" as const,
                      start: { node: ids.t!, site: "r" as const },
                      end: { x: 10, y: 10 },
                      route: "straight" as const,
                      arrows: ["none", "none"] as const,
                    },
                  }),
                },
              ],
            },
          ],
        },
      ],
    })
    const slide = grown.slides[0]!
    const seen = paintedStart(grown.doom, slide, grown.ids.l!)
    const writes = deleteWrites(grown.doom, [grown.ids.t!], estimate)
    expect(writes.map((write) => write.prop)).toEqual(["geometry", "parent"])
    const next = landed(grown.doom, writes)
    expect(doom.parentOf(next.nodes.get(grown.ids.t!))).toBeNull()
    expect(paintedStart(next, slide, grown.ids.l!)).toEqual(seen)
    const geometry = doom.propOf(next.nodes.get(grown.ids.l!), "geometry")
    expect(geometry?.kind === "line" && "x" in geometry.start).toBe(true)
  })

  it("frees the end where wider text painted it, not where the estimate put the shape", () => {
    const grown = drifted()
    const slide = grown.slides[0]!
    const seen = paintedStart(grown.doom, slide, grown.ids.l!, wide)
    const estimated = paintedStart(grown.doom, slide, grown.ids.l!)
    expect(seen.x).not.toBe(estimated.x)
    const writes = deleteWrites(grown.doom, [grown.ids.t!], wide)
    const geometry = writes.find((write) => write.prop === "geometry")?.value
    if (geometry == null || typeof geometry !== "object" || !("start" in geometry)) throw new Error("no end")
    const start = geometry.start
    if (start == null || typeof start !== "object" || !("x" in start) || !("y" in start))
      throw new Error("still attached")
    expect({ x: start.x, y: start.y }).toEqual(seen)
  })
})

const estimate = doom.measureWith({})
const wide: doom.Measure = (text, theme, width) => {
  const measured = estimate(text, theme, width)
  return { ...measured, w: measured.w * 1.6 }
}

function drifted() {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        children: [
          {
            type: "frame",
            name: "f",
            props: {
              box: box(100, 50, 1, 1),
              layout: { mode: "row", gap: 10, padding: { t: 20, r: 20, b: 20, l: 20 }, align: "top-left" },
              sizing: { w: "hug", h: "hug" },
            },
            children: [
              {
                type: "shape",
                name: "words",
                props: {
                  box: box(0, 0, 200, 100),
                  sizing: { w: "hug", h: "hug" },
                  text: { ...doom.textFromMarkdown("Hello world hello", "body"), resize: "widthAndHeight" },
                },
              },
              { type: "shape", name: "t", props: { box: box(0, 0, 100, 50) } },
            ],
          },
          {
            type: "shape",
            name: "l",
            props: (ids) => ({
              box: box(0, 0, 10, 10),
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

function paintedStart(view: doom.Doom, slide: doom.NodeId, line: doom.NodeId, measure: doom.Measure = estimate) {
  const found = place(doom.resolveSlide(view, slide, measure), line, 0, 0)
  if (found?.node.geometry?.kind !== "line") throw new Error("no line")
  return { x: found.x + found.node.geometry.from.x, y: found.y + found.node.geometry.from.y }
}

function place(
  nodes: readonly doom.Resolved[],
  id: string,
  x: number,
  y: number,
): { readonly x: number; readonly y: number; readonly node: doom.Resolved } | null {
  for (const node of nodes) {
    const at = { node, x: x + node.box.x, y: y + node.box.y }
    if (node.id === id) return at
    const kid = place(node.children, id, at.x, at.y)
    if (kid !== null) return kid
  }
  return null
}
