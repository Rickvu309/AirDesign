import { scene } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import {
  boxFieldWrites,
  chartAddRow,
  chartAddSeries,
  chartCell,
  chartDropRow,
  chartRow,
  layoutModeWrites,
  layoutPatchWrites,
  opacityWrites,
  sizingWrites,
  strokeWrites,
  textFieldWrites,
  themeColorWrites,
} from "./panel-writes"
import { sampleHexes } from "./panel-art"
import { grow, landed, paint, spot } from "./scene-fixtures"

const built = grow([
  {
    type: "shape",
    name: "rect",
    props: { box: spot(100, 100, 200, 100), fills: paint, sizing: { w: "hug", h: "fixed" } },
  },
  { type: "frame", name: "card", props: { box: spot(0, 0, 400, 300), fills: paint }, children: [] },
  {
    type: "shape",
    name: "words",
    props: {
      box: spot(500, 100, 300, 40),
      text: { chars: "Hello", spans: [], paras: [{}], style: "body", resize: "widthAndHeight", alignV: "top" },
    },
  },
  {
    type: "frame",
    name: "group",
    props: { box: spot(0, 400, 300, 100), sizing: { w: "hug", h: "hug" } },
    children: [{ type: "shape", name: "kid", props: { box: spot(100, 0, 100, 100), fills: paint } }],
  },
])
const { ids, view, geometry } = built
const after = (writes: ReturnType<typeof opacityWrites>) => landed(view, writes)
const prop = (state: typeof view, id: string, key: string) =>
  (state.nodes.get(id as never) as Record<string, unknown>)[key]

describe("panel edits", () => {
  it("sets opacity from a percent and clears it at 100", () => {
    expect(prop(after(opacityWrites([ids.rect!], 40)), ids.rect!, "opacity")).toBe(0.4)
    expect(prop(after(opacityWrites([ids.rect!], 100)), ids.rect!, "opacity")).toBeUndefined()
    expect(prop(after(opacityWrites([ids.rect!], 250)), ids.rect!, "opacity")).toBeUndefined()
  })

  it("moves with X and Y and keeps the rest of the box", () => {
    const state = after(boxFieldWrites(view, geometry, ids.rect!, "x", 340.4))
    expect(prop(state, ids.rect!, "box")).toEqual(spot(340, 100, 200, 100))
  })

  it("makes a hug size fixed when its width is typed", () => {
    const state = after(boxFieldWrites(view, geometry, ids.rect!, "w", 500))
    expect(prop(state, ids.rect!, "box")).toMatchObject({ w: 500 })
    expect(prop(state, ids.rect!, "sizing")).toEqual({ w: "fixed", h: "fixed" })
  })

  it("makes auto-width text auto height on a typed width and fixed on a typed height", () => {
    const wide = after(boxFieldWrites(view, geometry, ids.words!, "w", 400))
    expect(prop(wide, ids.words!, "text")).toMatchObject({ resize: "height" })
    const tall = after(boxFieldWrites(view, geometry, ids.words!, "h", 90))
    expect(prop(tall, ids.words!, "text")).toMatchObject({ resize: "fixed" })
  })

  it("scales a group's layers with its typed width", () => {
    const state = after(boxFieldWrites(view, geometry, ids.group!, "w", 600))
    expect(prop(state, ids.kid!, "box")).toMatchObject({ x: 300, w: 300 })
  })

  it("turns a layer by a typed angle", () => {
    expect(prop(after(boxFieldWrites(view, geometry, ids.rect!, "rotation", 45)), ids.rect!, "box")).toMatchObject({
      rotation: 45,
    })
  })

  it("changes one axis of the sizing and leaves the other", () => {
    const state = after(sizingWrites(view, [ids.rect!], { axis: "h", mode: "hug" }))
    expect(prop(state, ids.rect!, "sizing")).toEqual({ w: "hug", h: "hug" })
    expect(sizingWrites(view, [ids.rect!], { axis: "w", mode: "hug" })).toEqual([])
  })

  it("keeps a stroke's other settings when one changes", () => {
    const state = after(strokeWrites(view, [ids.rect!], { weight: 9 }))
    expect(prop(state, ids.rect!, "stroke")).toEqual({ weight: 9, align: "center", dash: "solid" })
  })

  it("switches a frame to auto layout and back, keeping its gap and padding", () => {
    const row = after(layoutModeWrites(view, [ids.card!], "row"))
    expect(prop(row, ids.card!, "layout")).toMatchObject({ mode: "row", gap: 16, align: "top-left" })
    const spaced = landed(row, layoutPatchWrites(row, [ids.card!], { gap: 24, padding: 12, align: "center-center" }))
    expect(prop(spaced, ids.card!, "layout")).toMatchObject({
      gap: 24,
      padding: { t: 12, r: 12, b: 12, l: 12 },
      align: "center-center",
    })
    const column = landed(spaced, layoutModeWrites(spaced, [ids.card!], "column"))
    expect(prop(column, ids.card!, "layout")).toMatchObject({ mode: "column", gap: 24 })
    expect(prop(landed(column, layoutModeWrites(column, [ids.card!], "none")), ids.card!, "layout")).toEqual({
      mode: "none",
    })
  })

  it("makes a grid with the columns asked for", () => {
    const grid = after(layoutModeWrites(view, [ids.card!], "grid"))
    const wide = landed(grid, layoutPatchWrites(grid, [ids.card!], { columns: 4 }))
    expect((prop(wide, ids.card!, "layout") as { columns: unknown[] }).columns).toHaveLength(4)
  })

  it("sets text style, alignment, vertical alignment and resizing together", () => {
    const state = after(
      textFieldWrites(view, [ids.words!], { style: "heading", align: "center", alignV: "center", resize: "fixed" }),
    )
    expect(prop(state, ids.words!, "text")).toMatchObject({
      style: "heading",
      alignV: "center",
      resize: "fixed",
      paras: [{ align: "center" }],
    })
  })
})

describe("chart data", () => {
  const chart = { kind: "column", categories: ["a", "b"], series: [{ name: "s", values: [1, 2] }] } as const

  it("edits a cell and a category name", () => {
    expect(chartCell(chart, 0, 1, 9).series[0]?.values).toEqual([1, 9])
    expect(chartRow(chart, 0, "z").categories).toEqual(["z", "b"])
  })

  it("adds and drops a row across every series, never the last one", () => {
    const added = chartAddRow(chart)
    expect(added.categories).toHaveLength(3)
    expect(added.series[0]?.values).toEqual([1, 2, 0])
    expect(chartDropRow(added, 0).series[0]?.values).toEqual([2, 0])
    expect(chartDropRow({ ...chart, categories: ["a"], series: [{ name: "s", values: [1] }] }, 0).categories).toEqual([
      "a",
    ])
  })

  it("adds a series with a value for each category", () => {
    expect(chartAddSeries(chart).series[1]).toEqual({ name: "Series 2", values: [0, 0] })
  })
})

describe("theme colours", () => {
  it("writes the deck's theme with one colour changed, keeping the rest", () => {
    const view = built.view
    const writes = themeColorWrites(view, "accent1", sampleHexes.themeTyped)
    expect(writes).toHaveLength(1)
    const after = landed(view, writes)
    const theme = scene.deckOf(after).theme
    expect(theme.colors.accent1).toBe(sampleHexes.theme)
    expect(theme.colors.accent2).toBe(scene.deckOf(view).theme.colors.accent2)
    expect(theme.fonts).toEqual(scene.deckOf(view).theme.fonts)
  })

  it("writes nothing for a word that is not a six digit hex, or for the colour it already is", () => {
    const view = built.view
    expect(themeColorWrites(view, "accent1", "red")).toEqual([])
    expect(themeColorWrites(view, "accent1", "#12345")).toEqual([])
    expect(themeColorWrites(view, "accent1", scene.deckOf(view).theme.colors.accent1.toUpperCase())).toEqual([])
  })
})
