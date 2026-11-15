import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement } from "./index.js"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const dark = "336699"
const light = "FFFFFF"

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

  it("maps a duotone's dark and light tones through a filter the picture names", async () => {
    const element = await painted(picture({ picture: { duotone: [`#${dark}`, `#${light}`] } }))
    const filter = element?.querySelector("filter")
    expect(element?.style.filter).toBe(`url("#${filter?.id ?? ""}")`)
    expect(filter?.querySelector("feFuncR")?.getAttribute("tableValues")).toBe("0.2 1")
    expect(filter?.querySelector("feFuncG")?.getAttribute("tableValues")).toBe("0.4 1")
    expect(filter?.querySelector("feFuncB")?.getAttribute("tableValues")).toBe("0.6 1")
  })
})
