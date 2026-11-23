import { contrast } from "@airdesign/document"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { chartArea, chartWrites, drawWrites, iconSwapWrites, iconWrites, type Drawing } from "./create-writes"
import { darkTheme } from "@/testing/create-writes-art"
import { grow, landed } from "@/testing/doom-fixtures"

const quiet = { var: "background2", tint: -0.06 }
const ink = { var: "text" }

const built = grow([])
const slide = built.slides[0]!
const id = doom.nodeId("m:1")

function made(extra: Partial<Drawing> & Pick<Drawing, "kind">) {
  const drawing: Drawing = {
    id,
    parent: { id: slide, at: "a1" as never },
    from: { x: 100, y: 100 },
    to: null,
    square: false,
    center: false,
    ...extra,
  }
  const after = landed(built.view, drawWrites(drawing))
  return after.nodes.get(id) as Record<string, unknown>
}

describe("drawing a shape", () => {
  it("places the default size with its top left at the click", () => {
    expect(made({ kind: "rectangle" })).toMatchObject({
      type: "shape",
      box: { x: 100, y: 100, w: 100, h: 100 },
      geometry: { kind: "rect" },
    })
    expect(made({ kind: "ellipse" })).toMatchObject({ geometry: { kind: "ellipse" } })
    expect(made({ kind: "frame" })).toMatchObject({ type: "frame", box: { w: 480, h: 270 }, clip: true })
  })

  it("draws the box the pointer dragged, in any direction", () => {
    expect(made({ kind: "rectangle", to: { x: 300, y: 250 } })).toMatchObject({
      box: { x: 100, y: 100, w: 200, h: 150 },
    })
    expect(made({ kind: "rectangle", to: { x: 40, y: 30 } })).toMatchObject({ box: { x: 40, y: 30, w: 60, h: 70 } })
  })

  it("keeps it square with Shift and draws from the centre with Alt", () => {
    expect(made({ kind: "ellipse", to: { x: 300, y: 150 }, square: true })).toMatchObject({
      box: { x: 100, y: 100, w: 200, h: 200 },
    })
    expect(made({ kind: "rectangle", to: { x: 140, y: 120 }, center: true })).toMatchObject({
      box: { x: 60, y: 80, w: 80, h: 40 },
    })
  })

  it("paints a shape in the theme's quiet surface with no border, and a frame in the theme's colour", () => {
    const rectangle = made({ kind: "rectangle" })
    expect(rectangle.fills).toEqual([{ kind: "solid", color: quiet }])
    expect(rectangle.strokes).toBeUndefined()
    expect(made({ kind: "frame" }).fills).toEqual([{ kind: "solid", color: { var: "background2" } }])
  })

  it("keeps the theme's text readable on a new shape, in a light and in a dark theme", () => {
    for (const theme of [doom.defaultTheme, darkTheme])
      expect(
        contrast(doom.resolveColor(quiet as doom.Color, theme).slice(1), theme.colors.text.slice(1)),
      ).toBeGreaterThanOrEqual(4.5)
  })

  it("draws a named preset shape at the default size", () => {
    expect(made({ kind: "preset:star5", to: { x: 260, y: 220 } })).toMatchObject({
      name: "Shape",
      geometry: { kind: "preset", name: "star5" },
      box: { x: 100, y: 100, w: 160, h: 120 },
    })
  })

  it("draws a line between its ends, an arrow with a head, and steps by 45 degrees with Shift", () => {
    expect(made({ kind: "line", to: { x: 300, y: 100 } })).toMatchObject({
      geometry: { kind: "line", start: { x: 100, y: 100 }, end: { x: 300, y: 100 }, arrows: ["none", "none"] },
      strokes: [{ kind: "solid", color: ink }],
    })
    expect(made({ kind: "arrow" })).toMatchObject({ geometry: { end: { x: 200, y: 100 }, arrows: ["none", "arrow"] } })
    const stepped = made({ kind: "line", to: { x: 300, y: 130 }, square: true }) as {
      geometry: { end: { x: number; y: number } }
    }
    expect(stepped.geometry.end.y).toBe(100)
    const diagonal = made({ kind: "line", to: { x: 220, y: 190 }, square: true }) as {
      geometry: { end: { x: number; y: number } }
    }
    expect(diagonal.geometry.end.x - 100).toBe(diagonal.geometry.end.y - 100)
  })
})

describe("inserting", () => {
  const slot = { id: slide, at: "a2" as never }
  const inside = { w: 1920, h: 1080 }

  it("centres an icon with a stroke that matches Lucide's weight", () => {
    const after = landed(built.view, iconWrites(id, slot, "rocket", inside))
    expect(after.nodes.get(id)).toMatchObject({
      box: { x: 900, y: 480, w: 120, h: 120 },
      geometry: { kind: "icon", name: "lucide/rocket" },
      stroke: { weight: 10 },
    })
  })

  it("swaps the one selected icon in place, keeping its box, colour and weight", () => {
    const icon = landed(built.view, [
      ...iconWrites(id, slot, "rocket", inside),
      { node: id, prop: "box", value: { x: 40, y: 50, w: 300, h: 300, rotation: 15, flipH: false, flipV: false } },
      { node: id, prop: "stroke", value: { weight: 4, align: "center", dash: "solid" } },
    ])
    const writes = iconSwapWrites(icon, [id], "star")
    expect(writes).toEqual([{ node: id, prop: "geometry", value: { kind: "icon", name: "lucide/star" } }])
    const after = landed(icon, writes ?? [])
    expect(after.nodes.get(id)).toMatchObject({
      box: { x: 40, y: 50, w: 300, h: 300, rotation: 15 },
      geometry: { kind: "icon", name: "lucide/star" },
      stroke: { weight: 4 },
      strokes: [{ kind: "solid", color: { var: "text" } }],
    })
  })

  it("swaps every selected icon, each keeping its own box", () => {
    const two = doom.nodeId("m:2")
    const icons = landed(built.view, [
      ...iconWrites(id, slot, "rocket", inside),
      ...iconWrites(two, { id: slide, at: "a3" as never }, "heart", inside),
      { node: two, prop: "box", value: { x: 10, y: 20, w: 64, h: 64, rotation: 0, flipH: false, flipV: false } },
    ])
    const writes = iconSwapWrites(icons, [id, two], "star")
    expect(writes).toEqual([
      { node: id, prop: "geometry", value: { kind: "icon", name: "lucide/star" } },
      { node: two, prop: "geometry", value: { kind: "icon", name: "lucide/star" } },
    ])
    const after = landed(icons, writes ?? [])
    expect(after.nodes.get(two)).toMatchObject({ box: { x: 10, y: 20, w: 64, h: 64 } })
  })

  it("adds a new icon instead when the selection is empty or holds anything but icons", () => {
    const two = doom.nodeId("m:2")
    const icons = landed(built.view, [
      ...iconWrites(id, slot, "rocket", inside),
      ...drawWrites({
        id: two,
        parent: { id: slide, at: "a3" as never },
        from: { x: 0, y: 0 },
        to: null,
        square: false,
        center: false,
        kind: "rectangle",
      }),
    ])
    expect(iconSwapWrites(icons, [], "star")).toBeNull()
    expect(iconSwapWrites(icons, [id, two], "star")).toBeNull()
    expect(iconSwapWrites(icons, [two], "star")).toBeNull()
  })

  it("inserts a column chart with data a person can edit, in the area it is given", () => {
    const area = { x: 160, y: 229, w: 1600, h: 771 }
    const after = landed(built.view, chartWrites(id, slot, area))
    expect(after.nodes.get(id)).toMatchObject({
      type: "frame",
      box: area,
      chart: { kind: "column", categories: ["Q1", "Q2", "Q3", "Q4"] },
    })
  })

  it("fills the content area under the slide's title, from the title's left edge", () => {
    let next = 0
    const titled = landed(
      built.view,
      doom.titleOnlyWrites(slide, () => doom.nodeId(`t:${String((next += 1))}`), inside),
    )
    const area = chartArea(titled, slide, inside)
    expect(area).toMatchObject({ x: 160, w: 1600 })
    expect(area.y).toBeGreaterThan(200)
    expect(area.y + area.h).toBeLessThanOrEqual(1000)
  })

  it("fills the margins of a slide with no title", () => {
    expect(chartArea(built.view, slide, inside)).toEqual({ x: 160, y: 80, w: 1600, h: 920 })
  })

  it("falls back to the whole parent when nothing is free", () => {
    const frame = doom.nodeId("m:9")
    const covered = landed(built.view, [
      { node: frame, prop: "type", value: "frame" },
      { node: frame, prop: "parent", value: slot },
      { node: frame, prop: "box", value: { x: 0, y: 0, w: 1920, h: 1080, rotation: 0, flipH: false, flipV: false } },
    ])
    expect(chartArea(covered, slide, inside)).toEqual({ x: 0, y: 0, w: 1920, h: 1080 })
  })
})
