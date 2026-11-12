import { describe, expect, it } from "vitest"
import { compareRegions, properties } from "./compare.mjs"

const look = (overrides = {}) => ({ ...Object.fromEntries(properties.map((key) => [key, "x"])), ...overrides })
const region = (name, selector, box, style = look()) => ({ name, selector, box, style })

describe("compareRegions", () => {
  it("reports a canvas column 180 px right of its design and a designed panel that is absent", () => {
    const design = [
      region("canvas column", "[data-editor-canvas]", { x: 248, y: 0, width: 862, height: 923 }),
      region("panel", "[data-editor-panel]", { x: 1110, y: 0, width: 360, height: 923 }),
    ]
    const real = [region("canvas column", "[data-editor-canvas]", { x: 428, y: 0, width: 862, height: 923 })]
    const rows = compareRegions(design, real)
    expect(rows.find((row) => row.name === "canvas column")).toMatchObject({
      status: "changed",
      delta: { x: 180, y: 0 },
    })
    expect(rows.find((row) => row.name === "panel")).toMatchObject({ status: "missing" })
  })

  it("calls a region only the real page has extra, and a region within a pixel a match", () => {
    const rows = compareRegions(
      [region("toolbar", "[data-editor-toolbar]", { x: 500, y: 860, width: 400, height: 44 })],
      [
        region("toolbar", "[data-editor-toolbar]", { x: 520, y: 860.6, width: 380, height: 44 }),
        region("panel", "[data-editor-panel]", { x: 1110, y: 0, width: 360, height: 923 }),
      ],
    )
    expect(rows.map((row) => [row.name, row.status])).toEqual([
      ["toolbar", "match"],
      ["panel", "extra"],
    ])
  })

  it("judges only the style a region names, so slide content never counts", () => {
    const box = { x: 279, y: 80, width: 800, height: 450 }
    const rows = compareRegions(
      [region("slide", "[data-slide-label] + *", box, look({ "font-size": "16px", "box-shadow": "a" }))],
      [region("slide", "[data-slide-label] + *", box, look({ "font-size": "13px", "box-shadow": "b" }))],
    )
    expect(rows[0].styles).toEqual({ "box-shadow": { design: "a", real: "b" } })
  })
})
