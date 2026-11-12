import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement } from "./index.js"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const shape: CanvasElement = {
  key: "arrow",
  id: null,
  kind: "shape",
  box: { x: 10, y: 20, width: 200, height: 100, rotation: 30, flipH: true, flipV: false },
  editable: false,
  placeholder: false,
  filled: true,
  fill: "linear-gradient(90deg, red, blue)",
  line: { color: "black", width: 2, dash: null },
  outline: "box",
  geometry: { preset: "rightArrow", adjusts: {} },
  text: null,
}

const roots: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount())
})

async function canvas(elements: readonly CanvasElement[], quiet = false) {
  const host = document.createElement("div")
  const root = createRoot(host)
  roots.push(root)
  await act(async () =>
    root.render(
      createElement(SlideCanvas, {
        store: paintStore(),
        slide: { width: 400, height: 300, background: null, elements },
        width: 800,
        quiet,
      }),
    ),
  )
  return host
}

it.each(["unknown", "custom"])("keeps %s geometry on the filled rectangle fallback", async (preset) => {
  const host = await canvas([{ ...shape, fill: "red", geometry: { preset, adjusts: {} } }])
  expect(host.querySelector("[data-canvas-path]")).toBeNull()
  expect(host.querySelector("rect")).not.toBeNull()
  expect(host.querySelector<HTMLElement>("[data-canvas-element]")?.style.background).toBe("red")
})

it("paints the same preset path in a quiet thumbnail without an interactive hit area", async () => {
  const host = await canvas([shape], true)
  expect(host.querySelector("[data-thumb-paint] [data-canvas-path]")).not.toBeNull()
  expect(host.querySelector("[data-canvas-element]")).toBeNull()
  expect(host.querySelector<HTMLElement>("[data-thumb-paint] > div")?.style.pointerEvents).toBe("none")
})

it("keeps a preset's text in the rectangle's unchanged text layer", async () => {
  const text = {
    paragraphs: [],
    anchor: "middle",
    insets: { left: 3, top: 5, right: 7, bottom: 11 },
    wrap: true,
  } as const
  const preset = await canvas([{ ...shape, text }])
  const rectangle = await canvas([{ ...shape, text, geometry: { preset: "rect", adjusts: {} } }])
  const layer = (host: HTMLElement) => host.querySelector("[data-canvas-element] > div")?.getAttribute("style")
  expect(layer(preset)).toBe(layer(rectangle))
  expect(layer(preset)).toContain("padding: 10px 14px 22px 6px")
  expect(layer(preset)).toContain("justify-content: center")
})

it("paints a preset's fill and stroke as paths, retaining its placement", async () => {
  const host = await canvas([shape])
  expect(host.querySelector("rect")).toBeNull()
  expect(host.querySelector("[data-canvas-path] path")?.getAttribute("d")).toBe(
    "M0 50L300 50L300 0L400 100L300 200L300 150L0 150Z",
  )
  expect(host.querySelector<HTMLElement>("[data-canvas-element]")?.style.background).toBe("")
  expect(host.querySelector<HTMLElement>("[data-canvas-element]")?.style.transform).toBe("rotate(30deg) scale(-1, 1)")
  expect(host.querySelector("foreignObject div")?.getAttribute("style")).toContain("linear-gradient")
})

it("paints a solid callout tail outside the box even with no line", async () => {
  const host = await canvas([
    { ...shape, fill: "red", line: null, geometry: { preset: "wedgeRectCallout", adjusts: {} } },
  ])
  const fill = host.querySelector("[data-canvas-path] g > path")
  expect(fill?.getAttribute("fill")).toBe("red")
  expect(fill?.getAttribute("d")).toContain("L116.668 225")
  expect(host.querySelector("rect")).toBeNull()
})

it("extends the same gradient through the path rather than filling its box", async () => {
  const host = await canvas([
    {
      ...shape,
      geometry: {
        preset: "rightArrow",
        adjusts: {},
        gradient: {
          angle: 0,
          stops: [
            { position: 0, color: "red" },
            { position: 1, color: "blue" },
          ],
        },
      },
    },
  ])
  const gradient = host.querySelector("linearGradient")
  expect(gradient?.getAttribute("x1")).toBe("0")
  expect(gradient?.getAttribute("x2")).toBe("400")
  expect(host.querySelector("[data-canvas-path] g > path")?.getAttribute("fill")).toBe(`url(#${gradient?.id})`)
  expect(host.querySelector("foreignObject")).toBeNull()
})

it.each(["triangle", "stealth", "diamond", "oval", "arrow"] as const)(
  "paints %s at the start and end without dashing the markers",
  async (kind) => {
    const host = await canvas([
      {
        ...shape,
        outline: "line",
        geometry: { preset: "straightConnector1", adjusts: {} },
        line: { color: "black", width: 2, dash: [4, 3], head: kind, tail: kind },
      },
    ])
    const line = host.querySelector("line")
    const markers = [...host.querySelectorAll("marker")]
    expect(line?.getAttribute("marker-start")).toBe(`url(#${markers[0]?.id})`)
    expect(line?.getAttribute("marker-end")).toBe(`url(#${markers[1]?.id})`)
    expect(line?.getAttribute("x2")).toBe("400")
    expect(line?.getAttribute("y2")).toBe("200")
    expect(line?.getAttribute("stroke-dasharray")).toBe("16 12")
    expect(markers).toHaveLength(2)
    for (const marker of markers) {
      expect(marker.getAttribute("orient")).toBe("auto-start-reverse")
      expect(marker.querySelector("[stroke-dasharray]")).toBeNull()
      expect(marker.querySelector("ellipse") !== null).toBe(kind === "oval")
      if (kind === "arrow") expect(marker.querySelector("path")?.getAttribute("fill")).toBe("none")
    }
  },
)

it("uses distinct marker addresses when the same deck element paints twice", async () => {
  const line = { color: "black", width: 2, dash: null, tail: "triangle" } as const
  const host = await canvas([
    { ...shape, line },
    { ...shape, key: "second", line },
  ])
  const ids = [...host.querySelectorAll("[id]")].map((node) => node.id)
  expect(new Set(ids).size).toBe(ids.length)
})
