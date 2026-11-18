import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement } from "./index.js"

const dark = "336699"
const light = "FFFFFF"
const halfBlack = "00000080"

const box = { x: 20, y: 10, width: 100, height: 50, rotation: 0, flipH: false, flipV: false }

const image = 'url("blob:picture") 0% 0% / 100% 100% no-repeat'

type Look = NonNullable<CanvasElement["layers"]>[number]["picture"]

const picture = (look?: Look, extra: Partial<CanvasElement> = {}): CanvasElement => ({
  key: "ppt/slides/slide1.xml#4",
  id: null,
  kind: "picture",
  box,
  editable: false,
  placeholder: false,
  filled: true,
  fill: null,
  line: null,
  outline: "box",
  text: null,
  layers: [{ background: image, ...(look === undefined ? {} : { picture: look }) }],
  ...extra,
})

const roots: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount())
})

async function painted(element: CanvasElement) {
  const host = document.createElement("div")
  const root = createRoot(host)
  roots.push(root)
  await act(async () =>
    root.render(
      createElement(SlideCanvas, {
        store: paintStore(),
        slide: { width: 200, height: 100, background: null, elements: [element] },
        width: 200,
        quiet: true,
      }),
    ),
  )
  return host.querySelector<HTMLElement>("[data-thumb-element], [data-canvas-element]")
}

function layer(host: HTMLElement | null): HTMLElement | null | undefined {
  return host?.querySelector<HTMLElement>('[data-fill-layer="0"] [data-fill-image]')
}

describe("fill layers", () => {
  it("paints an image layer with its opacity and grayscale on the layer, and nothing on the frame", async () => {
    const plain = await painted(picture())
    expect(plain?.style.filter).toBe("")
    expect(plain?.style.background).toBe("")
    expect(plain?.querySelector<HTMLElement>('[data-fill-layer="0"] > div')?.style.background).toContain("blob:picture")
    const gray = await painted(picture({ opacity: 0.6, grayscale: true }))
    expect(gray?.style.filter).toBe("")
    expect(layer(gray)?.style.filter).toBe("grayscale(1)")
    expect(layer(gray)?.style.opacity).toBe("0.6")
  })

  it("keeps a blur and an overlay inside the layer so the frame and its border stay sharp", async () => {
    const host = await painted(picture({ blur: 20, overlay: `#${halfBlack}`, grayscale: true }))
    const style = host?.getAttribute("style") ?? ""
    expect(style).toContain("overflow: hidden")
    expect(style).not.toContain("grayscale")
    expect(style).not.toContain("blob:picture")
    expect(layer(host)?.getAttribute("style")).toContain("grayscale(1)")
    expect(layer(host)?.getAttribute("style")).toContain("blur(")
    const overlay = host?.querySelector('[data-fill-layer="0"] [data-fill-overlay]')
    expect(overlay?.getAttribute("style") ?? "").not.toContain("blur(")
  })

  it("maps a duotone's dark and light tones through a filter the layer names", async () => {
    const element = await painted(picture({ duotone: [`#${dark}`, `#${light}`] }))
    const filter = element?.querySelector("filter")
    expect(layer(element)?.style.filter).toBe(`url("#${filter?.id ?? ""}")`)
    expect(filter?.querySelector("feFuncR")?.getAttribute("tableValues")).toBe("0.2 1")
    expect(filter?.querySelector("feFuncG")?.getAttribute("tableValues")).toBe("0.4 1")
    expect(filter?.querySelector("feFuncB")?.getAttribute("tableValues")).toBe("0.6 1")
  })

  it("paints a stack bottom first, one layer each", async () => {
    const host = await painted(picture(undefined, { layers: [{ background: `#${dark}` }, { background: image }] }))
    expect(host?.querySelectorAll("[data-fill-layer]").length).toBe(2)
    expect(host?.querySelector<HTMLElement>('[data-fill-layer="0"] > div')?.style.background).toContain(
      "rgb(51, 102, 153)",
    )
  })
})
