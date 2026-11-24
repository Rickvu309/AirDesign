import { describe, expect, it } from "vitest"
import { type Layout, type Track, solveLayout } from "./index.js"
import {
  advance,
  block,
  column,
  label,
  lineHeight,
  measure,
  padding,
  plainTheme,
  row,
  spot,
} from "./testing/doom-fixtures-art.js"
import { type TreeNode, doomFromTree } from "./doom-tree.js"

function solved(slide: readonly TreeNode[], slideProps = {}) {
  const grown = doomFromTree({ theme: plainTheme, slides: [{ children: slide, props: slideProps }] })
  const boxes = solveLayout(grown.doom, grown.slides[0]!, measure)
  const at = (name: string) => {
    const box = boxes.get(grown.ids[name]!)
    if (box === undefined) throw new Error(`no box for ${name}`)
    return box
  }
  return { at, boxes, ...grown }
}

const rowOf = (children: readonly TreeNode[], layout: object = {}, box = spot(0, 0, 600, 200), props: object = {}) =>
  ({ type: "frame", name: "row", props: { box, layout: row(layout), ...props }, children }) satisfies TreeNode

describe("solveLayout in a row", () => {
  it("puts children one after another with the gap and the padding, boxes relative to the row", () => {
    const { at } = solved([
      {
        type: "frame",
        name: "row",
        props: { box: spot(40, 30, 600, 200), layout: row({}, 8, padding(10, 20)) },
        children: [block("a", 100, 50), block("b", 100, 50), block("c", 100, 50)],
      },
    ])
    expect([at("a").x, at("b").x, at("c").x]).toEqual([20, 128, 236])
    expect([at("a").y, at("b").y, at("c").y]).toEqual([10, 10, 10])
    expect(at("row")).toMatchObject({ x: 40, y: 30, w: 600, h: 200 })
  })

  it("hugs: a row that hugs both ways is as big as its children, gaps and padding", () => {
    const { at } = solved([
      rowOf([block("a", 100, 50), block("b", 100, 70)], {}, spot(0, 0, 10, 10), { sizing: { w: "hug", h: "hug" } }),
    ])
    expect(at("row")).toMatchObject({ w: 200, h: 70 })
    const padded = solved([
      {
        type: "frame",
        name: "row",
        props: { box: spot(0, 0, 10, 10), layout: row({}, 10, padding(10)), sizing: { w: "hug", h: "hug" } },
        children: [block("a", 100, 50), block("b", 100, 70)],
      },
    ])
    expect(padded.at("row")).toMatchObject({ w: 230, h: 90 })
  })

  it("shares what is left between fill children and gives them the whole cross size when they fill it", () => {
    const { at } = solved([
      rowOf(
        [
          block("fixed", 100, 40),
          block("one", 0, 10, { sizing: { w: "fill", h: "fill" } }),
          block("two", 0, 10, { sizing: { w: "fill", h: "fixed" } }),
        ],
        { gap: 10 },
      ),
    ])
    expect(at("fixed").w).toBe(100)
    expect(at("one")).toMatchObject({ x: 110, w: 240, h: 200 })
    expect(at("two")).toMatchObject({ x: 360, w: 240, h: 10 })
  })

  it("aligns the block on both axes with the nine-way alignment", () => {
    expect(solved([rowOf([block("a", 100, 50)], { align: "center-center" })]).at("a")).toMatchObject({ x: 250, y: 75 })
    expect(solved([rowOf([block("a", 100, 50)], { align: "bottom-right" })]).at("a")).toMatchObject({ x: 500, y: 150 })
  })

  it("starts a new line when wrap is on and the next child does not fit", () => {
    const { at } = solved([
      rowOf(
        [block("a", 100, 40), block("b", 100, 40), block("c", 100, 40)],
        { gap: 10, wrap: true },
        spot(0, 0, 250, 300),
      ),
    ])
    expect([at("a").y, at("b").y, at("c").y]).toEqual([0, 0, 50])
    expect([at("a").x, at("b").x, at("c").x]).toEqual([0, 110, 0])
  })

  it("leaves a hidden child out of the flow", () => {
    const { at, boxes, ids } = solved([
      rowOf([block("a", 100, 40), block("gone", 100, 40, { hidden: true }), block("c", 100, 40)], { gap: 10 }),
    ])
    expect(at("c").x).toBe(110)
    expect(boxes.has(ids.gone!)).toBe(false)
  })

  it("leaves an absolute child where it was put, outside the flow and the hug size", () => {
    const { at } = solved([
      rowOf(
        [
          block("a", 100, 40),
          { ...block("pinned", 30, 30, { absolute: true }), props: { box: spot(500, 100, 30, 30), absolute: true } },
          block("b", 100, 40),
        ],
        { gap: 10 },
        spot(0, 0, 10, 10),
        { sizing: { w: "hug", h: "hug" } },
      ),
    ])
    expect(at("b").x).toBe(110)
    expect(at("pinned")).toMatchObject({ x: 500, y: 100 })
    expect(at("row")).toMatchObject({ w: 210, h: 40 })
  })

  it("keeps a child's rotation and flips while it sets its place", () => {
    const turned = { ...spot(0, 0, 100, 50), rotation: 30, flipH: true }
    expect(solved([rowOf([block("a", 100, 50, { box: turned })], {}, spot(0, 0, 600, 200), {})]).at("a")).toMatchObject(
      {
        rotation: 30,
        flipH: true,
        x: 0,
      },
    )
  })
})

describe("solveLayout in a column", () => {
  it("stacks children from the top with the gap, and fill children share the height", () => {
    const { at } = solved([
      {
        type: "frame",
        name: "col",
        props: { box: spot(0, 0, 300, 400), layout: column({}, 20, padding(0)) },
        children: [block("a", 100, 100), block("b", 100, 10, { sizing: { w: "fixed", h: "fill" } })],
      },
    ])
    expect(at("a").y).toBe(0)
    expect(at("b")).toMatchObject({ y: 120, h: 280 })
  })

  it("centres children on the cross axis", () => {
    const { at } = solved([
      {
        type: "frame",
        name: "col",
        props: { box: spot(0, 0, 300, 400), layout: column({}, 0, padding(0), "top-center") },
        children: [block("a", 100, 100)],
      },
    ])
    expect(at("a").x).toBe(100)
  })
})

describe("solveLayout of text", () => {
  it("makes a box that grows both ways as big as its words", () => {
    const { at } = solved([label("t", "Revenue", {}, { resize: "widthAndHeight" })])
    expect(at("t")).toMatchObject({ w: 7 * advance, h: lineHeight })
  })

  it("makes a box that grows in height as tall as its words wrap at its width", () => {
    const { at } = solved([label("t", "aaaa bbbb cccc", { box: spot(0, 0, 100, 5) }, { resize: "height" })])
    expect(at("t")).toMatchObject({ w: 100, h: 2 * lineHeight })
  })

  it("keeps a fixed box at its stored size however long its words are", () => {
    const { at } = solved([label("t", "aaaa bbbb cccc dddd eeee", { box: spot(0, 0, 100, 40) }, { resize: "fixed" })])
    expect(at("t")).toMatchObject({ w: 100, h: 40 })
  })

  it("wraps text that fills a row's width at the width the row gives it, and the row hugs that height", () => {
    const { at } = solved([
      rowOf(
        [
          block("badge", 100, 20),
          label(
            "t",
            "aaaa bbbb cccc dddd",
            { sizing: { w: "fill", h: "hug" }, box: spot(0, 0, 10, 10) },
            { resize: "height" },
          ),
        ],
        { gap: 20 },
        spot(0, 0, 210, 10),
        { sizing: { w: "fixed", h: "hug" } },
      ),
    ])
    expect(at("t").w).toBe(90)
    expect(at("t").h).toBe(4 * lineHeight)
    expect(at("row").h).toBe(4 * lineHeight)
  })
})

describe("solveLayout of deeply nested frames", () => {
  it("measures each text a handful of times however deep the hug frames nest", () => {
    let calls = 0
    const counting: typeof measure = (text, theme, width) => {
      calls += 1
      return measure(text, theme, width)
    }
    const nested = (depth: number): TreeNode => ({
      type: "frame",
      name: `level ${String(depth)}`,
      props: { box: spot(0, 0, 1, 1), sizing: { w: "hug", h: "hug" }, layout: row({}, 4, padding(4)) },
      children: depth === 0 ? [label("t", "hello there", {}, { resize: "widthAndHeight" })] : [nested(depth - 1)],
    })
    const grown = doomFromTree({ theme: plainTheme, slides: [{ children: [nested(14)] }] })
    const boxes = solveLayout(grown.doom, grown.slides[0]!, counting)
    expect(boxes.get(grown.ids.t!)).toMatchObject({ w: 11 * advance, h: lineHeight })
    expect(calls).toBeLessThan(40)
  })
})

describe("solveLayout of wrapping text in a column", () => {
  it("wraps text that fills a column's width and stacks the next child below its lines", () => {
    const { at } = solved([
      {
        type: "frame",
        name: "col",
        props: { box: spot(0, 0, 90, 10), sizing: { w: "fixed", h: "hug" }, layout: column({}, 10) },
        children: [
          label(
            "t",
            "aaaa bbbb cccc dddd",
            { sizing: { w: "fill", h: "hug" }, box: spot(0, 0, 10, 10) },
            { resize: "height" },
          ),
          block("after", 40, 20),
        ],
      },
    ])
    expect(at("t")).toMatchObject({ w: 90, h: 4 * lineHeight })
    expect(at("after").y).toBe(4 * lineHeight + 10)
    expect(at("col").h).toBe(4 * lineHeight + 10 + 20)
  })
})

describe("solveLayout in a grid", () => {
  const grid = (columns: Track[], rows: Track[], gap = 10): Layout => ({
    mode: "grid",
    columns,
    rows,
    gap,
    padding: padding(0),
  })

  it("sizes px and fr tracks, with the gap between them", () => {
    const { at } = solved([
      {
        type: "frame",
        name: "grid",
        props: {
          box: spot(0, 0, 400, 200),
          layout: grid([{ px: 100 }, { fr: 1 }, { fr: 2 }], [{ px: 50 }, { fr: 1 }]),
        },
        children: [
          block("a", 1, 1, { cell: { row: 0, col: 0 }, sizing: { w: "fill", h: "fill" } }),
          block("b", 1, 1, { cell: { row: 0, col: 1 }, sizing: { w: "fill", h: "fill" } }),
          block("c", 1, 1, { cell: { row: 1, col: 2 }, sizing: { w: "fill", h: "fill" } }),
        ],
      },
    ])
    expect(at("a")).toMatchObject({ x: 0, y: 0, w: 100, h: 50 })
    expect(at("b").x).toBe(110)
    expect(at("b").w).toBeCloseTo(280 / 3)
    expect(at("c").y).toBe(60)
    expect(at("c").h).toBe(140)
    expect(at("c").w).toBeCloseTo((280 * 2) / 3)
  })

  it("sizes a hug track to its tallest cell and leaves the rest to the fr track", () => {
    const { at } = solved([
      {
        type: "frame",
        name: "grid",
        props: { box: spot(0, 0, 300, 300), layout: grid([{ fr: 1 }], ["hug", { fr: 1 }], 0) },
        children: [
          block("a", 50, 80, { cell: { row: 0, col: 0 } }),
          block("b", 50, 60, { cell: { row: 1, col: 0 }, sizing: { w: "fill", h: "fill" } }),
        ],
      },
    ])
    expect(at("b")).toMatchObject({ y: 80, h: 220, w: 300 })
  })

  it("lets a cell span tracks", () => {
    const { at } = solved([
      {
        type: "frame",
        name: "grid",
        props: { box: spot(0, 0, 310, 100), layout: grid([{ px: 100 }, { px: 100 }, { px: 100 }], [{ px: 100 }]) },
        children: [block("wide", 1, 1, { cell: { row: 0, col: 0, colSpan: 2 }, sizing: { w: "fill", h: "fill" } })],
      },
    ])
    expect(at("wide").w).toBe(210)
  })

  it("places children with no cell in the next free cell, row by row", () => {
    const { at } = solved([
      {
        type: "frame",
        name: "grid",
        props: { box: spot(0, 0, 210, 210), layout: grid([{ px: 100 }, { px: 100 }], [{ px: 100 }, { px: 100 }]) },
        children: [block("a", 10, 10), block("b", 10, 10), block("c", 10, 10)],
      },
    ])
    expect([at("a"), at("b"), at("c")].map((box) => [box.x, box.y])).toEqual([
      [0, 0],
      [110, 0],
      [0, 110],
    ])
  })

  it("hugs the tracks when the grid hugs", () => {
    const { at } = solved([
      {
        type: "frame",
        name: "grid",
        props: {
          box: spot(0, 0, 1, 1),
          sizing: { w: "hug", h: "hug" },
          layout: grid([{ px: 100 }, "hug"], [{ px: 40 }], 10),
        },
        children: [block("a", 10, 10), block("b", 70, 10, { cell: { row: 0, col: 1 } })],
      },
    ])
    expect(at("grid")).toMatchObject({ w: 180, h: 40 })
  })
})

describe("solveLayout in nested frames and slides", () => {
  it("measures a hug frame inside a row from its own children, at any depth", () => {
    const { at } = solved([
      rowOf(
        [
          {
            type: "frame",
            name: "card",
            props: { box: spot(0, 0, 1, 1), sizing: { w: "hug", h: "hug" }, layout: column({}, 10, padding(20)) },
            children: [block("a", 120, 30), block("b", 80, 30)],
          },
          block("next", 50, 50),
        ],
        { gap: 10 },
      ),
    ])
    expect(at("card")).toMatchObject({ w: 160, h: 110 })
    expect(at("a")).toMatchObject({ x: 20, y: 20 })
    expect(at("b")).toMatchObject({ x: 20, y: 60 })
    expect(at("next").x).toBe(170)
  })

  it("lays a slide's own children out when the slide has a layout, in the deck's slide size", () => {
    const { at } = solved([block("a", 100, 100), block("b", 100, 100, { sizing: { w: "fill", h: "fixed" } })], {
      layout: column({}, 20, padding(40)),
    })
    expect(at("a")).toMatchObject({ x: 40, y: 40 })
    expect(at("b")).toMatchObject({ x: 40, y: 160, w: 1840 })
  })

  it("keeps a free slide's children where they were put", () => {
    const { at } = solved([block("a", 100, 100, { box: spot(300, 200, 100, 100) })])
    expect(at("a")).toMatchObject({ x: 300, y: 200 })
  })

  it("answers the slide's own box in the deck's size", () => {
    const { boxes, slides } = solved([])
    expect(boxes.get(slides[0]!)).toMatchObject({ x: 0, y: 0, w: 1920, h: 1080 })
  })

  it("gives the same boxes every time it runs and never changes the doom", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [{ children: [rowOf([label("t", "hello there", {}, { resize: "widthAndHeight" })])] }],
    })
    const first = solveLayout(grown.doom, grown.slides[0]!, measure)
    expect([...solveLayout(grown.doom, grown.slides[0]!, measure)]).toEqual([...first])
    expect(grown.doom.nodes.get(grown.ids.t!)).not.toHaveProperty("w")
  })
})

describe("solveLayout of a line", () => {
  const line = (
    start: unknown | ((ids: Record<string, string>) => unknown),
    end: unknown | ((ids: Record<string, string>) => unknown),
  ): TreeNode => ({
    type: "shape",
    name: "line",
    props: (ids) =>
      ({
        geometry: {
          kind: "line",
          start: typeof start === "function" ? start(ids) : start,
          end: typeof end === "function" ? end(ids) : end,
          route: "straight",
          arrows: ["none", "arrow"],
        },
      }) as never,
  })

  it("derives a line's box from its two points", () => {
    const { at } = solved([line({ x: 400, y: 300 }, { x: 100, y: 500 })])
    expect(at("line")).toMatchObject({ x: 100, y: 300, w: 300, h: 200 })
  })

  it("follows the node an end is attached to, whatever frame that node sits in", () => {
    const { at } = solved([
      { ...block("from", 100, 60, {}), props: { box: spot(100, 100, 100, 60) } },
      {
        type: "frame",
        name: "holder",
        props: { box: spot(500, 300, 400, 200) },
        children: [{ ...block("to", 100, 60), props: { box: spot(50, 20, 100, 60) } }],
      },
      line(
        (ids: Record<string, string>) => ({ node: ids.from, site: "r" }),
        (ids: Record<string, string>) => ({ node: ids.to, site: "l" }),
      ),
    ])
    const from = at("from")
    const to = at("to")
    const start = { x: from.x + from.w, y: from.y + from.h / 2 }
    const end = { x: 500 + to.x, y: 300 + to.y + to.h / 2 }
    expect(at("line")).toMatchObject({
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      w: Math.abs(end.x - start.x),
      h: Math.abs(end.y - start.y),
    })
  })

  it("attaches an end to the site on a shape's outline, not to its box", () => {
    const { at } = solved([
      {
        type: "shape",
        name: "peak",
        props: { box: spot(100, 100, 200, 100), geometry: { kind: "preset", name: "triangle" } },
      },
      line({ x: 0, y: 150 }, (ids: Record<string, string>) => ({ node: ids.peak, site: "l" })),
    ])
    expect(at("line")).toMatchObject({ x: 0, y: 150, w: 150, h: 0 })
  })

  it("keeps a line out of an auto layout's flow", () => {
    const { at } = solved([
      rowOf([block("a", 100, 40), line({ x: 0, y: 0 }, { x: 50, y: 50 }), block("b", 100, 40)], { gap: 10 }),
    ])
    expect(at("b").x).toBe(110)
  })
})
