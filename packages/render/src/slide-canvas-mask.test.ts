import { elementId, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasSlide, type PaintBox } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const placed = (x: number, y: number, width: number, height: number, rotation = 0): PaintBox => ({
  x,
  y,
  width,
  height,
  rotation,
  flipH: false,
  flipV: false,
})

const group = elementId("256.9")
const oval = elementId("256.2")
const photo = elementId("256.3")
const label = elementId("256.4")
const second = elementId("256.5")
const loose = elementId("256.6")
const groupBox = placed(1_219_200, 1_219_200, 3_048_000, 2_438_400)
const carry = { id: group, box: groupBox }

function element(id: ElementId, box: PaintBox, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    key: `ppt/slides/slide1.xml#${id}`,
    id,
    kind: "shape",
    box,
    editable: false,
    movable: true,
    placeholder: false,
    filled: true,
    fill: "rgb(51 102 153)",
    line: null,
    outline: "box",
    text: null,
    ...overrides,
  }
}

async function mounted(shown: readonly CanvasElement[], quiet = false) {
  const store = paintStore()
  for (const each of shown)
    if (each.id !== null) store.publish({ id: each.id, kind: each.kind === "picture" ? "shape" : each.kind, text: "" })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const slide: CanvasSlide = { width: 12_192_000, height: 6_858_000, background: null, elements: shown }
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide,
        width: 1200,
        ...(quiet ? { quiet: true } : { onBoxes: () => undefined, onRotate: () => undefined }),
      }),
    )
  })
  return host
}

const frameOf = (host: HTMLElement, id: ElementId) =>
  host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${id}"]`)

const clipOf = (host: HTMLElement, id: ElementId) =>
  host.querySelector<HTMLElement>(`[data-mask-clip="ppt/slides/slide1.xml#${id}"]`)

describe("a mask clips the layers above it in its group", () => {
  const masked: readonly CanvasElement[] = [
    element(group, groupBox, { kind: "group", filled: false, fill: null, held: 3 }),
    element(oval, placed(1_219_200, 1_219_200, 2_438_400, 2_438_400), { group: carry, mask: true, outline: "ellipse" }),
    element(photo, placed(1_828_800, 1_219_200, 2_438_400, 2_438_400), { group: carry, kind: "picture" }),
    element(label, placed(1_219_200, 3_048_000, 1_219_200, 304_800), { group: carry }),
    element(loose, placed(6_096_000, 3_048_000, 1_524_000, 1_524_000)),
  ]

  it("paints the layers above the mask inside its outline and leaves the mask itself unpainted", async () => {
    const host = await mounted(masked)
    const clip = clipOf(host, oval)
    expect(clip).not.toBeNull()
    expect(clip?.style.clipPath).toMatch(/^url\("?#/)
    expect(clip?.contains(frameOf(host, photo))).toBe(true)
    expect(clip?.contains(frameOf(host, label))).toBe(true)
    expect(clip?.contains(frameOf(host, oval))).toBe(false)
    expect(clip?.contains(frameOf(host, loose))).toBe(false)
    expect(frameOf(host, oval)?.style.opacity).toBe("0")
    const id = clip?.style.clipPath.replace(/^url\("?#/, "").replace(/"?\)$/, "") ?? ""
    const ellipse = host.querySelector(`clipPath[id="${id}"] ellipse`)
    expect(ellipse?.getAttribute("cx")).toBe("120")
    expect(ellipse?.getAttribute("rx")).toBe("120")
    expect(ellipse?.getAttribute("transform")).toBe("translate(120 120)")
  })

  it("clips the same way in a slide thumbnail", async () => {
    const host = await mounted(masked, true)
    expect(host.querySelector(`[data-mask-clip="ppt/slides/slide1.xml#${oval}"]`)).not.toBeNull()
  })

  it("stops at the next mask, which starts its own clip", async () => {
    const host = await mounted([
      element(group, groupBox, { kind: "group", filled: false, fill: null, held: 4 }),
      element(oval, placed(1_219_200, 1_219_200, 1_219_200, 1_219_200), { group: carry, mask: true }),
      element(photo, placed(1_219_200, 1_219_200, 1_219_200, 1_219_200), { group: carry, kind: "picture" }),
      element(second, placed(2_438_400, 1_219_200, 1_219_200, 1_219_200), { group: carry, mask: true }),
      element(label, placed(2_438_400, 1_219_200, 1_219_200, 1_219_200), { group: carry }),
    ])
    expect(clipOf(host, oval)?.contains(frameOf(host, photo))).toBe(true)
    expect(clipOf(host, oval)?.contains(frameOf(host, label))).toBe(false)
    expect(clipOf(host, second)?.contains(frameOf(host, label))).toBe(true)
  })

  it("turns the outline with a turned mask", async () => {
    const host = await mounted([
      element(group, groupBox, { kind: "group", filled: false, fill: null, held: 2 }),
      element(oval, placed(1_219_200, 1_219_200, 2_438_400, 1_219_200, 90), { group: carry, mask: true }),
      element(photo, placed(1_219_200, 1_219_200, 2_438_400, 2_438_400), { group: carry, kind: "picture" }),
    ])
    const rect = host.querySelector("clipPath rect")
    expect(rect?.getAttribute("width")).toBe("240")
    expect(rect?.getAttribute("height")).toBe("120")
    expect(rect?.getAttribute("transform")).toBe("translate(240 180) rotate(90) translate(-120 -60)")
  })
})
