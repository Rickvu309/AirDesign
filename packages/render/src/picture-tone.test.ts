import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement } from "./index.js"

const dark = "336699"
const light = "FFFFFF"
const halfBlack = "00000080"

const box = { x: 20, y: 10, width: 100, height: 50, rotation: 0, flipH: false, flipV: false }

const picture = (extra: Partial<CanvasElement>): CanvasElement => ({
  key: "ppt/slides/slide1.xml#4",
  id: null,
  kind: "picture",
  box,
  editable: false,
  placeholder: false,
  filled: true,
  fill: 'url("blob:picture") 0% 0% / 100% 100% no-repeat',
  line: null,
  outline: "box",
  text: null,
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

describe("picture tone", () => {
  it("paints a picture's opacity and grayscale on the picture and nothing on a plain one", async () => {
    const plain = await painted(picture({}))
    expect(plain?.style.filter).toBe("")
    expect(plain?.style.opacity).toBe("")
    const gray = await painted(picture({ picture: { opacity: 0.6, grayscale: true } }))
    expect(gray?.style.filter).toBe("grayscale(1)")
    expect(gray?.style.opacity).toBe("0.6")
  })

  it("keeps a blur and an overlay off the frame so the border stays sharp", async () => {
    const host = await painted(picture({ picture: { blur: 20, overlay: `#${halfBlack}`, grayscale: true } }))
    const style = host?.getAttribute("style") ?? ""
    expect(style).toContain("overflow: hidden")
    expect(style).not.toContain("grayscale")
    expect(style).not.toContain("blob:picture")
    const wash = host?.querySelector("[data-picture-wash]")
    const overlay = host?.querySelector("[data-picture-overlay]")
    expect(wash?.getAttribute("style")).toContain("grayscale(1)")
    expect(wash?.getAttribute("style")).toContain("blur(")
    expect(wash?.getAttribute("style")).toContain("blob:picture")
    expect(overlay?.getAttribute("style")).toContain("rgba(0, 0, 0, 0.5)")
    expect(overlay?.getAttribute("style") ?? "").not.toContain("blur(")
  })

  it("maps a duotone's dark and light tones through a filter the picture names", async () => {
    const element = await painted(picture({ picture: { duotone: [`#${dark}`, `#${light}`] } }))
    const filter = element?.querySelector("filter")
    expect(element?.style.filter).toBe(`url("#${filter?.id ?? ""}")`)
    expect(filter?.querySelector("feFuncR")?.getAttribute("tableValues")).toBe("0.2 1")
    expect(filter?.querySelector("feFuncG")?.getAttribute("tableValues")).toBe("0.4 1")
    expect(filter?.querySelector("feFuncB")?.getAttribute("tableValues")).toBe("0.6 1")
  })
})
