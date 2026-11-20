import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement } from "./index.js"

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

it("lays a preset's text inside PowerPoint's text area for it, mirrored with the shape", async () => {
  const text = {
    paragraphs: [],
    anchor: "middle",
    insets: { left: 3, top: 5, right: 7, bottom: 11 },
    wrap: true,
  } as const
  const layer = (host: HTMLElement) => host.querySelector<HTMLElement>("[data-canvas-element] > div")?.style
  const upright = { ...shape.box!, flipH: false }
  expect(layer(await canvas([{ ...shape, text, box: upright }]))?.padding).toBe("60px 64px 72px 6px")
  expect(layer(await canvas([{ ...shape, text }]))?.padding).toBe("60px 14px 72px 56px")
  expect(layer(await canvas([{ ...shape, text, box: { ...upright, flipV: true } }]))?.padding).toBe(
    "60px 14px 72px 56px",
  )
  const rectangle = await canvas([{ ...shape, text, geometry: { preset: "rect", adjusts: {} } }])
  expect(layer(rectangle)?.padding).toBe("10px 14px 22px 6px")
  expect(layer(rectangle)?.justifyContent).toBe("center")
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

const stops = [
  { position: 0, color: "red" },
  { position: 1, color: "blue" },
]

function pathGradient(
  kind: "circle" | "rect" | "shape",
  focus: Record<"left" | "top" | "right" | "bottom", number> | null,
  preset = "rect",
) {
  return canvas([
    { ...shape, geometry: { preset, adjusts: {}, gradient: { angle: null, stops, path: { kind, focus } } } },
  ])
}

const centre = { left: 0.5, top: 0.5, right: 0.5, bottom: 0.5 }

function sides(host: HTMLElement) {
  return [...host.querySelectorAll("pattern polygon")].map((polygon) => {
    const fill = polygon.getAttribute("fill") ?? ""
    const gradient = host.querySelector(`[id="${fill.slice(5, -1)}"]`)
    return {
      points: polygon.getAttribute("points"),
      from: [gradient?.getAttribute("x1"), gradient?.getAttribute("y1")],
      to: [gradient?.getAttribute("x2"), gradient?.getAttribute("y2")],
    }
  })
}

it("paints a rect path gradient as four sides that grow from the focus to the box edge", async () => {
  const host = await pathGradient("rect", centre)
  expect(host.querySelector("radialGradient")).toBeNull()
  expect(sides(host)).toEqual([
    { points: "0,0 400,0 200,100 200,100", from: ["0", "100"], to: ["0", "0"] },
    { points: "400,0 400,200 200,100 200,100", from: ["200", "0"], to: ["400", "0"] },
    { points: "0,200 400,200 200,100 200,100", from: ["0", "100"], to: ["0", "200"] },
    { points: "0,0 0,200 200,100 200,100", from: ["200", "0"], to: ["0", "0"] },
  ])
})

it("fills a rectangle with a rect path gradient instead of a CSS background", async () => {
  const host = await pathGradient("rect", centre)
  expect(host.querySelector("rect")?.getAttribute("fill")).toBe(`url(#${host.querySelector("pattern")?.id})`)
  expect(host.innerHTML).not.toContain("linear-gradient")
})

it("fills the path of a preset shape with a rect path gradient", async () => {
  const host = await pathGradient("rect", centre, "rightArrow")
  const fill = host.querySelector("[data-canvas-path] g > path")?.getAttribute("fill")
  expect(fill).toBe(`url(#${host.querySelector("pattern")?.id})`)
})

it("starts a rect path gradient at its corner focus and splits the box along the diagonal", async () => {
  const host = await pathGradient("rect", { left: 0, top: 0, right: 1, bottom: 1 })
  expect(sides(host)).toEqual([
    { points: "400,0 400,200 0,0 0,0", from: ["0", "0"], to: ["400", "0"] },
    { points: "0,200 400,200 0,0 0,0", from: ["0", "0"], to: ["0", "200"] },
  ])
})

it("paints a rect path gradient without a focus from the centre", async () => {
  expect(sides(await pathGradient("rect", null))).toEqual(sides(await pathGradient("rect", centre)))
})

it("paints a shape path gradient as a rect path gradient", async () => {
  expect(sides(await pathGradient("shape", centre))).toEqual(sides(await pathGradient("rect", centre)))
})

it("keeps a circle path gradient radial", async () => {
  const host = await pathGradient("circle", centre)
  expect(host.querySelector("radialGradient")).not.toBeNull()
  expect(host.querySelector("pattern")).toBeNull()
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

it("veils a shaded face of a filled cube in black or white over its fill", async () => {
  const host = await canvas([{ ...shape, fill: "red", geometry: { preset: "cube", adjusts: {} } }])
  const veils = [...host.querySelectorAll("[data-canvas-path] path[data-shade]")].map((path) => [
    path.getAttribute("data-shade"),
    path.getAttribute("fill"),
    path.getAttribute("fill-opacity"),
  ])
  expect(veils).toEqual([
    ["darkenLess", "black", "0.2"],
    ["lightenLess", "white", "0.2"],
  ])
})
