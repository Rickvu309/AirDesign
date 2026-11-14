import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasEffects, type CanvasElement } from "./index.js"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const shadow = {
  blur: 20,
  distance: 10,
  direction: 90,
  scaleX: 1,
  scaleY: 1,
  skewX: 0,
  skewY: 0,
  align: "b",
  rotateWithShape: true,
  color: "rgb(0 0 0 / 35%)",
}

const box = { x: 20, y: 10, width: 100, height: 50, rotation: 0, flipH: false, flipV: false }

const element = (effects: CanvasEffects | undefined, extra: Partial<CanvasElement> = {}): CanvasElement => ({
  key: "shape",
  id: null,
  kind: "shape",
  box,
  editable: false,
  placeholder: false,
  filled: true,
  fill: "steelblue",
  line: null,
  outline: "box",
  text: null,
  ...(effects === undefined ? {} : { effects }),
  ...extra,
})

const roots: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount())
})

async function painted(shape: CanvasElement) {
  const host = document.createElement("div")
  const root = createRoot(host)
  roots.push(root)
  await act(async () =>
    root.render(
      createElement(SlideCanvas, {
        store: paintStore(),
        slide: { width: 200, height: 100, background: null, elements: [shape] },
        width: 200,
        quiet: true,
      }),
    ),
  )
  return host
}

const shadowGroup = (host: HTMLElement) => host.querySelector("[data-effect-shadow]")

describe("shadow paint", () => {
  it("paints no filter and no extra svg for an element with no effects", async () => {
    const host = await painted(element(undefined))
    expect(host.querySelector("filter")).toBeNull()
    expect(host.querySelector("[data-canvas-line]")).toBeNull()
  })

  it("paints the shadow of a filled box offset by its distance along its direction, blurred by half its radius", async () => {
    const host = await painted(element({ shadow }))
    const group = shadowGroup(host)
    expect(group?.getAttribute("transform")).toMatch(/^translate\(0 10\)/)
    expect(host.querySelector("filter feGaussianBlur")?.getAttribute("stdDeviation")).toBe("10")
    expect(host.querySelector("filter feFlood")?.getAttribute("flood-color")).toBe("rgb(0 0 0 / 35%)")
    expect(group?.querySelector("rect")?.getAttribute("width")).toBe("100")
  })

  it("keeps the shadow out of the shape so a fill under it is not covered", async () => {
    const host = await painted(element({ shadow }))
    const mask = host.querySelector("mask")
    expect(mask).not.toBeNull()
    expect(shadowGroup(host)?.parentElement?.getAttribute("mask")).toBe(`url(#${mask?.id})`)
    expect(mask?.querySelector("rect[fill='black']")).not.toBeNull()
  })

  it("follows the shape's turn when the shadow turns with it and stays on the slide's axes when it does not", async () => {
    const turned = { ...box, rotation: 90 }
    const follows = await painted(element({ shadow }, { box: turned }))
    const stays = await painted(element({ shadow: { ...shadow, rotateWithShape: false } }, { box: turned }))
    expect(shadowGroup(follows)?.getAttribute("transform")).toMatch(/^translate\(0 10\)/)
    expect(shadowGroup(stays)?.getAttribute("transform")).toMatch(/^translate\(10 0\)/)
  })

  it("scales and skews the shadow about its alignment point", async () => {
    const host = await painted(element({ shadow: { ...shadow, scaleX: 0.5, scaleY: 2, skewX: 10, align: "tl" } }))
    const transform = shadowGroup(host)?.getAttribute("transform") ?? ""
    expect(transform).toContain("translate(0 0)")
    expect(transform).toContain("skewX(10)")
    expect(transform).toContain("scale(0.5 2)")
  })

  it("paints the shadow of an outline only when the shape has a line and no fill", async () => {
    const line = { color: "black", width: 4, dash: null }
    const outlined = await painted(element({ shadow }, { fill: null, filled: false, line }))
    expect(shadowGroup(outlined)?.querySelector("rect")?.getAttribute("fill")).toBe("none")
    expect(shadowGroup(outlined)?.querySelector("rect")?.getAttribute("stroke")).not.toBe("none")
  })

  it("paints no shadow for a shape with no fill and no line", async () => {
    const host = await painted(element({ shadow }, { fill: null, filled: false }))
    expect(shadowGroup(host)).toBeNull()
  })

  it("paints the shadow of a picture", async () => {
    const host = await painted(element({ shadow }, { kind: "picture", fill: null, filled: false }))
    expect(shadowGroup(host)?.querySelector("rect")).not.toBeNull()
  })

  it("paints an ellipse's shadow as an ellipse", async () => {
    const host = await painted(element({ shadow }, { outline: "ellipse" }))
    expect(shadowGroup(host)?.querySelector("ellipse")).not.toBeNull()
  })

  it("paints a preset shape's shadow from its path", async () => {
    const host = await painted(element({ shadow }, { geometry: { preset: "triangle", adjusts: {} } }))
    expect(shadowGroup(host)?.querySelector("path")?.getAttribute("d")).toMatch(/^M/)
  })
})

describe("glow paint", () => {
  it("paints a halo of the glow's colour grown by half its radius and blurred by a quarter of it", async () => {
    const host = await painted(element({ glow: { radius: 40, color: "rgb(255 0 0 / 60%)" } }))
    const filter = host.querySelector("[data-effect-glow]")?.getAttribute("filter")
    const used = host.querySelector(`[id="${filter?.slice(5, -1)}"]`)
    expect(used?.querySelector("feMorphology")?.getAttribute("operator")).toBe("dilate")
    expect(used?.querySelector("feMorphology")?.getAttribute("radius")).toBe("20")
    expect(used?.querySelector("feGaussianBlur")?.getAttribute("stdDeviation")).toBe("10")
    expect(used?.querySelector("feFlood")?.getAttribute("flood-color")).toBe("rgb(255 0 0 / 60%)")
  })
})

describe("soft edge paint", () => {
  it("draws a solid fill in the svg, eroded and blurred, and leaves the frame with no background", async () => {
    const host = await painted(element({ softEdge: { radius: 20 } }))
    const soft = host.querySelector("[data-effect-soft]")
    expect(soft?.getAttribute("fill")).toBe("steelblue")
    const filter = host.querySelector(`[id="${soft?.getAttribute("filter")?.slice(5, -1)}"]`)
    expect(filter?.querySelector("feMorphology")?.getAttribute("operator")).toBe("erode")
    expect(filter?.querySelector("feMorphology")?.getAttribute("radius")).toBe("10")
    expect(filter?.querySelector("feGaussianBlur")?.getAttribute("stdDeviation")).toBe("5")
    expect(host.querySelector<HTMLElement>("[data-thumb-element]")?.style.background).toBe("")
  })

  it("leaves a fill drawn by css alone", async () => {
    const host = await painted(element({ softEdge: { radius: 20 } }, { fill: "linear-gradient(90deg, red, blue)" }))
    expect(host.querySelector("[data-effect-soft]")).toBeNull()
    expect(host.querySelector<HTMLElement>("[data-thumb-element]")?.style.background).toContain("linear-gradient")
  })

  it("paints a rounded box's soft fill with its corners", async () => {
    const host = await painted(element({ softEdge: { radius: 20 } }, { outline: "round" }))
    expect(host.querySelector("[data-effect-soft]")?.getAttribute("rx")).not.toBeNull()
  })
})
