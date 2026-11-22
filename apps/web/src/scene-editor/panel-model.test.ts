import { describe, expect, it } from "vitest"
import { sectionsFor, shownOf } from "./panel-model"
import { grow, paint, spot } from "./scene-fixtures"

const built = grow([
  { type: "shape", name: "rect", props: { box: spot(0, 0, 100, 100), fills: paint } },
  {
    type: "shape",
    name: "words",
    props: {
      box: spot(0, 0, 100, 40),
      text: { chars: "Hi", spans: [], paras: [{}], style: "body", resize: "height", alignV: "top" },
    },
  },
  { type: "frame", name: "card", props: { box: spot(0, 0, 200, 200), fills: paint }, children: [] },
  {
    type: "shape",
    name: "line",
    props: {
      strokes: paint,
      geometry: {
        kind: "line",
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        route: "straight",
        arrows: ["none", "none"],
      },
    },
  },
  {
    type: "frame",
    name: "chart",
    props: {
      box: spot(0, 0, 400, 300),
      chart: { kind: "column", categories: ["a"], series: [{ name: "s", values: [1] }] },
    },
  },
  {
    type: "shape",
    name: "icon",
    props: { box: spot(0, 0, 50, 50), strokes: paint, geometry: { kind: "icon", name: "lucide/star" } },
  },
])
const { ids, view } = built

describe("the design panel's sections", () => {
  it("follow from the properties a layer accepts", () => {
    expect(sectionsFor(view, [ids.rect!])).toEqual(["box", "sizing", "appearance", "fills", "strokes", "effects"])
  })

  it("add the text section only to a layer that holds text", () => {
    expect(sectionsFor(view, [ids.words!])).toContain("text")
    expect(sectionsFor(view, [ids.rect!])).not.toContain("text")
  })

  it("give a frame layout and a clip and a chart frame its data", () => {
    expect(sectionsFor(view, [ids.card!])).toContain("layout")
    expect(sectionsFor(view, [ids.chart!])).toEqual(["box", "chart", "appearance", "fills", "strokes", "effects"])
    expect(sectionsFor(view, [ids.card!])).not.toContain("chart")
  })

  it("leave a line only its stroke, its opacity and its effects", () => {
    expect(sectionsFor(view, [ids.line!])).toEqual(["appearance", "strokes", "effects"])
  })

  it("take an icon's colour from its stroke, with no fill or corner", () => {
    const sections = sectionsFor(view, [ids.icon!])
    expect(sections).not.toContain("fills")
    expect(sections).toContain("strokes")
  })

  it("show only what every selected layer shares, and no position for several", () => {
    const sections = sectionsFor(view, [ids.rect!, ids.words!])
    expect(sections).not.toContain("box")
    expect(sections).not.toContain("text")
    expect(sections).toContain("fills")
    expect(sectionsFor(view, [ids.rect!, ids.line!])).not.toContain("fills")
  })

  it("show nothing when nothing is selected", () => {
    expect(sectionsFor(view, [])).toEqual([])
  })
})

describe("a property across the selection", () => {
  it("is the one value they share, or mixed", () => {
    expect(shownOf(view, [ids.rect!], "opacity")).toEqual({ mixed: false, value: undefined })
    expect(shownOf(view, [ids.rect!, ids.card!], "fills").mixed).toBe(false)
    expect(shownOf(view, [ids.rect!, ids.words!], "fills").mixed).toBe(true)
  })
})
