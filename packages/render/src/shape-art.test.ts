import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasLine } from "./index.js"

const base: CanvasLine = { color: "black", width: 10, dash: null }
const element = (line: CanvasLine, extra: Partial<CanvasElement> = {}): CanvasElement => ({
  key: "line",
  id: null,
  kind: "shape",
  box: { x: 0, y: 0, width: 200, height: 0, rotation: 0, flipH: false, flipV: false },
  editable: false,
  placeholder: false,
  filled: false,
  fill: null,
  line,
  outline: "line",
  text: null,
  ...extra,
})

const roots: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount())
})

async function painted(line: CanvasLine, extra: Partial<CanvasElement> = {}) {
  const host = document.createElement("div")
  const root = createRoot(host)
  roots.push(root)
  await act(async () =>
    root.render(
      createElement(SlideCanvas, {
        store: paintStore(),
        slide: { width: 200, height: 100, background: null, elements: [element(line, extra)] },
        width: 200,
        quiet: true,
      }),
    ),
  )
  return host
}

const box = {
  outline: "box" as const,
  box: { x: 0, y: 0, width: 100, height: 50, rotation: 0, flipH: false, flipV: false },
}

describe("line paint", () => {
  it("sets no cap or miter limit and a round join when the line has none", async () => {
    const host = await painted(base)
    const stroke = host.querySelector("line")
    expect(stroke?.getAttribute("stroke-linecap")).toBeNull()
    expect(stroke?.getAttribute("stroke-linejoin")).toBe("round")
    expect(stroke?.getAttribute("stroke-miterlimit")).toBeNull()
  })

  it.each(["round", "square", "butt"] as const)("paints the cap %s", async (cap) => {
    const host = await painted({ ...base, cap })
    expect(host.querySelector("line")?.getAttribute("stroke-linecap")).toBe(cap)
  })

  it("paints a miter join with its limit", async () => {
    const host = await painted({ ...base, join: { kind: "miter", limit: 8 } }, box)
    const rect = host.querySelector("rect")
    expect(rect?.getAttribute("stroke-linejoin")).toBe("miter")
    expect(rect?.getAttribute("stroke-miterlimit")).toBe("8")
  })

  it("paints a bevel join with no miter limit", async () => {
    const host = await painted({ ...base, join: { kind: "bevel" } }, box)
    expect(host.querySelector("rect")?.getAttribute("stroke-linejoin")).toBe("bevel")
    expect(host.querySelector("rect")?.getAttribute("stroke-miterlimit")).toBeNull()
  })

  it("paints a custom dash in line widths", async () => {
    const host = await painted({ ...base, dash: [4, 1, 0.5, 2.5] })
    expect(host.querySelector("line")?.getAttribute("stroke-dasharray")).toBe("40 10 5 25")
  })

  it("sizes an arrowhead from its width and length", async () => {
    const host = await painted({ ...base, head: "triangle", headSize: { width: 5, length: 2 } })
    const marker = host.querySelector("marker")
    expect(marker?.getAttribute("markerWidth")).toBe("20")
    expect(marker?.getAttribute("markerHeight")).toBe("50")
    expect(marker?.getAttribute("preserveAspectRatio")).toBe("none")
  })

  it("sizes an arrowhead with no size at three line widths", async () => {
    const host = await painted({ ...base, tail: "stealth" })
    const marker = host.querySelector("marker")
    expect(marker?.getAttribute("markerWidth")).toBe("30")
    expect(marker?.getAttribute("markerHeight")).toBe("30")
  })

  it("draws a double line as two parallel strokes a third of the width each", async () => {
    const host = await painted({ ...base, compound: "dbl" })
    const strokes = [...host.querySelectorAll("line")].filter((line) => line.getAttribute("stroke") === "black")
    expect(strokes.map((line) => Number(line.getAttribute("stroke-width")).toFixed(2))).toEqual(["3.33", "3.33"])
    expect(strokes.map((line) => Number(line.getAttribute("y1")).toFixed(2))).toEqual(["-3.33", "3.33"])
  })

  it("draws a triple line as thin, thick, thin", async () => {
    const host = await painted({ ...base, compound: "tri" })
    const strokes = [...host.querySelectorAll("line")].filter((line) => line.getAttribute("stroke") === "black")
    expect(strokes.map((line) => Number(line.getAttribute("stroke-width")).toFixed(2))).toEqual([
      "1.67",
      "3.33",
      "1.67",
    ])
  })

  it.each<["thickThin" | "thinThick", string[], string[]]>([
    ["thickThin", ["5.00", "2.50"], ["-2.50", "3.75"]],
    ["thinThick", ["2.50", "5.00"], ["-3.75", "2.50"]],
  ])("draws a %s line with its thick stroke on its own side", async (compound, widths, offsets) => {
    const host = await painted({ ...base, compound })
    const strokes = [...host.querySelectorAll("line")].filter((line) => line.getAttribute("stroke") === "black")
    expect(strokes.map((line) => Number(line.getAttribute("stroke-width")).toFixed(2))).toEqual(widths)
    expect(strokes.map((line) => Number(line.getAttribute("y1")).toFixed(2))).toEqual(offsets)
  })

  it("keeps the arrowhead whole on a compound line", async () => {
    const host = await painted({ ...base, compound: "dbl", tail: "triangle" })
    const marked = [...host.querySelectorAll("line")].filter((line) => line.getAttribute("marker-end") !== null)
    expect(marked).toHaveLength(1)
    expect(marked[0]?.getAttribute("mask")).toBeNull()
  })

  it("cuts a compound outline's gap with a mask", async () => {
    const host = await painted({ ...base, compound: "dbl" }, box)
    const rect = host.querySelector("rect[mask]")
    expect(rect?.getAttribute("mask")).toMatch(/^url\(#.+-compound\)$/)
    expect(host.querySelector("mask")).not.toBeNull()
  })

  it("paints a single line with no mask", async () => {
    const host = await painted(base, box)
    expect(host.querySelector("mask")).toBeNull()
  })
})
