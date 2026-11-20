import { elementId, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type Cropped } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const id = elementId("256.4")
const slideWidth = 12_192_000
const width = 1219.2
const pixels = (emu: number) => (emu * width) / slideWidth
const upright = { rotation: 0, flipH: false, flipV: false }

const picture: CanvasElement = {
  key: `ppt/slides/slide1.xml#${id}`,
  id,
  kind: "picture",
  box: { x: 1_000_000, y: 1_000_000, width: 4_000_000, height: 2_000_000, ...upright },
  editable: false,
  movable: true,
  placeholder: false,
  filled: true,
  fill: 'url("blob:photo") 0% 50% / 100% 150% no-repeat',
  line: null,
  outline: "box",
  text: null,
  crop: { url: "blob:photo", image: { x: 0, y: -0.25, width: 1, height: 1.5 } },
}

async function mounted(shown: CanvasElement = picture) {
  const store = paintStore()
  store.publish({ id, kind: "shape", text: "" })
  const crops: [ElementId, Cropped][] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide: { width: slideWidth, height: 6_858_000, background: null, elements: [shown] },
        width,
        onBoxes: () => {},
        onCrop: (node: ElementId, cropped: Cropped) => crops.push([node, cropped]),
      }),
    )
  })
  const frame = host.querySelector<HTMLElement>(`[data-canvas-element="${shown.key}"]`)
  if (frame === null) throw new Error("no picture")
  return { host, frame, crops }
}

async function pointer(target: EventTarget, type: string, x: number, y: number): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 }),
    )
  })
}

async function cropping(host: HTMLElement, frame: HTMLElement): Promise<HTMLElement> {
  await pointer(frame, "pointerdown", pixels(2_000_000), pixels(2_000_000))
  await pointer(frame.ownerDocument, "pointerup", pixels(2_000_000), pixels(2_000_000))
  await act(async () => {
    frame.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }))
  })
  const crop = host.querySelector<HTMLElement>(`[data-crop-frame="${id}"]`)
  if (crop === null) throw new Error("no crop frame")
  return crop
}

async function press(target: HTMLElement, key: string): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }))
  })
}

describe("a person crops an image on the canvas", () => {
  it("double-clicking the image shows the whole image and crop handles instead of the resize handles", async () => {
    const { host, frame } = await mounted()
    const crop = await cropping(host, frame)
    expect(crop.getAttribute("role")).toBe("group")
    expect(crop.ownerDocument.activeElement).toBe(crop)
    expect(host.querySelectorAll("[data-crop-grip]").length).toBeGreaterThanOrEqual(8)
    expect(host.querySelector('[data-grip="top-left"]')).toBeNull()
    expect(frame.style.opacity).toBe("0")
    const image = host.querySelector<HTMLElement>("[data-crop-image]")
    expect([image?.style.top, image?.style.height]).toEqual([
      `${String(pixels(-500_000))}px`,
      `${String(pixels(3_000_000))}px`,
    ])
  })

  it("lands one change with the crop and the frame when the person drags an edge and presses Enter", async () => {
    const { host, frame, crops } = await mounted()
    const crop = await cropping(host, frame)
    const right = host.querySelector<HTMLElement>('[data-crop-grip="e"]')
    if (right === null) throw new Error("no right grip")
    await pointer(right, "pointerdown", pixels(5_000_000), pixels(2_000_000))
    await pointer(right.ownerDocument, "pointermove", pixels(4_000_000), pixels(2_000_000))
    await pointer(right.ownerDocument, "pointerup", pixels(4_000_000), pixels(2_000_000))
    expect(crops).toEqual([])
    await press(crop, "Enter")
    expect(crops).toHaveLength(1)
    const [node, cropped] = crops[0] ?? []
    expect(node).toBe(id)
    expect(cropped?.crop).toEqual({ l: 0, t: 16_667, r: 25_000, b: 16_667 })
    expect(cropped?.frame.x).toBe(1_000_000)
    expect(cropped?.frame.y).toBe(1_000_000)
    expect(Math.abs((cropped?.frame.width ?? 0) - 3_000_000)).toBeLessThan(20)
    expect(cropped?.frame.height).toBe(2_000_000)
    expect(host.querySelector("[data-crop-frame]")).toBeNull()
    expect(frame.style.opacity).toBe("")
    expect(host.querySelector('[data-grip="top-left"]')).not.toBeNull()
  })

  it("moves the image under the frame and ends with a click outside it", async () => {
    const { host, frame, crops } = await mounted()
    await cropping(host, frame)
    const window = host.querySelector<HTMLElement>("[data-crop-window]")
    if (window === null) throw new Error("no crop window")
    await pointer(window, "pointerdown", pixels(3_000_000), pixels(2_000_000))
    await pointer(window.ownerDocument, "pointermove", pixels(3_000_000), pixels(2_400_000))
    await pointer(window.ownerDocument, "pointerup", pixels(3_000_000), pixels(2_400_000))
    await pointer(host.ownerDocument.body, "pointerdown", 1, 1)
    expect(crops.map(([, cropped]) => cropped.crop)).toEqual([{ l: 0, t: 3_333, r: 0, b: 30_000 }])
    expect(host.querySelector("[data-crop-frame]")).toBeNull()
  })

  it("leaves the picture alone when the person presses Escape without dragging", async () => {
    const { host, frame, crops } = await mounted()
    const crop = await cropping(host, frame)
    await press(crop, "Escape")
    expect(crops).toEqual([])
    expect(host.querySelector("[data-crop-frame]")).toBeNull()
  })

  it("keeps double-click for other layers and for an image in a group", async () => {
    const grouped = { ...picture, group: { id: elementId("256.9"), box: null } }
    const { host, frame } = await mounted(grouped)
    await pointer(frame, "pointerdown", pixels(2_000_000), pixels(2_000_000))
    await pointer(frame.ownerDocument, "pointerup", pixels(2_000_000), pixels(2_000_000))
    await act(async () => {
      frame.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }))
    })
    expect(host.querySelector("[data-crop-frame]")).toBeNull()
  })
})
