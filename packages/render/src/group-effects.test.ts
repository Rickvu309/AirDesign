import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasEffects, type CanvasElement, type PaintBox } from "./index.js"

const shadow = {
  blur: 20,
  distance: 10,
  direction: 90,
  scaleX: 1,
  scaleY: 1,
  skewX: 0,
  skewY: 0,
  align: "b",
  rotateWithShape: false,
  color: "rgb(0 0 0 / 35%)",
}

const box: PaintBox = { x: 20, y: 10, width: 100, height: 50, rotation: 0, flipH: false, flipV: false }

const shape = (key: string): CanvasElement => ({
  key,
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
})

const group = (key: string, effects: CanvasEffects | undefined, held: number, turned = box): CanvasElement => ({
  ...shape(key),
  kind: "group",
  box: turned,
  filled: false,
  fill: null,
  held,
  ...(effects === undefined ? {} : { effects }),
})

const roots: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount())
})

async function painted(elements: readonly CanvasElement[], quiet = true) {
  const host = document.createElement("div")
  const root = createRoot(host)
  roots.push(root)
  await act(async () =>
    root.render(
      createElement(SlideCanvas, {
        store: paintStore(),
        slide: { width: 200, height: 100, background: null, elements },
        width: 200,
        quiet,
      }),
    ),
  )
  return host
}

const layer = (host: HTMLElement) => host.querySelector<HTMLElement>("[data-group-effects]")
const used = (host: HTMLElement) =>
  host.querySelector(`[id="${/#([^")]+)/.exec(layer(host)?.style.filter ?? "")?.[1] ?? ""}"]`)
const members = (host: HTMLElement) =>
  [...(layer(host)?.querySelectorAll("[data-thumb-element]") ?? [])].map((each) =>
    each.getAttribute("data-thumb-element"),
  )

describe("group effects", () => {
  it("paints one shadow under everything the group holds, offset along its direction and blurred by half its radius", async () => {
    const host = await painted([group("g", { shadow }, 2), shape("a"), shape("b"), shape("c")])
    expect(members(host)).toEqual(["a", "b"])
    const filter = used(host)
    expect(filter?.querySelector("feOffset")?.getAttribute("dx")).toBe("0")
    expect(filter?.querySelector("feOffset")?.getAttribute("dy")).toBe("10")
    expect(filter?.querySelector("feGaussianBlur")?.getAttribute("stdDeviation")).toBe("10")
    expect(filter?.querySelector("feFlood")?.getAttribute("flood-color")).toBe("rgb(0 0 0 / 35%)")
  })

  it("keeps the shadow out from under the group, as an element's shadow is", async () => {
    const host = await painted([group("g", { shadow }, 1), shape("a")])
    const cut = [...(used(host)?.querySelectorAll("feComposite") ?? [])].find(
      (each) => each.getAttribute("operator") === "out",
    )
    expect(cut?.getAttribute("in2")).toBe("SourceAlpha")
  })

  it("leaves the group's own frame out of the layer", async () => {
    const host = await painted([group("g", { shadow }, 1), shape("a")])
    expect(layer(host)?.querySelector('[data-thumb-element="g"]')).toBeNull()
    expect(host.querySelector('[data-thumb-element="g"]')).not.toBeNull()
  })

  it("turns the shadow with the group when it turns with its shape and keeps it on the slide's axes when not", async () => {
    const turned = { ...box, rotation: 90 }
    const follows = await painted([group("g", { shadow: { ...shadow, rotateWithShape: true } }, 1, turned), shape("a")])
    const stays = await painted([group("g", { shadow }, 1, turned), shape("a")])
    expect(used(follows)?.querySelector("feOffset")?.getAttribute("dx")).toBe("-10")
    expect(used(follows)?.querySelector("feOffset")?.getAttribute("dy")).toBe("0")
    expect(used(stays)?.querySelector("feOffset")?.getAttribute("dy")).toBe("10")
  })

  it("glows around everything the group holds, grown by half the radius and blurred by a quarter of it", async () => {
    const host = await painted([group("g", { glow: { radius: 40, color: "red" } }, 1), shape("a")])
    const grown = used(host)?.querySelector("feMorphology")
    expect(grown?.getAttribute("operator")).toBe("dilate")
    expect(grown?.getAttribute("radius")).toBe("20")
    expect(used(host)?.querySelector("feGaussianBlur")?.getAttribute("stdDeviation")).toBe("10")
    expect(used(host)?.querySelector("feFlood")?.getAttribute("flood-color")).toBe("red")
  })

  it("softens the edge of everything the group holds, as one picture", async () => {
    const host = await painted([group("g", { softEdge: { radius: 20 } }, 2), shape("a"), shape("b")])
    const worn = used(host)?.querySelector("feMorphology")
    expect(worn?.getAttribute("operator")).toBe("erode")
    expect(worn?.getAttribute("radius")).toBe("10")
    expect(members(host)).toEqual(["a", "b"])
  })

  it("paints no layer for a group with no effects, so its members stay on the slide", async () => {
    const host = await painted([group("g", undefined, 1), shape("a")])
    expect(layer(host)).toBeNull()
    expect(host.querySelector('[data-thumb-paint] > [data-thumb-element="a"]')).not.toBeNull()
  })

  it("paints the effects of a group held by a group that has none", async () => {
    const host = await painted([group("outer", undefined, 3), group("inner", { shadow }, 1), shape("a"), shape("b")])
    expect(members(host)).toEqual(["a"])
    expect(host.querySelector('[data-thumb-paint] > [data-thumb-element="b"]')).not.toBeNull()
  })

  it("lets the person reach what the group holds in the editor", async () => {
    const host = await painted([group("g", { shadow }, 1), shape("a")], false)
    expect(layer(host)?.style.pointerEvents).toBe("none")
    expect(layer(host)?.querySelector('[data-canvas-element="a"]')).not.toBeNull()
  })

  it.fails("scales and skews a group's shadow about its alignment point, as PowerPoint does", async () => {
    const host = await painted([group("g", { shadow: { ...shadow, scaleX: 0.5, scaleY: 2 } }, 1), shape("a")])
    expect(host.querySelector("[data-group-effects] [data-effect-shadow]")?.getAttribute("transform")).toContain(
      "scale(0.5 2)",
    )
  })
})
