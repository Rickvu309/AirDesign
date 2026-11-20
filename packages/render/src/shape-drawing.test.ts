import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasSlide } from "./index.js"
import type { ShapeDrawn, ShapeLook } from "./shape-drawing.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => mounted.root.unmount())
    mounted.host.remove()
  }
})

const slide: CanvasSlide = { width: 12_192_000, height: 6_858_000, background: null, elements: [] }
const width = 960
const emu = (pixels: number) => Math.round((pixels * slide.width) / width)

async function mounted(look: ShapeLook) {
  const drawn: ShapeDrawn[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store: paintStore(),
        slide,
        width,
        onBoxes: () => undefined,
        drawShape: { look, onDraw: (each: ShapeDrawn) => drawn.push(each) },
      }),
    )
  })
  const layer = host.querySelector<HTMLElement>("[data-shape-drawing]")
  if (layer === null) throw new Error("no drawing layer")
  layer.getBoundingClientRect = () => new DOMRect(0, 0, width, (width * slide.height) / slide.width)
  layer.setPointerCapture = () => undefined
  return { host, layer, drawn }
}

async function pointer(target: HTMLElement, type: string, x: number, y: number, held: PointerEventInit = {}) {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        button: 0,
        ...held,
      }),
    )
  })
}

it("draws a rectangle the size of the drag and shows it while the pointer moves", async () => {
  const { host, layer, drawn } = await mounted("box")
  await pointer(layer, "pointerdown", 100, 100)
  await pointer(layer, "pointermove", 300, 200)
  expect(host.querySelector('[data-shape-drawn="box"]')).not.toBeNull()
  await pointer(layer, "pointerup", 300, 200)
  expect(drawn).toEqual([
    { box: { x: emu(100), y: emu(100), cx: emu(300) - emu(100), cy: emu(200) - emu(100), flipH: false, flipV: false } },
  ])
  expect(host.querySelector("[data-shape-drawn]")).toBeNull()
})

it("draws a circle with Shift held and places the default shape at a click", async () => {
  const { layer, drawn } = await mounted("ellipse")
  await pointer(layer, "pointerdown", 100, 100, { shiftKey: true })
  await pointer(layer, "pointerup", 300, 160, { shiftKey: true })
  const [circle] = drawn
  expect(circle !== undefined && "box" in circle ? circle.box.cx === circle.box.cy : false).toBe(true)
  await pointer(layer, "pointerdown", 400, 300)
  await pointer(layer, "pointerup", 400, 300)
  expect(drawn[1]).toEqual({ at: { x: emu(400), y: emu(300) } })
})
